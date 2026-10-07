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

      /**
       * LEGACY plaintext title.
       *
       * @deprecated Titles are now stored in `titleEncrypted` so the server
       * cannot read them. This field is kept optional (not removed) because
       * existing deployments still hold documents that use it — removing it
       * outright would fail validation and block the deploy. Rows created
       * before the upgrade are migrated by the client's one-time fix-up, and
       * this field can be dropped in a follow-up release (expand-and-contract).
       * See docs/METADATA-MIGRATION.md.
       */
      title: v.optional(v.string()),

      /**
       * AES-256-GCM blob (JSON `EncryptedPayload`, base64) holding the real
       * title. Optional so documents written before this field existed still
       * validate while the migration is in flight.
       */
      titleEncrypted: v.optional(v.string()),

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
  },
  {
    // Documents are validated against this schema at the database layer.
    //
    // It was disabled to let early development write whatever it liked. That
    // also meant a malformed document — a missing field, a wrong type — was
    // accepted silently and only surfaced as a render crash much later. Every
    // optional field above exists so existing rows validate: enable this only
    // after confirming no stored document contradicts the schema.
    schemaValidation: true,
  },
);

export default schema;
