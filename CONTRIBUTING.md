# Contributing to Secure Vault Hub

Thanks for helping build the vault. This guide keeps the codebase consistent.

## Getting started

```bash
git clone <your-fork-url>
cd secure-vault-hub
bun install
bunx convex dev --once   # links/creates a Convex deployment, generates types
bun run dev
```

## Before you push

Run all three — CI runs the same set:

```bash
bun test src/lib      # unit tests
bun run typecheck     # strict TypeScript
bun run lint          # eslint
```

## Ground rules

1. **Tests for pure logic.** Anything in `src/lib/` that isn't a React
   component should have coverage in a sibling `*.test.ts`. Crypto changes
   without tests will be rejected.
2. **Never touch crypto semantics casually.** Changes to `src/lib/crypto.ts`
   (algorithms, iteration counts, payload shape) require a changelog entry and
   a migration note — old ciphertext must keep decrypting.
3. **Owner scoping is mandatory.** Every new Convex handler must call
   `getAuthUserId(ctx)` and verify document ownership before read/write.
4. **Keep the plaintext on the device.** No new code path may send vault
   content, the passphrase, or derived key material over the network.
5. **Respect the design system.** Use existing tokens/utilities from
   `src/index.css` (`glow-card`, `glass`, accent variables) before inventing
   new ones.
6. **Don't edit generated code.** `src/convex/_generated/` and
   `android/app/src/main/assets/public/` are build outputs.

## Commit style

Short imperative subject, blank line, then the *why*:

```
Restore URL auto-linking lost in capture refactor
```

## Pull requests

- One logical change per PR.
- Fill in the PR template; link related issues.
- New features should update `README.md` and `CHANGELOG.md`.

## Reporting bugs

Open an issue with: expected vs actual behavior, steps to reproduce, browser
or device, and console output. Security issues → [SECURITY.md](SECURITY.md).
