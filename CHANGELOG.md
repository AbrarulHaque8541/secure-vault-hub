# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-09-16

### Added

- **Encrypted vault** — universal capture bar (`#note` `#link` `#snippet`
  `#prompt` `#task` tags; bare URLs auto-file as links), AES-256-GCM envelope
  encryption (PBKDF2-SHA256, 210k iterations) via WebCrypto, per-entry pin,
  edit with re-encryption, kind filters, search, delete-with-confirm.
- **Zero-knowledge storage** — owner-scoped CRUD on Convex
  (`vaultItems` with `by_user_created` / `by_user_pinned` indexes); the server
  stores ciphertext only.
- **Session key model** — passphrase held in memory for the tab session
  (`useSyncExternalStore`-backed store); refresh locks the vault.
- **Hidden developer layer** — 7 taps on the build figure unlock the dev menu:
  master power toggle, on-demand GGUF model station (Qwen2.5, Llama 3.2,
  Gemma 2, Phi-3.5 profiles with simulated download lanes), permissioned
  plugin sandbox with live log, Termux-style CLI bridge plugin, and an OTA
  engine with alpha/beta/stable channels and staged installs.
- **Android packaging** — Capacitor 8 shell; `bun run apk:debug` /
  `apk:release` produce installable APKs; GitHub Releases workflow attaches
  artifacts on every tag.
- **Design system** — dark-first "Afterglow" theme: ember/iris/mint/rose glow
  cards, dot-matrix numerals (Doto), frosted-glass panels, aurora backdrop,
  full light mode with pre-paint theme script.
- **CI** — GitHub Actions workflow: typecheck + lint + unit tests on every
  push/PR; release workflow builds APK artifacts on tags.
- **Docs** — README with architecture and security model, CONTRIBUTING,
  SECURITY policy, MIT license.

### Tests

- 29 unit tests across crypto, capture parsing, vault store, and base64 —
  including wrong-key and tampered-ciphertext rejection guarantees.

[1.0.0]: https://github.com/YOUR_USERNAME/secure-vault-hub/releases/tag/v1.0.0
