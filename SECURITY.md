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
- `android/` — WebView settings, mixed content, debugging flags

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
