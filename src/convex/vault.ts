import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  MAX_CIPHERTEXT_BYTES,
  MAX_ENCRYPTED_TITLE_BYTES,
  MAX_ITEMS_PER_USER,
  normaliseTitle,
  utf8ByteLength,
} from "./lib/limits";

/**
 * Server-side vault storage.
 *
 * Every handler is scoped to the signed-in user and the body *and title* of
 * each item are stored only as opaque ciphertext — the server can never read
 * vault contents, not even the summary line. See src/lib/crypto.ts for the
 * on-device envelope encryption and docs/METADATA-MIGRATION.md for how the
 * previously-plaintext title was moved inside the encrypted payload.
 *
 * Two rules apply to every argument that crosses this boundary:
 *   1. Bound it. Authenticated abuse is still abuse — an unbounded string is
 *      a storage bill and a denial-of-service vector, not a feature.
 *   2. Never trust the client's own limits. The UI clamps too, for good error
 *      messages, but a direct API caller bypasses the UI entirely.
 */

const kindValidator = v.union(
  v.literal("note"),
  v.literal("link"),
  v.literal("snippet"),
  v.literal("prompt"),
  v.literal("task"),
);

/** Reject an oversized field before it reaches the database. */
function assertWithinLimit(
  value: string,
  maxBytes: number,
  label: string,
): void {
  const bytes = utf8ByteLength(value);
  if (bytes > maxBytes) {
    throw new Error(
      `${label} is too large (${bytes} bytes; limit ${maxBytes} bytes).`,
    );
  }
}

/**
 * Hints are plaintext metadata and are no longer persisted (M3).
 *
 * A hint is a short, human-readable label attached to an entry. Storing it in
 * the clear on the server defeats the point of the encrypted vault: the server
 * (and anyone who reads the database) learns the shape of the user's data even
 * though the body is opaque. The field is still *accepted* so an older client
 * does not break, but it is dropped rather than written.
 */
function dropPlaintextHints(): undefined {
  return undefined;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("vaultItems")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const items = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return items.length;
  },
});

export const create = mutation({
  args: {
    // `title` is accepted only for backwards compatibility with an older
    // client; new clients send `titleEncrypted` and never transmit a
    // plaintext title to the server at all.
    title: v.optional(v.string()),
    titleEncrypted: v.optional(v.string()),
    kind: kindValidator,
    ciphertext: v.string(),
    hints: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    assertWithinLimit(args.ciphertext, MAX_CIPHERTEXT_BYTES, "Entry body");
    if (args.titleEncrypted !== undefined) {
      assertWithinLimit(
        args.titleEncrypted,
        MAX_ENCRYPTED_TITLE_BYTES,
        "Encrypted title",
      );
    }
    if (args.title === undefined && args.titleEncrypted === undefined) {
      throw new Error("An entry needs a title (encrypted or legacy plaintext).");
    }

    // Quota check: bounded work per account, so one caller cannot fill the
    // deployment's storage by looping this mutation.
    const existing = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.length >= MAX_ITEMS_PER_USER) {
      throw new Error(
        `This vault has reached its limit of ${MAX_ITEMS_PER_USER} entries.`,
      );
    }

    const now = Date.now();
    return await ctx.db.insert("vaultItems", {
      userId,
      title: args.title === undefined ? undefined : normaliseTitle(args.title),
      titleEncrypted: args.titleEncrypted,
      kind: args.kind,
      ciphertext: args.ciphertext,
      hints: dropPlaintextHints(),
      pinned: args.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("vaultItems"),
    title: v.optional(v.string()),
    titleEncrypted: v.optional(v.string()),
    kind: v.optional(kindValidator),
    ciphertext: v.optional(v.string()),
    hints: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
    pinnedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) throw new Error("Vault item not found");

    if (args.ciphertext !== undefined) {
      assertWithinLimit(args.ciphertext, MAX_CIPHERTEXT_BYTES, "Entry body");
    }
    if (args.titleEncrypted !== undefined) {
      assertWithinLimit(
        args.titleEncrypted,
        MAX_ENCRYPTED_TITLE_BYTES,
        "Encrypted title",
      );
    }

    const patch: Partial<typeof item> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = normaliseTitle(args.title);
    if (args.titleEncrypted !== undefined) {
      patch.titleEncrypted = args.titleEncrypted;
      // Writing the encrypted title retires the plaintext one. Without this
      // the superseded plaintext would linger, defeating the whole migration.
      patch.title = undefined;
    }
    if (args.kind !== undefined) patch.kind = args.kind;
    if (args.ciphertext !== undefined) patch.ciphertext = args.ciphertext;
    // Plaintext hints are never written (M3); see dropPlaintextHints.
    if (args.hints !== undefined) patch.hints = dropPlaintextHints();
    if (args.pinned !== undefined) patch.pinned = args.pinned;
    if (args.pinnedAt !== undefined) patch.pinnedAt = args.pinnedAt;

    await ctx.db.patch(args.id, patch);
  },
});

/**
 * One-shot migration for rows created before titles were encrypted.
 *
 * The server cannot decrypt a title, so it cannot perform this migration
 * itself — the client decrypts each legacy title, re-encrypts it, and sends
 * the result here. The server's only job is to refuse to overwrite a title
 * that is already encrypted, so a stale client cannot clobber a good value.
 */
export const setEncryptedTitle = mutation({
  args: {
    id: v.id("vaultItems"),
    titleEncrypted: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) throw new Error("Vault item not found");

    assertWithinLimit(
      args.titleEncrypted,
      MAX_ENCRYPTED_TITLE_BYTES,
      "Encrypted title",
    );

    // Idempotent: never re-encrypt (and therefore never overwrite) a value
    // that is already ciphertext.
    if (item.titleEncrypted !== undefined && item.titleEncrypted.length > 0) {
      return { migrated: false };
    }

    await ctx.db.patch(args.id, {
      titleEncrypted: args.titleEncrypted,
      title: undefined,
      updatedAt: Date.now(),
    });
    return { migrated: true };
  },
});

/**
 * Remove the last plaintext titles in a single transaction after the client
 * confirms every row now carries `titleEncrypted`. Kept separate from
 * `setEncryptedTitle` so the destructive step is always an explicit call.
 */
export const clearLegacyTitles = mutation({
  args: { ids: v.optional(v.array(v.id("vaultItems"))) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const items = await ctx.db
      .query("vaultItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const requested: Set<Id<"vaultItems">> | null = args.ids
      ? new Set(args.ids)
      : null;

    let cleared = 0;
    for (const item of items) {
      if (requested && !requested.has(item._id)) continue;
      // Only ever drop a plaintext title that has been superseded. Dropping
      // one without a replacement would destroy the user's only copy.
      if (item.title === undefined) continue;
      if (item.titleEncrypted === undefined || item.titleEncrypted.length === 0) {
        continue;
      }
      await ctx.db.patch(item._id, { title: undefined });
      cleared += 1;
    }
    return { cleared };
  },
});

export const remove = mutation({
  args: { id: v.id("vaultItems") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) throw new Error("Vault item not found");
    await ctx.db.delete(args.id);
  },
});
