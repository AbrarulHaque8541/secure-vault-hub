/**
 * Secret-leak detection, as pure functions.
 *
 * The CI guard used to be a handful of inline `grep -E` patterns in the
 * workflow YAML. That made it untestable, and it was in fact **vacuous**: the
 * provider-key pattern was
 *
 *     (x-api-key|apiKey|api_key)["']?\s*[:=]\s*["'][a-z]{2,10}_[A-Za-z0-9]{16,}["']
 *
 * The random tail `[A-Za-z0-9]{16,}` cannot cross an underscore, so a real key
 * of the shape `fb_email_<random>` — the exact key that leaked — was **not**
 * matched. A guard that cannot fail on the incident it was written for is
 * worse than no guard, because it is trusted.
 *
 * The logic now lives here as pure functions over `(path, content)` pairs, so
 * it can be unit-tested against both a positive fixture (the real leaked shape)
 * and negative fixtures (env-var reads, placeholders). The workflow only
 * collects the inputs and reports the result.
 */

/** Files that must never be tracked. `.env.example` is the sole exception. */
const SECRET_FILE =
  /(^|\/)\.env($|\.)|\.[a-z0-9]+\.keys$|\.keystore$|\.jks$|\.pem$|\.p12$|\.mobileprovision$/;

/** The one `.env`-ish file that is meant to be committed. */
const ALLOWED_FILE = /^\.env\.example$/;

/**
 * A provider-issued key assigned to a key-ish identifier.
 *
 * The prefix is one or more lowercase segments joined by underscores
 * (`fb_email`, `sk_live`, `api`), followed by a long alphanumeric tail. The
 * tail deliberately allows underscores too, so a multi-segment prefix cannot
 * slip past — the bug that made the old pattern vacuous.
 */
const PROVIDER_KEY_ASSIGNMENT =
  /(x-api-key|apiKey|api_key)["']?\s*[:=]\s*["']([a-z][a-z0-9]*(?:_[a-z0-9]+)*_[A-Za-z0-9_]{16,})["']/;

/** dotenvx private key material, wherever it appears. */
const DOTENVX_PRIVATE_KEY = /DOTENV_PRIVATE_KEY_[A-Z_]+=/;

/** Paths that are allowed to contain key-shaped strings (docs, fixtures, tests). */
const EXEMPT_PATH = /(^|\/)(docs|node_modules)\/|\.test\.ts$|^src\/convex\/lib\//;

export interface Finding {
  path: string;
  rule: "tracked-secret-file" | "dotenvx-private-key" | "hardcoded-provider-key";
  detail: string;
}

/** Tracked paths that look like secret files and must be untracked. */
export function findTrackedSecretFiles(paths: string[]): string[] {
  return paths.filter((p) => SECRET_FILE.test(p) && !ALLOWED_FILE.test(p));
}

/**
 * Scan one file's content for secret material.
 *
 * `path` is used only for the exemption rules and for reporting; the decision
 * is a pure function of the two arguments.
 */
export function scanFileContent(path: string, content: string): Finding[] {
  if (EXEMPT_PATH.test(path)) return [];

  const findings: Finding[] = [];

  if (DOTENVX_PRIVATE_KEY.test(content)) {
    findings.push({
      path,
      rule: "dotenvx-private-key",
      detail: "dotenvx private key material is present in a tracked file",
    });
  }

  const match = PROVIDER_KEY_ASSIGNMENT.exec(content);
  if (match) {
    // Report the identifier, never the value — the value is the secret.
    findings.push({
      path,
      rule: "hardcoded-provider-key",
      detail: `a provider API key looks hardcoded on \`${match[1]}\`; read it from the environment instead`,
    });
  }

  return findings;
}

/** Scan many files at once. */
export function scanFiles(files: Array<{ path: string; content: string }>): Finding[] {
  return files.flatMap((f) => scanFileContent(f.path, f.content));
}

/** Human-readable one-line summary of a finding, for CI logs. */
export function formatFinding(f: Finding): string {
  return `${f.path}: [${f.rule}] ${f.detail}`;
}
