/**
 * Turn an unknown thrown value into a short, log-safe classification.
 *
 * This exists because of a specific trap: `axios` attaches the ENTIRE request
 * to an error — URL, headers (including the API key), and the request body
 * (which, for an OTP send, contains the live one-time passcode). Logging that
 * object, or surfacing it to a client, would leak the very credential the
 * surrounding fix removed from source.
 *
 * So nothing derived from `err.message`, `err.config`, or `err.request` is
 * ever used. The output is drawn from a closed set: an HTTP status number, or
 * a code matching a strict shape. Anything else collapses to a generic string.
 */

/** Axios-style transport codes: `ECONNABORTED`, `ERR_BAD_REQUEST`, … */
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,39}$/;

function readStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const response = (err as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return undefined;
  const status = (response as { status?: unknown }).status;
  if (typeof status !== "number" || !Number.isInteger(status)) return undefined;
  if (status < 100 || status > 599) return undefined;
  return status;
}

function readCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * A few words that are safe to write to a log sink or a dashboard.
 *
 * @example
 * describeSendFailure({ response: { status: 401 } }) // "HTTP 401"
 * describeSendFailure({ code: "ECONNABORTED" })      // "ECONNABORTED"
 * describeSendFailure(new Error("https://…?key=abc")) // "unclassified failure"
 */
export function describeSendFailure(err: unknown): string {
  const status = readStatus(err);
  if (status !== undefined) return `HTTP ${status}`;

  const code = readCode(err);
  if (code !== undefined && SAFE_CODE.test(code)) return code;

  // A timeout is worth distinguishing from "the provider said no" — it means
  // retry rather than fix the key — and is detected without reading `message`.
  if (err instanceof Error && err.name === "AbortError") return "aborted";

  return "unclassified failure";
}
