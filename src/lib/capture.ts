import type { VaultKind } from "@/components/VaultCard";

/**
 * Universal capture bar parsing. A leading #tag (#note, #link, #snippet,
 * #prompt, #task) sets the entry kind; anything else is a note.
 */

export const KIND_TAG_RE = /^#(note|link|snippet|prompt|task)\b/i;

export function parseCapture(raw: string): { kind: VaultKind; body: string } {
  const match = raw.trim().match(KIND_TAG_RE);
  if (match) {
    return {
      kind: match[1].toLowerCase() as VaultKind,
      body: raw.trim().slice(match[0].length).trim(),
    };
  }
  return { kind: "note", body: raw.trim() };
}

export function titleFor(body: string): string {
  const first = body.replace(/\s+/g, " ").trim();
  return first.length > 60 ? `${first.slice(0, 57)}…` : first || "Untitled";
}
