import { normalize } from './normalize.ts';
import type { ExistingHighlight, Highlight } from './types.ts';

export interface Match {
  highlight: Highlight;
  existing: ExistingHighlight;
}

export interface DiffResult {
  new: Highlight[];
  /** Already in Readwise as is, or inside a longer existing highlight. */
  existing: Match[];
  /** Same text, new non-empty note in the file: PATCH the note. */
  noteChanged: Match[];
  /** File text contains an existing highlight (a merge grew): PATCH the text. */
  extended: (Match & { noteChanged: boolean; alsoContains: ExistingHighlight[] })[];
}

function noteDiffers(fileNote: string | null, existingNote: string | null): boolean {
  const note = normalize(fileNote);
  return note !== '' && !normalize(existingNote).includes(note);
}

export function diff(highlights: Highlight[], existing: ExistingHighlight[]): DiffResult {
  const live = existing
    .filter((e) => !e.is_deleted)
    .map((e) => ({ e, key: normalize(e.text) }))
    .filter((x) => x.key !== '');
  const byKey = new Map(live.map((x) => [x.key, x.e]));
  const claimed = new Set<number>();

  const result: DiffResult = { new: [], existing: [], noteChanged: [], extended: [] };

  for (const highlight of highlights) {
    const key = normalize(highlight.text);

    const same = byKey.get(key);
    if (same) {
      claimed.add(same.id);
      const match = { highlight, existing: same };
      if (noteDiffers(highlight.note, same.note)) result.noteChanged.push(match);
      else result.existing.push(match);
      continue;
    }

    const inside = live.filter((x) => key.includes(x.key) && !claimed.has(x.e.id));
    if (inside.length) {
      inside.sort((a, b) => b.key.length - a.key.length);
      const [first, ...rest] = inside.map((x) => x.e);
      inside.forEach((x) => claimed.add(x.e.id));
      result.extended.push({
        highlight,
        existing: first!,
        noteChanged: noteDiffers(highlight.note, first!.note),
        alsoContains: rest,
      });
      continue;
    }

    const outer = live.find((x) => x.key.includes(key));
    if (outer) {
      result.existing.push({ highlight, existing: outer.e });
      continue;
    }

    result.new.push(highlight);
  }

  return result;
}
