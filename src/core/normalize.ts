const SINGLE_QUOTES = /[‘’‚‛′´`]/g;
const DOUBLE_QUOTES = /[“”„‟″«»]/g;

/** Comparison key only; never sent to Readwise. */
export function normalize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
