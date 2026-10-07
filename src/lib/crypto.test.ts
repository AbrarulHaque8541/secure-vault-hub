import { describe, expect, test } from "bun:test";
import {
  clearKeyCache,
  decryptString,
  decryptStringWithinBudget,
  encryptString,
  isVaultError,
  keyCacheSize,
  MAX_ACCEPTED_ITERATIONS,
  MIN_ACCEPTED_ITERATIONS,
  PBKDF2_ITERATIONS,
  vaultAad,
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

describe("decryptStringWithinBudget", () => {
  test("decrypts a freshly produced payload", async () => {
    const payload = await encryptString("bounded", "key");
    expect(await decryptStringWithinBudget(payload, "key")).toBe("bounded");
  });

  test("lets in-band iteration counts through to the decrypt step", async () => {
    // The guard's job is to refuse *out-of-band* parameters before any key
    // derivation. An in-band value therefore must fail on the AEAD (wrong key
    // for that count), not on the iteration guard — which is exactly how we
    // can prove the boundary is where it claims to be.
    const payload = await encryptString("edges", "key");
    for (const iterations of [MIN_ACCEPTED_ITERATIONS, MAX_ACCEPTED_ITERATIONS]) {
      await expect(
        decryptStringWithinBudget({ ...payload, iterations }, "key"),
      ).rejects.toMatchObject({ name: "OperationError" });
    }
  });

  test("refuses an absurd iteration count instead of grinding", async () => {
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, iterations: 4_000_000_000 }, "key"),
    ).rejects.toThrow(/iterations/);
  });

  test("refuses an iteration count below the floor", async () => {
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, iterations: 1 }, "key"),
    ).rejects.toThrow(/iterations/);
  });

  test("refuses a non-integer iteration count", async () => {
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, iterations: 210_000.5 }, "key"),
    ).rejects.toThrow(/iterations/);
  });

  test("refuses an unsupported key derivation function", async () => {
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, kdf: "ROT13" as never }, "key"),
    ).rejects.toThrow(/Unsupported/);
  });

  test("refuses a malformed payload", async () => {
    await expect(
      decryptStringWithinBudget(null as never, "key"),
    ).rejects.toThrow(/Malformed/);
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, salt: "" }, "key"),
    ).rejects.toThrow(/Malformed/);
  });

  test("refuses a ciphertext shorter than the GCM tag", async () => {
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, ct: "AAAA" }, "key"),
    ).rejects.toThrow(/implausible/);
  });

  test("still reports a wrong key as OperationError", async () => {
    const payload = await encryptString("locked", "right key");
    await expect(
      decryptStringWithinBudget(payload, "wrong key"),
    ).rejects.toMatchObject({ name: "OperationError" });
  });
});

/**
 * H3: PBKDF2 at 210k iterations costs ~25 ms, and the original code re-derived
 * the key for every operation. Revealing a 20-card list therefore spent half a
 * second re-deriving the same key 20 times. The cache is keyed by the full
 * derivation input, so correctness is unchanged — only the cost.
 */
describe("derived-key cache (H3)", () => {
  test("reuses the key for a repeated (passphrase, salt) pair", async () => {
    clearKeyCache();
    const payload = await encryptString("cached", "key");
    expect(keyCacheSize()).toBe(1);
    // Decrypting the same payload again must not add a second entry.
    expect(await decryptString(payload, "key")).toBe("cached");
    expect(keyCacheSize()).toBe(1);
  });

  test("a different passphrase gets its own key", async () => {
    clearKeyCache();
    const a = await encryptString("a", "key one");
    const b = await encryptString("b", "key two");
    expect(await decryptString(a, "key one")).toBe("a");
    expect(await decryptString(b, "key two")).toBe("b");
    expect(keyCacheSize()).toBe(2);
  });

  test("a different salt gets its own key", async () => {
    clearKeyCache();
    const a = await encryptString("a", "key");
    const b = await encryptString("b", "key");
    expect(a.salt).not.toBe(b.salt);
    expect(await decryptString(a, "key")).toBe("a");
    expect(await decryptString(b, "key")).toBe("b");
    expect(keyCacheSize()).toBe(2);
  });

  test("a wrong key still fails with a cached key present", async () => {
    clearKeyCache();
    const payload = await encryptString("locked", "right key");
    await expect(decryptString(payload, "wrong key")).rejects.toMatchObject({
      name: "OperationError",
    });
  });

  test("clearKeyCache empties the cache", async () => {
    await encryptString("x", "key");
    expect(keyCacheSize()).toBeGreaterThan(0);
    clearKeyCache();
    expect(keyCacheSize()).toBe(0);
  });
});

/**
 * M8: without additional authenticated data, a server that swaps two users'
 * ciphertext blobs is undetectable — both decrypt cleanly under their own
 * owner's key. Binding the account id into the tag makes the swap fail.
 */
describe("account-bound ciphertexts (M8)", () => {
  const alice = vaultAad("user_alice");
  const bob = vaultAad("user_bob");

  test("round-trips when the same AAD is supplied", async () => {
    const payload = await encryptString("alice's secret", "key", alice);
    expect(payload.v).toBe(2);
    expect(await decryptString(payload, "key", alice)).toBe("alice's secret");
  });

  test("refuses to decrypt under a different account's AAD", async () => {
    const payload = await encryptString("alice's secret", "key", alice);
    await expect(decryptString(payload, "key", bob)).rejects.toMatchObject({
      name: "OperationError",
    });
  });

  test("refuses a bound payload when no AAD is supplied", async () => {
    const payload = await encryptString("alice's secret", "key", alice);
    await expect(decryptString(payload, "key")).rejects.toThrow(/account/);
  });

  test("legacy v1 payloads still decrypt without an AAD", async () => {
    const payload = await encryptString("legacy", "key");
    expect(payload.v).toBe(1);
    expect(await decryptString(payload, "key")).toBe("legacy");
    // Supplying an AAD for a v1 payload is ignored, not an error.
    expect(await decryptString(payload, "key", alice)).toBe("legacy");
  });

  test("the budgeted path enforces the same binding", async () => {
    const payload = await encryptString("bound", "key", alice);
    expect(await decryptStringWithinBudget(payload, "key", alice)).toBe("bound");
    await expect(
      decryptStringWithinBudget(payload, "key", bob),
    ).rejects.toMatchObject({ name: "OperationError" });
  });

  test("refuses an unknown envelope version", async () => {
    const payload = await encryptString("x", "key");
    await expect(
      decryptStringWithinBudget({ ...payload, v: 3 as never }, "key"),
    ).rejects.toThrow(/version/);
  });
});
