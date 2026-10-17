import { describe, expect, test } from "bun:test";
import {
  findTrackedSecretFiles,
  formatFinding,
  scanFileContent,
  scanFiles,
} from "./secrets-guard";

/**
 * These tests exist because the previous guard was **vacuous**: its provider-key
 * pattern could not match the very key that leaked (`fb_email_<random>`),
 * because the random tail `[A-Za-z0-9]{16,}` cannot cross an underscore.
 *
 * The first test below is the regression pin for that bug. If someone narrows
 * the pattern again, it fails.
 */
describe("hardcoded provider keys", () => {
  test("catches the real leaked shape: a multi-segment prefix", () => {
    // The exact shape that leaked from src/convex/auth/emailOtp.ts.
    const src = `const apiKey = "fb_email_AbCdEf0123456789xyzQ";`;
    const findings = scanFileContent("src/convex/auth/emailOtp.ts", src);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("hardcoded-provider-key");
  });

  test("catches a two-segment prefix (sk_live_…)", () => {
    const src = `const apiKey = "sk_live_51H8xYzAbCdEf0123456789";`;
    expect(scanFileContent("src/lib/pay.ts", src)).toHaveLength(1);
  });

  test("catches a single-segment prefix (api_…)", () => {
    const src = `api_key: "api_9f8e7d6c5b4a39281706";`;
    expect(scanFileContent("src/lib/x.ts", src)).toHaveLength(1);
  });

  test("catches the x-api-key header form", () => {
    const src = `headers: { "x-api-key": "fb_email_AbCdEf0123456789xyzQ" }`;
    expect(scanFileContent("src/lib/x.ts", src)).toHaveLength(1);
  });

  test("does not flag reading the key from the environment", () => {
    const src = `const apiKey = process.env.FREEBUFF_EMAIL_API_KEY;`;
    expect(scanFileContent("src/convex/auth/emailOtp.ts", src)).toHaveLength(0);
  });

  test("does not flag a short placeholder", () => {
    const src = `const apiKey = "your_key_here";`;
    expect(scanFileContent("src/lib/x.ts", src)).toHaveLength(0);
  });

  test("does not flag a value with no underscore prefix", () => {
    const src = `const apiKey = "AbCdEf0123456789xyzQ";`;
    expect(scanFileContent("src/lib/x.ts", src)).toHaveLength(0);
  });

  test("exempts test files, docs, and the redaction helper", () => {
    const src = `const apiKey = "fb_email_AbCdEf0123456789xyzQ";`;
    expect(scanFileContent("src/lib/foo.test.ts", src)).toHaveLength(0);
    expect(scanFileContent("docs/SECRET-ROTATION.md", src)).toHaveLength(0);
    expect(scanFileContent("src/convex/lib/redact.ts", src)).toHaveLength(0);
  });
});

describe("dotenvx private keys", () => {
  test("catches private key material in any tracked file", () => {
    const src = `DOTENV_PRIVATE_KEY_LOCAL=abc123def456`;
    const findings = scanFileContent("src/lib/x.ts", src);
    expect(findings.map((f) => f.rule)).toContain("dotenvx-private-key");
  });

  test("does not flag a reference to the variable name alone", () => {
    const src = `// set DOTENV_PRIVATE_KEY_LOCAL in your local .env.keys`;
    // No `=` immediately after the name, so this is a comment, not material.
    expect(scanFileContent("src/lib/x.ts", src)).toHaveLength(0);
  });
});

describe("tracked secret files", () => {
  test("flags .env.keys and other secret files", () => {
    const paths = [
      ".env.keys",
      "android/app/release.keystore",
      "certs/dev.pem",
      "config/app.jks",
    ];
    expect(findTrackedSecretFiles(paths)).toEqual(paths);
  });

  test("allows .env.example", () => {
    expect(findTrackedSecretFiles([".env.example"])).toEqual([]);
  });

  test("allows ordinary source files", () => {
    expect(findTrackedSecretFiles(["src/main.tsx", "package.json"])).toEqual([]);
  });
});

describe("scanFiles", () => {
  test("aggregates findings across files", () => {
    const findings = scanFiles([
      { path: "src/a.ts", content: `const apiKey = "fb_email_AbCdEf0123456789xyzQ";` },
      { path: "src/b.ts", content: `const apiKey = process.env.KEY;` },
      { path: "src/c.ts", content: `DOTENV_PRIVATE_KEY_LOCAL=deadbeef` },
    ]);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.path)).toEqual(["src/a.ts", "src/c.ts"]);
  });

  test("formatFinding never includes the secret value", () => {
    const [finding] = scanFileContent(
      "src/a.ts",
      `const apiKey = "fb_email_AbCdEf0123456789xyzQ";`,
    );
    const line = formatFinding(finding);
    expect(line).toContain("src/a.ts");
    expect(line).not.toContain("AbCdEf0123456789xyzQ");
  });
});
