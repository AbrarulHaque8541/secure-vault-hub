import { describe, expect, test } from "bun:test";
import {
  parseAllowedOrigins,
  readNavigationDirection,
  resolvePostTargetOrigin,
} from "./embed";

const TRUSTED = "https://app.example";

describe("parseAllowedOrigins", () => {
  test("splits, trims and drops empty entries", () => {
    expect(parseAllowedOrigins(" https://a.example , https://b.example ,, ")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  test("normalises a trailing slash so one origin is not two", () => {
    expect(parseAllowedOrigins("https://a.example/")).toEqual(["https://a.example"]);
    expect(parseAllowedOrigins("https://a.example,https://a.example/")).toEqual([
      "https://a.example",
    ]);
  });

  test("treats missing configuration as an empty allowlist", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins(null)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
  });
});

describe("resolvePostTargetOrigin", () => {
  test("names the origin when exactly one is trusted", () => {
    expect(resolvePostTargetOrigin([TRUSTED], "")).toBe(TRUSTED);
  });

  test("uses the referrer when it is one of several trusted origins", () => {
    expect(
      resolvePostTargetOrigin(
        ["https://a.example", "https://b.example"],
        "https://b.example/some/page",
      ),
    ).toBe("https://b.example");
  });

  test("falls back to the wildcard when the referrer is untrusted", () => {
    // With a single trusted origin there is nothing to discover, so the
    // referrer is only consulted when several are allowlisted.
    expect(
      resolvePostTargetOrigin(
        ["https://a.example", "https://b.example"],
        "https://evil.example/",
      ),
    ).toBe("*");
  });

  test("falls back to the wildcard with no configuration at all", () => {
    expect(resolvePostTargetOrigin([], "")).toBe("*");
  });

  test("survives an unparseable referrer", () => {
    expect(
      resolvePostTargetOrigin(
        ["https://a.example", "https://b.example"],
        "not a url",
      ),
    ).toBe("*");
  });
});

describe("readNavigationDirection", () => {
  test("accepts a navigate message from the trusted parent", () => {
    expect(
      readNavigationDirection(
        { origin: TRUSTED, isFromParent: true, data: { type: "navigate", direction: "back" } },
        [TRUSTED],
      ),
    ).toBe("back");
    expect(
      readNavigationDirection(
        { origin: TRUSTED, isFromParent: true, data: { type: "navigate", direction: "forward" } },
        [TRUSTED],
      ),
    ).toBe("forward");
  });

  test("rejects a message from an untrusted origin", () => {
    expect(
      readNavigationDirection(
        {
          origin: "https://evil.example",
          isFromParent: true,
          data: { type: "navigate", direction: "back" },
        },
        [TRUSTED],
      ),
    ).toBeNull();
  });

  test("rejects a message that is not from the parent frame", () => {
    // A sibling or opened window must not be able to drive the router even
    // from a trusted origin.
    expect(
      readNavigationDirection(
        {
          origin: TRUSTED,
          isFromParent: false,
          data: { type: "navigate", direction: "back" },
        },
        [TRUSTED],
      ),
    ).toBeNull();
  });

  test("fails closed when no origins are configured", () => {
    // A missing env var must not silently mean "trust everyone".
    expect(
      readNavigationDirection(
        {
          origin: TRUSTED,
          isFromParent: true,
          data: { type: "navigate", direction: "back" },
        },
        [],
      ),
    ).toBeNull();
  });

  test("ignores other message types", () => {
    expect(
      readNavigationDirection(
        { origin: TRUSTED, isFromParent: true, data: { type: "something-else" } },
        [TRUSTED],
      ),
    ).toBeNull();
  });

  test("rejects an unknown direction instead of forwarding it", () => {
    expect(
      readNavigationDirection(
        {
          origin: TRUSTED,
          isFromParent: true,
          data: { type: "navigate", direction: "../../admin" },
        },
        [TRUSTED],
      ),
    ).toBeNull();
  });

  test("rejects a non-object payload", () => {
    for (const data of [null, undefined, "navigate", 42, []]) {
      expect(
        readNavigationDirection({ origin: TRUSTED, isFromParent: true, data }, [
          TRUSTED,
        ]),
      ).toBeNull();
    }
  });

  test("tolerates a trailing-slash difference between the two lists", () => {
    expect(
      readNavigationDirection(
        {
          origin: "https://a.example/",
          isFromParent: true,
          data: { type: "navigate", direction: "back" },
        },
        ["https://a.example"],
      ),
    ).toBe("back");
  });

  test("rejects an empty origin", () => {
    expect(
      readNavigationDirection(
        { origin: "", isFromParent: true, data: { type: "navigate", direction: "back" } },
        [""],
      ),
    ).toBeNull();
  });
});
