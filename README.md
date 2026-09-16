<div align="center">

# 🔐 Secure Vault Hub

**Your second brain. Nobody else's.**

A local-first encrypted vault for notes, links, snippets, prompts and tasks —
sealed with AES-256-GCM on your device, with an on-demand local GGUF model
station, a plugin sandbox, and OTA update channels.

`React 19` · `Vite` · `Convex` · `Tailwind v4` · `Capacitor` · `WebCrypto`

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![Release](https://img.shields.io/badge/Release-APK_artifacts-FF641A)](.github/workflows/release.yml)
[![Tests](https://img.shields.io/badge/tests-bun_✓_29_passing-brightgreen)](#testing)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## Table of contents

- [What is this?](#what-is-this)
- [Feature map](#feature-map)
- [Security model](#security-model)
- [Architecture](#architecture)
- [Quick start (web)](#quick-start-web)
- [Building the Android APK](#building-the-android-apk)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security disclosures](#security-disclosures)
- [License](#license)

---

## What is this?

Secure Vault Hub is a **single-user, zero-knowledge personal vault**. You
capture anything — a thought, a URL, a code snippet, a prompt, a task — and it
is encrypted **on your device** before it ever touches the network. The sync
backend stores only opaque ciphertext; not even the database operator can read
your entries.

Beyond the vault, it ships a developer layer: a local GGUF model station that
profiles models against your hardware, a permissioned plugin sandbox with a
live log, and OTA update channels (alpha / beta / stable) — all inside one
dark, minimal, deliberately playful interface.

> **Hidden dev menu:** tap the build figure in the dashboard stat ring
> **7 times**. A countdown appears from the 3rd tap.

## Feature map

| Phase | Feature | Where |
|---|---|---|
| Capture | Universal capture bar with `#note` `#link` `#snippet` `#prompt` `#task` tags; bare URLs auto-file as links | `src/lib/capture.ts`, `src/pages/Dashboard.tsx` |
| Vault | Per-entry AES-256-GCM sealing, pin, edit (re-encrypt on save), filter, search, delete-with-confirm | `src/lib/crypto.ts`, `src/components/VaultCard.tsx` |
| Storage | Owner-scoped CRUD on Convex with per-user indexes; ciphertext-only storage | `src/convex/vault.ts`, `src/convex/schema.ts` |
| Model station | GGUF catalog (Qwen2.5, Llama 3.2, Gemma 2, Phi-3.5) with params/quant/context/license profiles and simulated download lanes | `src/pages/Dashboard.tsx` |
| Power modes | 7-tap hidden dev unlock, master power toggle, plugin sandbox with permission grants/revokes and live terminal log | `src/pages/Dashboard.tsx`, `src/components/AppHeader.tsx` |
| CLI bridge | Termux-style shell-lane plugin (roadmap scaffold) | `src/pages/Dashboard.tsx` |
| OTA engine | Alpha/beta/stable channels, manifest check, staged install with progress | `src/pages/Dashboard.tsx` |
| Theming | Dark-first design system with ember/iris/mint/rose glow cards, dot-matrix numerals, light mode | `src/index.css`, `src/components/theme-provider.tsx` |

## Security model

```
┌──────────────────────────── YOUR DEVICE ────────────────────────────┐
│                                                                     │
│  passphrase ──▶ PBKDF2-SHA256 (210,000 iter, 16-byte random salt)   │
│                     │                                               │
│                     ▼                                               │
│              AES-256-GCM key ──▶ encrypt(plaintext, random 12B IV)  │
│                     │                                               │
│                     ▼                                               │
│         { v:1, kdf, iterations, salt, iv, ct }  ── base64 JSON      │
│                                                                     │
└────────────────────────────────│────────────────────────────────────┘
                                 │  HTTPS (ciphertext only)
                                 ▼
┌──────────────────────────── CONVEX BACKEND ────────────────────────┐
│  vaultItems: userId, title, kind, ciphertext, pinned, timestamps    │
│  • every query/mutation scoped to getAuthUserId(ctx)                │
│  • server CANNOT decrypt: no key ever leaves the device             │
└─────────────────────────────────────────────────────────────────────┘
```

- **Key never leaves the device.** The passphrase lives in memory for the tab
  session only (`src/lib/vault-store.ts`); a refresh locks the vault.
- **No reset link, by design.** Lose the key and the ciphertext is unrecoverable.
- **Integrity.** AES-GCM authentication rejects tampered ciphertext and wrong
  keys with `OperationError` (covered by tests).
- **Per-entry salts and IVs.** Identical plaintexts produce distinct ciphertexts.

## Architecture

| Layer | Tech | Notes |
|---|---|---|
| UI | React 19, Tailwind CSS v4, shadcn/ui, Framer Motion | Lazy-loaded routes |
| State | Convex reactive queries + tiny `useSyncExternalStore` stores | No Redux/Zustand |
| Backend | Convex functions (`src/convex/`) | Auth via `@convex-dev/auth` (email OTP + anonymous) |
| Crypto | WebCrypto (AES-256-GCM, PBKDF2-SHA256) | `src/lib/crypto.ts` |
| Mobile shell | Capacitor 8 (Android) | `capacitor.config.ts`, `android/` |
| Tests | Bun test runner | `src/lib/*.test.ts` |
| CI/CD | GitHub Actions | lint + typecheck + tests + APK release artifacts |

## Quick start (web)

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.1, a [Convex](https://convex.dev) account (free tier is fine).

```bash
# 1. install
bun install

# 2. start the Convex backend (creates/links a deployment, generates types)
bunx convex dev --once
#    → for continuous dev: bunx convex dev

# 3. run the web app
bun run dev
```

Open the printed URL (default `http://localhost:5173`), choose
**Continue as guest** on the auth page, capture something, and tap the build
figure 7 times to open the developer layer.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | yes | Convex deployment URL (written by `convex dev`) in `.env.local` |

Email-OTP sign-in works out of the box through the bundled provider; anonymous
sign-in needs no configuration. No other secrets are required for local dev.

## Building the Android APK

**Prerequisites:** JDK 17, Android SDK (or Android Studio), and one of
`bun`/`npm`. On first run Gradle downloads itself via the wrapper.

```bash
# 1. build the web assets and sync them into the native shell
bun run cap:sync          # = vite build && cap sync android

# 2a. debug APK (signed with the debug key, installable immediately)
bun run apk:debug
#    → android/app/build/outputs/apk/debug/app-debug.apk

# 2b. release APK (unsigned; see signing note below)
bun run apk:release
#    → android/app/build/outputs/apk/release/app-release-unsigned.apk
```

**Or skip all of it — download a prebuilt APK from
[GitHub Releases](../../releases).** Every tag triggers a workflow that builds
and attaches debug + release APKs automatically.

### Signing a release build

Create `android/keystore.properties` (git-ignored):

```properties
storeFile=/absolute/path/to/your-release-key.jks
storePassword=••••••
keyAlias=your-alias
keyPassword=••••••
```

Generate a key once with:

```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-alias
```

**Never commit keystores or `keystore.properties`.** They are already in
[.gitignore](.gitignore).

## Testing

```bash
bun test src/lib     # 29 unit tests
bun run typecheck    # strict TS across the app
bun run lint         # eslint
```

The suite covers the pieces where correctness matters most:

- **Crypto**: round-trips, wrong-key rejection (`OperationError`), tampered
  ciphertext rejection, fresh salt/IV per encryption, KDF iteration floor.
- **Capture parsing**: every kind tag, case-insensitivity, tag-position rules,
  bare-URL auto-linking, title truncation.
- **Vault store**: lock/unlock lifecycle, key replacement, subscriber events.
- **Base64**: round-trips and standard fixtures.

## Project structure

```
├── android/                  # Capacitor Android shell (Gradle project)
├── public/                   # Static assets, PWA manifest
├── src/
│   ├── components/           # AppHeader, VaultCard, UnlockDialog, ui/ (shadcn)
│   ├── convex/               # Backend: schema, auth, vault CRUD
│   │   ├── schema.ts         #   users + authTables + vaultItems (indexed)
│   │   ├── vault.ts          #   owner-scoped list/create/update/remove
│   │   └── auth/             #   email OTP provider config
│   ├── hooks/                # use-auth
│   ├── lib/
│   │   ├── crypto.ts         # AES-256-GCM + PBKDF2 envelope encryption
│   │   ├── capture.ts        # capture-bar parsing (tags, URL detection)
│   │   ├── vault-store.ts    # session-only key store (useSyncExternalStore)
│   │   ├── base64.ts         # base64 helpers
│   │   └── *.test.ts         # bun unit tests for the above
│   └── pages/                # Landing, Auth, Dashboard, NotFound
├── capacitor.config.ts       # native shell config (appId, webDir)
├── .github/workflows/        # ci.yml (checks) + release.yml (APK artifacts)
└── index.html                # entry (pre-paint dark theme script)
```

## Roadmap

- [ ] Real GGUF loading via `wllama`/`llama.cpp` WASM in the model station
- [ ] Signed OTA manifests with delta patching
- [ ] iOS shell (`cap add ios`)
- [ ] Vault export/import as an encrypted archive
- [ ] Biometric unlock on Android (Keystore-wrapped key)

See [CHANGELOG.md](CHANGELOG.md) for shipped work.

## Contributing

PRs welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) first. Keep PRs focused,
add tests for pure logic, and run `bun test src/lib && bun run typecheck`
before pushing.

## Security disclosures

Found a vulnerability? Please **do not open a public issue** — follow
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Secure Vault Hub contributors

---

<div align="center">

*Built for one. Yours.*

</div>
