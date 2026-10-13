# Secret Rotation & Git-History Purge Runbook

> **Status:** REQUIRED follow-up to this branch. Untracking a secret is **not**
> remediation. Everything below must be executed before this incident can be
> closed.

## Why this is mandatory

`.env.keys` was force-added to a **public** repository and shipped in its
history. Two facts make deletion alone insufficient:

1. **The key is already public.** Anyone who cloned or forked the repo has it.
   GitHub keeps unreachable objects accessible through the REST API and
   `refs/pull/*` until an explicit purge + support request completes.
2. **git history is immutable by default.** `git rm` removes the file from the
   working tree, not from the objects already pushed.

Order matters: **rotate first, purge second, verify last.** Purging without
rotating only hides a still-live credential.

---

## Step 1 — Rotate every credential that was ever committed

| Credential | Where it lived | Rotation action |
|---|---|---|
| `DOTENV_PRIVATE_KEY_LOCAL` | `.env.keys` (tracked) | Generate a new keypair with `bunx dotenvx keys` and re-encrypt all `.env.*` files. The old private key must be considered compromised and discarded. |
| Email-OTP provider key (`fb_email_…`) | `src/convex/auth/emailOtp.ts` (source) | Issue a new key in the provider dashboard, then store it as a Convex environment variable (`FREEBUFF_EMAIL_API_KEY`). Revoke the old key. |
| Any secret encrypted by the old dotenvx key | `.env*` files | Because the private key leaked, **every value those files protect is compromised** and must be rotated individually, not just re-wrapped. |

Checklist:

- [ ] New dotenvx keypair generated; old private key revoked
- [ ] Every value previously sealed by the old key rotated at its provider
- [ ] Email-OTP provider key rotated and old key revoked
- [ ] New values set as **deployment environment variables** (Convex dashboard
      → Settings → Environment Variables), never committed
- [ ] `.env.keys` exists only in local developer checkouts and CI secret stores

## Step 2 — Purge from history

`git filter-repo` is the supported tool (`git filter-branch` is deprecated and
substantially slower).

```bash
# Work on a fresh mirror clone — never on your working repo.
git clone --mirror git@github.com:AbrarulHaque8541/secure-vault-hub.git repo.git
cd repo.git

# Remove the file from every reachable commit.
git filter-repo --invert-paths --path .env.keys --force

git push --force --all
git push --force --tags
```

Then:

- [ ] Delete stale `refs/pull/*` and `refs/original/*`
- [ ] Ask GitHub Support to garbage-collect unreachable objects (a force-push
      alone does **not** remove them from the API)
- [ ] Notify every collaborator to **re-clone** — a pull request on an old
      clone resurrects the deleted objects
- [ ] Invalidate CI caches and any published APK artefacts built from the
      affected commits

## Step 3 — Verify

```bash
# Must print nothing.
git log --all --oneline -- .env.keys

# Must print nothing.
git log --all -p -S 'DOTENV_PRIVATE_KEY' --oneline

# Must print nothing.
git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '^\.env\.example$'
```

- [ ] All three commands above return empty
- [ ] The `secrets-guard` workflow is green on `main`
- [ ] `history-audit` job in `.github/workflows/secrets-guard.yml` has
      `continue-on-error` **removed** (it is non-blocking only while the purge
      is pending — see the comment in that file)

## Step 4 — Prevent recurrence

Already merged with this branch:

- `.gitignore` now blocks `.env.keys` at **any** depth plus `*.pem`.
- `.github/workflows/secrets-guard.yml` fails any push/PR that tracks a
  secret-looking file, and runs gitleaks (full history) as a second opinion.
- Secret-scanning must also be enabled in the repository settings
  (Settings → Code security → Secret scanning + Push protection). Workflow
  guards cannot see a secret that is pushed encrypted or already rotated.

> **Never** re-enable `git add -f` for an ignored path. If a file is ignored,
> that is the guard working — fix the `.gitignore` deliberately instead.
