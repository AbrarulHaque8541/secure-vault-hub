# CI/CD round-2 fixes (secure-vault-hub)

Wires the round-2 regression tests into the pipeline and closes the remaining
gap in the H5 dependency remediation.

## 1. H5 was only half-fixed — the lockfile still resolved the vulnerable axios

PR #12 bumps `package.json` to `axios@^1.20.0`, but CI and release both run
`bun install --frozen-lockfile`:

- `.github/workflows/ci.yml` — "Install dependencies"
- `.github/workflows/release.yml` — "Install dependencies"

With a **frozen** install, what actually gets installed is what `bun.lock`
resolves, not what `package.json` declares. `main`'s `bun.lock` still pinned
`axios@1.18.1` (carrying the prototype-pollution and DNS/proxy-bypass
advisories), so the `package.json` bump alone did not remediate H5 — and the
`frozen-lockfile` install does **not** fail, it silently installs 1.18.1.

This change regenerates `bun.lock` so the resolved entry is `axios@1.20.0`
(with the matching `form-data` dependency and integrity hash), and `package.json`
is bumped to match.

## 2. Guard against a silent dependency regression

`scripts/check-lockfile-deps.mjs` asserts the **resolved** version in `bun.lock`
is at or above the patched floor for `axios` (>= 1.20.0), and that
`package.json`'s declared range cannot resolve below that floor. It runs in both
`ci.yml` and `release.yml`, so neither a stale lockfile nor a loosened range can
pass CI again.

## 3. Round-2 convex tests were never executed

The round-2 helpers added `bun:test` suites under `src/convex/lib`:

- `src/convex/lib/redact.test.ts` — secret/OTP leak regression (M9)
- `src/convex/lib/otpRateLimit.test.ts` — OTP burst/sustained limiting (H2)

The existing "Unit tests" step runs `bun test src/lib`, which does **not**
discover `src/convex/lib`, so those suites never ran in CI. Both `ci.yml` and
`release.yml` now run `bun test src/convex/lib`, and `package.json` gains a
`test:convex` script for local use.

## Verification

```
node scripts/check-lockfile-deps.mjs
# PASS lockfile dependency floors: 3 assertions (axios >= 1.20.0 both declared and resolved)
```

Negative test: reverting the lockfile entry to `axios@1.18.1` makes the guard
fail with the `::error::` line naming the stale resolved version.

## Honest limits

No live Convex deployment and no Android SDK in the sandbox, so no end-to-end
OTP or Gradle run is claimed; this is a dependency + CI-wiring change verified by
the guard and by the test-discovery paths.
