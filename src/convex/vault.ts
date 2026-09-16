import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side vault storage. Every handler is scoped to the signed-in user
 * and the body of each item is stored only as opaque ciphertext — the server
 * can never read vault contents.
 */

const kindValidator = v.union(
  v.literal("note"),
  v.literal("link"),
  v.literal("snippet"),
  v.literal("prompt"),
  v.literal("task"),
);

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
    title: v.string(),
    kind: kindValidator,
    ciphertext: v.string(),
    hints: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const now = Date.now();
    return await ctx.db.insert("vaultItems", {
      userId,
      title: args.title.slice(0, 180),
      kind: args.kind,
      ciphertext: args.ciphertext,
      hints: args.hints,
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

    const patch: Partial<typeof item> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.slice(0, 180);
    if (args.kind !== undefined) patch.kind = args.kind;
    if (args.ciphertext !== undefined) patch.ciphertext = args.ciphertext;
    if (args.hints !== undefined) patch.hints = args.hints;
    if (args.pinned !== undefined) patch.pinned = args.pinned;
    if (args.pinnedAt !== undefined) patch.pinnedAt = args.pinnedAt;

    await ctx.db.patch(args.id, patch);
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
