import { describe, expect, test } from "bun:test";
import { parseCapture, titleFor } from "./capture";

describe("parseCapture", () => {
  test("defaults to note kind without a tag", () => {
    expect(parseCapture("weekly review")).toEqual({
      kind: "note",
      body: "weekly review",
    });
  });

  test("parses each known kind tag and strips it from the body", () => {
    const cases: Array<[string, string]> = [
      ["#note buy oat milk", "note"],
      ["#link https://example.com", "link"],
      ["#snippet const x = 1", "snippet"],
      ["#prompt summarize this", "prompt"],
      ["#task deploy checklist", "task"],
    ];
    for (const [input, kind] of cases) {
      expect(parseCapture(input).kind).toBe(kind);
    }
    expect(parseCapture("#task deploy checklist").body).toBe("deploy checklist");
  });

  test("is case-insensitive on the tag", () => {
    expect(parseCapture("#TASK deploy checklist")).toEqual({
      kind: "task",
      body: "deploy checklist",
    });
  });

  test("only honors a tag at the start of the input", () => {
    expect(parseCapture("remember to #task later")).toEqual({
      kind: "note",
      body: "remember to #task later",
    });
  });

  test("requires a word boundary after the tag", () => {
    // "#tasks" is not a known kind; the whole text stays the body.
    expect(parseCapture("#tasks later")).toEqual({
      kind: "note",
      body: "#tasks later",
    });
  });

  test("trims surrounding whitespace", () => {
    expect(parseCapture("   #note   padded input   ")).toEqual({
      kind: "note",
      body: "padded input",
    });
  });

  test("handles a bare tag with empty body", () => {
    expect(parseCapture("#task")).toEqual({ kind: "task", body: "" });
  });
});

describe("titleFor", () => {
  test("returns short bodies unchanged", () => {
    expect(titleFor("hello world")).toBe("hello world");
  });

  test("collapses internal whitespace", () => {
    expect(titleFor("hello   \n world")).toBe("hello world");
  });

  test("truncates long bodies with an ellipsis", () => {
    const long = "a".repeat(100);
    const title = titleFor(long);
    // 57 characters + an ellipsis.
    expect(title.length).toBe(58);
    expect(title.endsWith("…")).toBe(true);
    expect(title.startsWith("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
  });

  test("falls back to Untitled for empty input", () => {
    expect(titleFor("")).toBe("Untitled");
    expect(titleFor("   ")).toBe("Untitled");
  });
});
