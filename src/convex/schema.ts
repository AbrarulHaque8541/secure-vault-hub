import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // Encrypted local vault entries. The server only ever sees opaque
    // ciphertext produced on-device with AES-256-GCM (see src/lib/crypto.ts).
    vaultItems: defineTable({
      userId: v.id("users"),
      title: v.string(),
      kind: v.union(
        v.literal("note"),
        v.literal("link"),
        v.literal("snippet"),
        v.literal("prompt"),
        v.literal("task"),
      ),
      ciphertext: v.string(), // JSON EncryptedPayload (opaque base64 blob)
      hints: v.optional(v.array(v.string())),
      pinned: v.optional(v.boolean()),
      pinnedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_user_pinned", ["userId", "pinnedAt"]),

    // One row per identifier that has requested an email OTP, holding the
    // timestamps of recent requests. The OTP is 6 digits and valid for 15
    // minutes, so bounding attempts is the control that actually closes the
    // guessing window (see src/convex/lib/otpRateLimit.ts).
    otpRateLimits: defineTable({
      identifier: v.string(), // normalised (trimmed + lowercased)
      attempts: v.array(v.number()), // ms timestamps, pruned to the longest window
      updatedAt: v.number(),
    }).index("by_identifier", ["identifier"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
