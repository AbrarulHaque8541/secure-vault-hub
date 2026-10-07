# Encrypting vault metadata (titles and kind)

## Why

The README describes Secure Vault Hub as a **zero-knowledge** vault: "not even
the database operator can read your entries". Only the body was encrypted.
`vaultItems.title` was a plaintext column, and `kind` was stored in the clear,
so the server could read the headline and type of every entry. That made the
central product claim false — a worse problem than the leak it hid behind.

## Target shape

| Field | Storage | Readable by server |
|---|---|---|
| `title` | LEGACY plaintext, optional, @deprecated | yes (only for un-migrated rows) |
| `titleEncrypted` | AES-256-GCM blob of `{ title, kind }` | no |
| `kind` | plaintext union | yes (kept: the client needs it for filtering before unlock) |
| `ciphertext` | AES-256-GCM blob of the body | no |

`kind` is deliberately left in the clear. It is one of five low-entropy
values and the vault cannot be rendered at all without it, so encrypting it
trades a marginal privacy gain for a large usability cost. The encrypted
metadata blob still carries `kind`, so a future release can move it across
without another schema change.

## Rollout — expand and contract

**Phase 1 (this change) — expand.**

1. Add `titleEncrypted`; make `title` optional. Existing documents keep
   validating, because `schemaValidation: true` only checks what fields are
   present, and both shapes are accepted.
2. New writes send `titleEncrypted` and no plaintext `title` at all.
3. The client performs a one-time fix-up on first unlock: for every row with a
   plaintext title and no ciphertext, it encrypts `{ title, kind }` and calls
   `setEncryptedTitle`.
4. `setEncryptedTitle` refuses to overwrite existing ciphertext, so a stale
   tab or a retried call can never clobber a good value (idempotent).
5. `clearLegacyTitles` then drops plaintext titles, but only for rows that
   already have a ciphertext replacement. A row without a replacement is left
   untouched — losing a title with no replacement would destroy the user's
   only copy of it.

**Phase 2 (follow-up release) — contract.**

Once `legacyTitleCount` is zero for every deployment, remove `title` from
`schema.ts` and the legacy branches in `vault.ts` / `Dashboard.tsx`. Do not
rush this: a deployment that still holds plaintext rows will fail validation
on deploy if the field is removed first.

## Verification

```bash
bun run typecheck && bun test src/lib
```

Then, against a real deployment:

1. Sign in and unlock — the upgrade banner should appear once, then never
   again for that account.
2. Inspect the `vaultItems` documents: every migrated row must have a
   `titleEncrypted` value and **no** `title`.
3. Lock the vault and reload: titles must render as `Encrypted entry` until
   the passphrase is entered. A title visible while locked means the
   plaintext column is still being read somewhere.

## Rollback

Phase 1 is additive, so reverting the client is safe: the plaintext `title`
of already-migrated rows is gone, but `titleEncrypted` remains and the
previous client version ignores it — those rows show as untitled until the
new client returns. There is no data loss and no schema migration to undo.
