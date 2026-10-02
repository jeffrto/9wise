export const MAX_TEXT_LENGTH = 8191;

/** A well-formed block from the ElevenReader export. Times are in seconds. */
export interface Block {
  /** 1-based position of the block in the file, counting malformed ones. */
  index: number;
  line: number;
  text: string;
  note: string | null;
  start: number;
  end: number;
}

export interface ParseWarning {
  index: number;
  line: number;
  reason: string;
  raw: string;
}

export interface ParseResult {
  bookTitle: string;
  /** False when the file name did not follow `<title> - Bookmarks.md`. */
  titleConfident: boolean;
  blocks: Block[];
  warnings: ParseWarning[];
  /** Total number of blocks in the file, valid or not. */
  total: number;
}

export interface Highlight {
  /** 1-based position in the cleaned list. */
  id: number;
  text: string;
  note: string | null;
  start: number;
  end: number;
  /** Indexes of the non-duplicate blocks that formed this highlight. */
  sources: number[];
}

export type Fate =
  | { kind: 'kept'; block: number; highlight: number }
  | { kind: 'merged'; block: number; highlight: number }
  | { kind: 'contained'; block: number; highlight: number }
  | { kind: 'duplicate'; block: number; highlight: number; of: number }
  | { kind: 'ignored'; block: number; reason: string };

export interface CleanStats {
  blocks: number;
  ignored: number;
  duplicates: number;
  /** Merge operations, including blocks dropped because they were contained in another. */
  merged: number;
  highlights: number;
  /** Highlights longer than Readwise accepts. */
  tooLong: number;
}

export interface IntegrityCheck {
  ok: boolean;
  /** Blocks whose text (or note) is not inside any cleaned highlight. */
  missing: number[];
}

export interface CleanResult {
  highlights: Highlight[];
  trace: Fate[];
  stats: CleanStats;
  check: IntegrityCheck;
}

export interface ExistingHighlight {
  id: number;
  text: string;
  note: string | null;
  location?: number | null;
  is_deleted?: boolean;
}
