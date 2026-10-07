# CI/CD: real production signing + fail-closed release pipeline

## What was wrong

`android/app/build.gradle` had no `signingConfigs` block, and `.github/workflows/release.yml`
built and published:

```yaml
- name: Build release APK (unsigned)
  run: cd android && ./gradlew assembleRelease --no-daemon
...
cp android/app/build/outputs/apk/release/app-release-unsigned.apk \
   apk-out/SecureVaultHub-${{ github.ref_name }}-release-unsigned.apk
```

So the release pipeline's "release" artifact was **unsigned** and shipped under the production
package name `app.securevaulthub.app`. An unsigned APK cannot upgrade an installed app in place
(Android rejects a signature change) and can be silently replaced — for a security-focused vault
app, that is a supply-chain defect, not a packaging detail. There was also no signature
verification, no checksum, and no protection against a future pipeline publishing an unsigned
build as production.

## What this changes

### Fail-closed production signing
- `android/variables.gradle` reads `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`,
  `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD` from the environment and derives a single
  `hasReleaseSigning` flag.
- `android/app/build.gradle` registers that signing config on the `release` build type and adds a
  `gradle.taskGraph.whenReady` guard that **throws** for `assembleRelease` / `bundleRelease` /
  `packageRelease` when the flag is false — no debug-key fallback. Debug builds are unaffected.
- `docs/RELEASE-SIGNING.md` documents the four secret names, keytool creation, the upgrade
  caveat (signing-certificate identity) and the fact that any previously published APK was not
  production-signed.

### Release workflow
`.github/workflows/release.yml` now:
- pins every action to an immutable commit SHA and scopes permissions (`contents: read`
  everywhere, `contents: write` only on the publishing job);
- runs a `verify` job (typecheck + unit tests) before the APK job;
- fails closed early with a clear `::error::` when any of the four secrets is missing;
- restores the keystore from `KEYSTORE_BASE64`, builds the signed `assembleRelease` **and**
  `bundleRelease` artifacts, and removes the decoded keystore in an `always()` step;
- verifies `apksigner` v2/v3, package id `app.securevaulthub.app` and version metadata;
- generates and re-verifies `SHA256SUMS.txt`, uploads the payload as a workflow artifact, and
  only publishes to a release when the ref is a tag.

### CI hardening
`.github/workflows/ci.yml`:
- pins all actions to commit SHAs and adds least-privilege permissions, a concurrency group, a
  timeout and `fetch-depth: 0`;
- adds a **committed-APK guard** (`.apk`/`.aab` must never be tracked — they are published from
  CI now), alongside the existing tracked-secret guard;
- scopes the unit-test step to `bun test src/lib`, matching `package.json`.

## How it was verified

- Both workflow YAMLs parse (Python YAML, flow-style `on:` normalised) and every job has
  `runs-on` + `steps`.
- All embedded `run:` blocks were extracted and passed through `bash -n`.
- SHA pins were resolved with `git ls-remote`.

## Honest limitations

- **No Android SDK/emulator here**, so no Gradle build, `apksigner` run or device test is
  claimed. The signing guard is Gradle configuration, verified structurally; the first real
  build happens in the workflow's own CI.
- The release job **cannot succeed until the four secrets exist** — that is the intended
  fail-closed behaviour.
- No app source, encrypted-storage code, or schema was touched; this change is confined to CI
  and Gradle configuration plus documentation.
- The `apks/main.apk` prebuilt binary that `.gitignore` deliberately keeps tracked is not
  touched by this change; the new committed-APK guard is scoped to `.apk`/`.aab` files that CI
  itself now produces and does not remove that pre-existing, intentionally-kept asset.
