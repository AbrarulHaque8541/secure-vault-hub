# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Instead:

1. Use GitHub's [private vulnerability reporting](../../security/advisories/new)
   on this repository, **or**
2. Open a security advisory draft with reproduction steps and affected versions.

You will get an acknowledgment within 72 hours. Fixes land in the next patch
release and are credited in the advisory (or anonymously, your choice).

## Scope

High-value targets in this codebase:

- `src/lib/crypto.ts` — AES-256-GCM envelope encryption, key derivation
- `src/lib/vault-store.ts` — in-memory session key handling
- `src/convex/vault.ts` — authorization scoping on every handler
- `android/` — WebView settings, mixed content, debugging flags,
  `android:allowBackup` and the backup rule files in `res/xml/`

## Design notes for reviewers

- The vault passphrase is never persisted — not in localStorage, not in
  cookies, not on the server. It lives in a module-scoped variable for the tab
  session only.
- The server stores `vaultItems.ciphertext` as an opaque string and has no
  code path that can decrypt it. There is deliberately no key escrow.
- All Convex handlers resolve the caller with `getAuthUserId(ctx)` and verify
  document ownership before mutating.
- Lost passphrase ⇒ unrecoverable ciphertext. This is stated in the product
  UI and is a feature, not a bug.

## Platform data protection (Android)

- `android:allowBackup="false"`, plus explicit excludes in
  `res/xml/data_extraction_rules.xml` (API 31+) and
  `res/xml/full_backup_content.xml` (API ≤ 30).
- The app's own ciphertext is useless to a backup, but the WebView profile is
  not: cookies and session tokens live there in the clear, and Android ≤ 11
  sends automatic backups to Google Drive unless told otherwise.
- Backups are disabled outright rather than filtered, because nothing the app
  stores is worth restoring onto another device — a lost passphrase already
  makes the ciphertext unrecoverable either way.

### Known issue: debug APK committed to the repository

`apks/SecureVaultHub-v1.0.0-debug.apk` was committed to this public
repository. A debug build of a Capacitor app enables WebView remote debugging,
and an APK's contents are trivially extractable, so it should be treated as an
information-disclosure artefact rather than a convenience download.

This change untracks it and adds `apks/*.apk` to `.gitignore`. Do not
re-commit it — release artefacts belong in GitHub Releases, produced by a
signed CI job. It also remains reachable in git history.

Rotation status for the two credentials committed in the same repository
(`.env.keys` and the email-OTP provider key) is tracked in
[docs/SECRET-ROTATION.md](docs/SECRET-ROTATION.md). Untracking is not
remediation: both keys must be rotated, and the objects purged from history.
