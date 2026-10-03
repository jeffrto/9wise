import type { DiffResult } from './diff.ts';
import { normalize } from './normalize.ts';
import {
  toNewHighlight,
  type BookInfo,
  type CreatedBook,
  type HighlightPatch,
  type NewHighlight,
  type ReadwiseClient,
} from './readwise.ts';
import { MAX_TEXT_LENGTH, type Highlight } from './types.ts';

export interface PlannedPatch {
  id: number;
  patch: HighlightPatch;
}

export interface SyncPlan {
  create: NewHighlight[];
  extend: PlannedPatch[];
  notes: PlannedPatch[];
  delete: number[];
  /** Highlights longer than Readwise accepts; left out of the sync. */
  tooLong: Highlight[];
}

export interface PlanOptions {
  /** Delete older highlights now inside a longer one (decision 8). */
  deleteContained?: boolean;
}

/** Joins notes, skipping any already contained in the result. */
export function joinNotes(...notes: (string | null | undefined)[]): string | null {
  let result = '';
  for (const note of notes) {
    const trimmed = note?.trim();
    if (!trimmed || normalize(result).includes(normalize(trimmed))) continue;
    result = result ? `${result}\n\n${trimmed}` : trimmed;
  }
  return result || null;
}

export function planSync(diff: DiffResult, book: BookInfo, options: PlanOptions = {}): SyncPlan {
  const fits = (h: Highlight) => h.text.length <= MAX_TEXT_LENGTH;
  const plan: SyncPlan = { create: [], extend: [], notes: [], delete: [], tooLong: [] };

  for (const h of diff.new) {
    if (fits(h)) plan.create.push(toNewHighlight(h, book));
    else plan.tooLong.push(h);
  }

  for (const m of diff.noteChanged) {
    plan.notes.push({ id: m.existing.id, patch: { note: m.highlight.note ?? '' } });
  }

  for (const m of diff.extended) {
    if (!fits(m.highlight)) {
      plan.tooLong.push(m.highlight);
      continue;
    }
    const removed = options.deleteContained ? m.alsoContains : [];
    const note = joinNotes(
      m.noteChanged ? m.highlight.note : m.existing.note,
      ...removed.map((r) => r.note),
    );
    const patch: HighlightPatch = { text: m.highlight.text, location: m.highlight.start };
    if (note && normalize(note) !== normalize(m.existing.note)) patch.note = note;
    plan.extend.push({ id: m.existing.id, patch });
    plan.delete.push(...removed.map((r) => r.id));
  }

  return plan;
}

export type SyncStep = 'create' | 'extend' | 'notes' | 'delete';

export interface SyncProgress {
  step: SyncStep;
  done: number;
  total: number;
}

export interface SyncOutcome {
  created: number;
  extended: number;
  notes: number;
  deleted: number;
  /** Book returned by Readwise when highlights were created. */
  book: CreatedBook | null;
}

/** Order matters: notes move to the longer highlight before the older ones are deleted. */
export async function runSync(
  client: ReadwiseClient,
  plan: SyncPlan,
  onProgress: (p: SyncProgress) => void = () => {},
): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { created: 0, extended: 0, notes: 0, deleted: 0, book: null };

  if (plan.create.length) {
    const total = plan.create.length;
    onProgress({ step: 'create', done: 0, total });
    const books = await client.createHighlights(plan.create, (done) => {
      outcome.created = done;
      onProgress({ step: 'create', done, total });
    });
    outcome.book = books[0] ?? null;
  }

  const patches: [Exclude<SyncStep, 'create' | 'delete'>, PlannedPatch[]][] = [
    ['extend', plan.extend],
    ['notes', plan.notes],
  ];
  for (const [step, list] of patches) {
    for (const [i, p] of list.entries()) {
      onProgress({ step, done: i, total: list.length });
      await client.updateHighlight(p.id, p.patch);
      if (step === 'extend') outcome.extended++;
      else outcome.notes++;
    }
    if (list.length) onProgress({ step, done: list.length, total: list.length });
  }

  for (const [i, id] of plan.delete.entries()) {
    onProgress({ step: 'delete', done: i, total: plan.delete.length });
    await client.deleteHighlight(id);
    outcome.deleted++;
  }
  if (plan.delete.length) {
    onProgress({ step: 'delete', done: plan.delete.length, total: plan.delete.length });
  }

  return outcome;
}
