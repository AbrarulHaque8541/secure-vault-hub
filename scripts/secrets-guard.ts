#!/usr/bin/env bun
/**
 * CI entry point for the secrets guard.
 *
 * All detection logic lives in `src/lib/secrets-guard.ts` as pure functions so
 * it can be unit-tested; this script only collects the inputs from git and
 * reports the result. Run it from the repository root:
 *
 *     bun run scripts/secrets-guard.ts
 *
 * Exits non-zero when a secret is found, so it can gate a workflow step.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  findTrackedSecretFiles,
  formatFinding,
  scanFiles,
  type Finding,
} from "../src/lib/secrets-guard";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

const tracked = git(["ls-files"]).split("\n").filter(Boolean);

const problems: string[] = [];

// 1. Secret-looking files must not be tracked at HEAD.
const secretFiles = findTrackedSecretFiles(tracked);
for (const path of secretFiles) {
  problems.push(
    `${path}: [tracked-secret-file] a secret-looking file is tracked in git — untrack it AND rotate the credential (see docs/SECRET-ROTATION.md)`,
  );
}

// 2. Scan the content of tracked text files for secret material.
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|md|sh|env|example)$/;
const files = tracked
  .filter((p) => TEXT.test(p))
  .map((path) => {
    try {
      return { path, content: readFileSync(path, "utf8") };
    } catch {
      return { path, content: "" };
    }
  });

const findings: Finding[] = scanFiles(files);
for (const f of findings) problems.push(formatFinding(f));

if (problems.length > 0) {
  console.error("::error::Secrets guard failed:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `OK — no secret files tracked and no secret material found in ${files.length} tracked files.`,
);
