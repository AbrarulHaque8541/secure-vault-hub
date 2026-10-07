import type { VaultKind } from "@/components/VaultCard";

/**
 * The vault's read model.
 *
 * A title used to be a plaintext column on the server. It now travels inside
 * the encrypted payload, which means a renderable title only exists while the
 * passphrase is in memory. These helpers are pure so the migration logic that
 * depends on them is unit-testable without a Convex deployment.
 */

/** Shown wherever a title's ciphertext has not been decrypted yet. */
export const LOCKED_TITLE_PLACEHOLDER = "Encrypted entry";

export interface VaultRecordRow {
  /** Stable id from the datastore. */
  id: string;
  kind: VaultKind;
  /** LEGACY plaintext title. Present only on rows created before migration. */
  title?: string;
  /** AES-256-GCM blob holding the real title. */
  titleEncrypted?: string;
  ciphertext: string;
  createdAt: number;
  pinned?: boolean;
  pinnedAt?: number;
}

/** True when the server still holds this row's title in plaintext. */
export function hasLegacyPlaintextTitle(
  row: Pick<VaultRecordRow, "title">,
): boolean {
  return typeof row.title === "string" && row.title.length > 0;
}

/** True when this row's title is stored as ciphertext. */
export function hasEncryptedTitle(
  row: Pick<VaultRecordRow, "titleEncrypted">,
): boolean {
  return (
    typeof row.titleEncrypted === "string" && row.titleEncrypted.length > 0
  );
}

/**
 * Rows that need their plaintext title encrypted. Drives the one-shot upgrade
 * banner, so it must count only rows with no encrypted title yet.
 */
export function legacyTitleCount(
  rows: Array<Pick<VaultRecordRow, "title" | "titleEncrypted">>,
): number {
  return rows.filter(
    (row) => hasLegacyPlaintextTitle(row) && !hasEncryptedTitle(row),
  ).length;
}
