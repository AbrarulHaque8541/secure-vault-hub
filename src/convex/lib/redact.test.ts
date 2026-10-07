import { describe, expect, test } from "bun:test";
import { describeSendFailure } from "./redact";

/**
 * These tests are a leak regression suite.
 *
 * The threat is concrete: `axios` attaches the full request to its errors, and
 * for an OTP send that request contains the live one-time passcode plus the
 * provider API key in a header. Anything that stringifies such an error into a
 * log line puts the credential and the code in the log sink.
 *
 * So the assertion is not merely "returns a status" — it is that nothing from
 * the error's message, config, or headers survives.
 */

/** An axios-shaped error carrying secrets in the places axios puts them. */
function axiosStyleError() {
  return {
    message: "Request failed with status code 401",
    code: "ERR_BAD_REQUEST",
    response: {
      status: 401,
      data: { error: "invalid key fb_email_SUPERSECRETVALUE123" },
    },
    config: {
      url: "https://auth.freebuff.app/send_otp",
      headers: { "x-api-key": "fb_email_SUPERSECRETVALUE123" },
      data: JSON.stringify({ to: "user@example.com", otp: "314159" }),
    },
    request: { _header: "x-api-key: fb_email_SUPERSECRETVALUE123" },
  };
}

describe("describeSendFailure", () => {
  test("reduces an axios error to its HTTP status", () => {
    expect(describeSendFailure(axiosStyleError())).toBe("HTTP 401");
  });

  test("never leaks the API key, the OTP, the URL, or the body", () => {
    const description = describeSendFailure(axiosStyleError());
    for (const secret of [
      "fb_email_SUPERSECRETVALUE123",
      "314159",
      "user@example.com",
      "send_otp",
      "x-api-key",
      "freebuff",
    ]) {
      expect(description).not.toContain(secret);
    }
  });

  test("never serialises the whole error object", () => {
    // Guards against someone "improving" this to return JSON.stringify(err).
    const description = describeSendFailure(axiosStyleError());
    expect(description).not.toContain("{");
    expect(description.length).toBeLessThan(64);
  });

  test("falls back to a transport code when there is no response", () => {
    expect(describeSendFailure({ code: "ECONNABORTED" })).toBe("ECONNABORTED");
    expect(describeSendFailure({ code: "ECONNREFUSED" })).toBe("ECONNREFUSED");
  });

  test("prefers the HTTP status over the transport code", () => {
    expect(
      describeSendFailure({ code: "ERR_BAD_REQUEST", response: { status: 500 } }),
    ).toBe("HTTP 500");
  });

  test("rejects a status that is not a plausible HTTP code", () => {
    // A hostile or buggy object must not be able to inject arbitrary text
    // through the status field.
    expect(describeSendFailure({ response: { status: "401" } })).toBe(
      "unclassified failure",
    );
    expect(describeSendFailure({ response: { status: 99 } })).toBe(
      "unclassified failure",
    );
    expect(describeSendFailure({ response: { status: 600 } })).toBe(
      "unclassified failure",
    );
    expect(describeSendFailure({ response: { status: 401.5 } })).toBe(
      "unclassified failure",
    );
  });

  test("rejects a code that is not shaped like a transport code", () => {
    expect(describeSendFailure({ code: "not a code; DROP TABLE" })).toBe(
      "unclassified failure",
    );
    expect(describeSendFailure({ code: "x".repeat(41) })).toBe(
      "unclassified failure",
    );
  });

  test("does not read the message of a plain Error", () => {
    // The whole point: a message can contain a URL with a key in the query.
    expect(
      describeSendFailure(new Error("GET https://api/x?key=fb_email_LEAK")),
    ).toBe("unclassified failure");
  });

  test("classifies an abort separately from a provider rejection", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(describeSendFailure(abort)).toBe("aborted");
  });

  test("is safe for every non-error input", () => {
    for (const value of [undefined, null, 0, "", "boom", [], {}, true]) {
      expect(describeSendFailure(value)).toBe("unclassified failure");
    }
  });
});
