import { describe, expect, test } from "bun:test";
import {
  decryptString,
  encryptString,
  isVaultError,
  PBKDF2_ITERATIONS,
  type EncryptedPayload,
} from "./crypto";

describe("encryptString / decryptString", () => {
  test("round-trips a plaintext", async () => {
    const payload = await encryptString("hello vault", "correct horse battery staple");
    expect(await decryptString(payload, "correct horse battery staple")).toBe("hello vault");
  });

  test("round-trips empty and multiline content", async () => {
    const key = "session key";
    for (const text of ["", "line one\nline two\n\nline four"]) {
      const payload = await encryptString(text, key);
      expect(await decryptString(payload, key)).toBe(text);
    }
  });

  test("payload carries versioned metadata", async () => {
    const payload = await encryptString("data", "key");
    expect(payload.v).toBe(1);
    expect(payload.kdf).toBe("PBKDF2-SHA256");
    expect(payload.iterations).toBe(PBKDF2_ITERATIONS);
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(210_000);
  });

  test("uses a fresh salt and IV every time", async () => {
    const a = await encryptString("same text", "same key");
    const b = await encryptString("same text", "same key");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  test("ciphertext does not contain the plaintext", async () => {
    const payload = await encryptString("top secret words", "key");
    expect(payload.ct).not.toContain("top secret words");
  });

  test("rejects a wrong key with OperationError", async () => {
    const payload = await encryptString("locked", "right key");
    await expect(decryptString(payload, "wrong key")).rejects.toMatchObject({
      name: "OperationError",
    });
    try {
      await decryptString(payload, "wrong key");
      expect.unreachable();
    } catch (err) {
      expect(isVaultError(err)).toBe(true);
    }
  });

  test("rejects tampered ciphertext", async () => {
    const payload = await encryptString("integrity matters", "key");
    const bytes = Uint8Array.from(atob(payload.ct), (c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const tampered: EncryptedPayload = { ...payload, ct: btoa(String.fromCharCode(...bytes)) };
    await expect(decryptString(tampered, "key")).rejects.toMatchObject({
      name: "OperationError",
    });
  });
});
