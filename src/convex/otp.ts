import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  checkOtpRateLimit,
  normaliseIdentifier,
  pruneAttempts,
  rateLimitMessage,
} from "./lib/otpRateLimit";

/**
 * Server-side rate limit for email OTP requests.
 *
 * ## Why a mutation and not a client check
 *
 * The OTP is 6 digits and valid for 15 minutes. A client-side counter is not a
 * control — anyone can call the auth endpoint directly. This mutation is the
 * enforcement point, and the provider calls it *before* it sends anything (see
 * `src/convex/auth/emailOtp.ts`), so a request that is over the limit never
 * reaches the mail provider.
 *
 * ## Atomicity
 *
 * The check and the record happen in one mutation, which Convex serialises per
 * document. Two concurrent requests for the same identifier therefore cannot
 * both read "2 attempts" and both proceed — the second sees the first's write.
 *
 * ## Privacy
 *
 * The row is keyed by the normalised email address. It holds only timestamps,
 * never the code, and is pruned to the longest window on every write.
 */
export const requestCode = mutation({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const identifier = normaliseIdentifier(args.identifier);
    if (identifier.length === 0) {
      throw new Error("An email address is required.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("otpRateLimits")
      .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
      .unique();

    const attempts = existing ? pruneAttempts(existing.attempts, now) : [];
    const decision = checkOtpRateLimit(attempts, now);

    if (!decision.allowed) {
      // The message is deliberately the same shape for both limits, so a
      // caller cannot use the wording to map the policy.
      throw new Error(rateLimitMessage(decision));
    }

    const next = [...attempts, now];
    if (existing) {
      await ctx.db.patch(existing._id, { attempts: next, updatedAt: now });
    } else {
      await ctx.db.insert("otpRateLimits", {
        identifier,
        attempts: next,
        updatedAt: now,
      });
    }

    return { allowed: true as const };
  },
});
