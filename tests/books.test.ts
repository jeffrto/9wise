import { describe, expect, it } from 'vitest';
import { matchBooks, titleKey } from '../src/core/books.ts';
import type { ReadwiseBook } from '../src/core/readwise.ts';

const book = (id: number, title: string, num_highlights = 0): ReadwiseBook => ({
  id,
  title,
  author: null,
  category: 'books',
  num_highlights,
  cover_image_url: null,
  highlights_url: `https://readwise.io/bookreview/${id}`,
});

describe('titleKey', () => {
  it('ignores case, accents and punctuation', () => {
    expect(titleKey('Meditações: Livro I')).toBe('meditacoes livro i');
  });
});

describe('matchBooks', () => {
  const library = [
    book(1, 'The Lighthouse Keeper'),
    book(2, 'The Lighthouse Keeper: A Novel', 10),
    book(3, 'Lighthouse'),
    book(4, 'Unrelated'),
  ];

  it('puts the exact title first', () => {
    expect(matchBooks('the lighthouse keeper', library).map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it('matches a title contained in the other', () => {
    expect(matchBooks('The Lighthouse Keeper - A Novel', [book(2, 'The Lighthouse Keeper')])).toHaveLength(1);
  });

  it('does not match on a fragment of a word', () => {
    expect(matchBooks('Light', [book(1, 'Lighthouse')])).toEqual([]);
  });

  it('returns nothing for an unknown book', () => {
    expect(matchBooks('Meditations', library)).toEqual([]);
  });
});
