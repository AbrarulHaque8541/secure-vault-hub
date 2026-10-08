#!/usr/bin/env node
/**
 * Guard that the resolved dependency graph cannot silently regress to a
 * version with a known advisory.
 *
 * Why this exists: CI runs `bun install --frozen-lockfile` (ci.yml, release.yml).
 * That means `package.json` alone does NOT determine what gets installed — the
 * committed lockfile does, and a stale lockfile keeps resolving the vulnerable
 * version while `package.json` already looks patched. H5 (axios prototype
 * pollution + DNS/proxy bypass) is exactly that failure mode.
 *
 * This guard asserts the RESOLVED version in bun.lock, not just the declared range.
 *
 * Run from the repository root:  node scripts/check-lockfile-deps.mjs
 */
import { readFileSync } from "node:fs";

const FLOOR = { axios: "1.20.0" };

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? m.slice(1).map(Number) : null;
}

function gte(a, b) {
  const [x, y, z] = parseSemver(a);
  const [p, q, r] = parseSemver(b);
  if (x !== p) return x > p;
  if (y !== q) return y > q;
  return z >= r;
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = readFileSync("bun.lock", "utf8");

let checks = 0;

for (const [name, minimum] of Object.entries(FLOOR)) {
  checks += 1;

  const declared = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  if (!declared) fail(`${name} is not declared in package.json`);

  // The lockfile stores `"<name>": ["<name>@<resolved>", ...]`.
  const lockRe = new RegExp(`"${name}":\\s*\\["${name}@([0-9][^"]*)"`);
  const match = lockRe.exec(lock);
  if (!match) fail(`${name} has no resolved entry in bun.lock; run 'bun install'`);

  const resolved = match[1];
  checks += 1;
  if (!gte(resolved, minimum)) {
    fail(
      `${name} resolves to ${resolved} in bun.lock, below the patched floor ${minimum}. ` +
        `Run 'bun install' and commit the regenerated bun.lock — bumping package.json alone does not remediate this.`,
    );
  }

  // A declared range that admits the vulnerable version is a latent regression:
  // a future `bun install` could resolve back down to it.
  const declaredFloor = declared.replace(/^[\^~>=<\s]+/, "");
  checks += 1;
  if (!gte(declaredFloor, minimum)) {
    fail(`package.json declares ${name}@${declared}, which can resolve below the patched floor ${minimum}`);
  }
}

console.log(
  `PASS lockfile dependency floors: ${checks} assertions (axios >= ${FLOOR.axios} both declared and resolved)`,
);
