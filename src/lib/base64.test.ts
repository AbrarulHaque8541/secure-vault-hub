import { describe, expect, test } from "bun:test";
import { base64ToBytes, bytesToBase64 } from "./base64";

describe("base64 round-trip", () => {
  test("round-trips empty input", () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
    expect(base64ToBytes("")).toEqual(new Uint8Array(0));
  });

  test("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  test("produces standard base64 output", () => {
    // "hello" is a well-known base64 fixture.
    expect(bytesToBase64(new TextEncoder().encode("hello"))).toBe("aGVsbG8=");
  });
});
