import { describe, expect, it } from 'vitest';
import { normalize } from '../src/core/normalize.ts';

describe('normalize', () => {
  it('unifies quotes, whitespace and case', () => {
    expect(normalize('  “Ver aparecer”\n  a  ‘alma’ ')).toBe('"ver aparecer" a \'alma\'');
  });

  it('applies NFC', () => {
    expect(normalize('coração')).toBe(normalize('coração'));
  });

  it('handles empty values', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize('   ')).toBe('');
  });
});
