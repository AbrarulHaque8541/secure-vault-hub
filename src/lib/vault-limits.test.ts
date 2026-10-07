import { describe, expect, test } from "bun:test";
import {
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
  clampBody,
  normaliseTitle,
  utf8ByteLength,
} from "../convex/lib/limits";
import { legacyTitleCount } from "./vault-record";

describe("normaliseTitle", () => {
  test("collapses whitespace and trims", () => {
    expect(normaliseTitle("  a\n\n  b\t c ")).toBe("a b c");
  });

  test("truncates to the character budget with a single ellipsis", () => {
    const long = "x".repeat(MAX_TITLE_CHARS * 2);
    const title = normaliseTitle(long);
    expect(title.length).toBe(MAX_TITLE_CHARS);
    expect(title.endsWith("\u2026")).toBe(true);
  });

  test("never splits a surrogate pair", () => {
    // Each emoji is 2 UTF-16 units; forcing the cut mid-pair must back off.
    const emoji = "\u{1f600}";
    const title = normaliseTitle(emoji.repeat(200));
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_CHARS);
    // A lone surrogate would make the string invalid UTF-16.
    for (let i = 0; i < title.length; i++) {
      const code = title.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = title.charCodeAt(i + 1);
        expect(next >= 0xdc00 && next <= 0xdfff).toBe(true);
        i += 1;
      }
    }
  });

  test("passes a short title through unchanged", () => {
    expect(normaliseTitle("Deploy checklist")).toBe("Deploy checklist");
  });
});

describe("clampBody", () => {
  test("leaves a small body alone", () => {
    expect(clampBody("hello")).toBe("hello");
  });

  test("bounds a body by UTF-16 length", () => {
    const body = "y".repeat(MAX_BODY_CHARS + 500);
    expect(clampBody(body).length).toBe(MAX_BODY_CHARS);
  });
});

describe("utf8ByteLength", () => {
  test("counts bytes, not characters", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("\u20b9")).toBe(3);
  });
});

describe("legacyTitleCount", () => {
  test("counts only rows with plaintext and no ciphertext title", () => {
    expect(
      legacyTitleCount([
        { title: "old plaintext" },
        { titleEncrypted: "blob" },
        { title: "", titleEncrypted: "blob" },
        {},
      ]),
    ).toBe(1);
  });

  test("is zero once every row is migrated", () => {
    expect(legacyTitleCount([{ title: "", titleEncrypted: "a" }])).toBe(0);
  });
});
