import type { VaultKind } from "@/components/VaultCard";

/**
 * Universal capture bar parsing. A leading #tag (#note, #link, #snippet,
 * #prompt, #task) sets the entry kind; anything else is a note.
 */

export const KIND_TAG_RE = /^#(note|link|snippet|prompt|task)\b/i;

/** A bare URL (at the start of the input) auto-files as a link. */
const URL_RE = /^https?:\/\/\S+/i;

export function parseCapture(raw: string): { kind: VaultKind; body: string } {
  const text = raw.trim();
  const match = text.match(KIND_TAG_RE);
  if (match) {
    return {
      kind: match[1].toLowerCase() as VaultKind,
      body: text.slice(match[0].length).trim(),
    };
  }
  if (URL_RE.test(text)) {
    return { kind: "link", body: text };
  }
  return { kind: "note", body: text };
}

export function titleFor(body: string): string {
  const first = body.replace(/\s+/g, " ").trim();
  return first.length > 60 ? `${first.slice(0, 57)}…` : first || "Untitled";
}
