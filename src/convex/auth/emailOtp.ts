import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { describeSendFailure } from "../lib/redact";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    // The key is a Convex environment secret. It must never be hardcoded: this
    // repository is public, and a key in source is a key that has leaked.
    // Set it with: npx convex env set FREEBUFF_EMAIL_API_KEY
    const apiKey = process.env.FREEBUFF_EMAIL_API_KEY?.trim();
    if (!apiKey) {
      // Fail closed and loudly. A dev fallback key here would silently ship a
      // known credential to production, which is how the original leak
      // became exploitable rather than merely embarrassing.
      throw new Error(
        "FREEBUFF_EMAIL_API_KEY is not configured — email sign-in is unavailable.",
      );
    }

    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            "x-api-key": apiKey,
          },
          // Bound the call so a hung provider cannot hold the auth request
          // open indefinitely.
          timeout: 10_000,
        },
      );
    } catch (err) {
      // NEVER re-throw or log `err` directly. An axios error carries the whole
      // request: URL, the `x-api-key` header, and the body — which for this
      // call is the live one-time passcode. The previous
      // `throw new Error(JSON.stringify(error))` did exactly that, so the code
      // and the key were handed to whoever triggered the failure.
      const classification = describeSendFailure(err);
      console.error(`[email-otp] provider send failed: ${classification}`);

      // The client gets one opaque message: no status, no code, and therefore
      // no way to tell a bad key from a bad address by probing.
      throw new Error("Failed to send verification code. Please try again.");
    }
  },
});
