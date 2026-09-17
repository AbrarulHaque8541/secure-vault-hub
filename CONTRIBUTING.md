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

One command — it runs exactly what CI runs (typecheck, lint, tests, build):

```bash
bun run verify
```

If it's green locally, CI will be green. CI additionally guards against
tracked secret files (`.env*`, keystores) and missing Convex generated types.

**Changed anything under `src/convex/`?** Run `bunx convex codegen` and
**commit** the regenerated `src/convex/_generated/` files — CI cannot run
codegen itself (it needs deployment auth), so uncommitted types break CI.

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
6. **Generated code is committed, never hand-edited.** `src/convex/_generated/`
   and `android/app/src/main/assets/public/` are build outputs — regenerate
   them (`bunx convex codegen`, `bun run cap:sync`), never edit by hand, and
   always commit the regenerated result so CI stays deterministic.

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
