# Release signing

The release workflow (`.github/workflows/release.yml`) builds, signs and publishes the Android
APK/AAB. Signing is **fail-closed**: with no credentials the pipeline stops before producing
anything, so an unsigned artifact can no longer be attached to a release.

## Credentials

Configure these as protected repository secrets:

| Secret | Meaning |
|---|---|
| `KEYSTORE_BASE64` | The release JKS, base64-encoded (`base64 -w0 svh-release.jks`) |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias inside the keystore |
| `KEY_PASSWORD` | Password for that alias |

The workflow decodes `KEYSTORE_BASE64` into `android/release/secure-vault-hub-release.jks`,
exports the four `RELEASE_*` environment variables that `android/variables.gradle` reads, and
deletes the decoded keystore in an `always()` step so it never lingers on the runner.

## Fail-closed contract

`android/app/build.gradle` registers a `gradle.taskGraph.whenReady` guard: when
`rootProject.ext.hasReleaseSigning` is false, any of `assembleRelease`, `bundleRelease` or
`packageRelease` throws

```
Production release signing is not configured. Set RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD,
RELEASE_KEY_ALIAS and RELEASE_KEY_PASSWORD before building a release variant ... Refusing to
produce an unsigned production artifact.
```

Debug builds are unaffected (`./gradlew assembleDebug` still works with no secrets).

## Creating the keystore (one time)

```bash
keytool -genkeypair -v \
  -keystore svh-release.jks -alias securevault \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Secure Vault Hub, OU=Release, O=SecureVaultHub, C=IN"
base64 -w0 svh-release.jks   # → KEYSTORE_BASE64
```

## Upgrade implications

- The signing certificate is the app's identity for updates. Changing it after the first
  production release makes every existing install non-upgradable in place (Android rejects a
  signature change), so users must uninstall — which erases the local vault unless they exported
  a backup first. Keep the keystore safe and backed up.
- v2/v3 signature schemes are enabled, so verification on Android 7+ requires the same signer.
- Any APK published before this workflow was signed with a debug/unsigned key and must not be
  treated as a trusted production build.
