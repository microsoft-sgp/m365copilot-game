import { describe, expect, it } from 'vitest';
import { CAMPAIGN_ID } from '../data/constants.js';
import { mintLineKeyword, mintWeeklyKeyword } from './keywordMinting.js';
import { validateKeywordFormat } from './verification.js';

describe('mintLineKeyword', () => {
  it('returns a string matching the line keyword format', () => {
    const kw = mintLineKeyword('R1', 42, 'session-1');
    expect(validateKeywordFormat(kw)).toBe(true);
  });

  it('zero-pads the pack id to 3 digits', () => {
    const kw = mintLineKeyword('R1', 7, 'session-1');
    expect(kw).toMatch(/-007-/);
  });

  it('is deterministic for the same inputs', () => {
    const a = mintLineKeyword('C2', 100, 'session-abc');
    const b = mintLineKeyword('C2', 100, 'session-abc');
    expect(a).toBe(b);
  });

  it('changes when session id changes', () => {
    const a = mintLineKeyword('R1', 1, 'session-a');
    const b = mintLineKeyword('R1', 1, 'session-b');
    expect(a).not.toBe(b);
  });

  it('changes when line id changes', () => {
    const a = mintLineKeyword('R1', 1, 'session-a');
    const b = mintLineKeyword('R2', 1, 'session-a');
    expect(a).not.toBe(b);
  });

  it('changes when pack id changes', () => {
    const a = mintLineKeyword('R1', 1, 'session-a');
    const b = mintLineKeyword('R1', 2, 'session-a');
    expect(a).not.toBe(b);
  });

  it('embeds the campaign id and line id verbatim', () => {
    const kw = mintLineKeyword('D2', 55, 'sess');
    expect(kw.startsWith(`CO-${CAMPAIGN_ID}-055-D2-`)).toBe(true);
  });
});

describe('mintWeeklyKeyword', () => {
  it('returns a string matching the weekly keyword format', () => {
    const kw = mintWeeklyKeyword(3, 42, 'session-1');
    expect(validateKeywordFormat(kw)).toBe(true);
  });

  it('embeds the week number and pads pack id', () => {
    const kw = mintWeeklyKeyword(5, 9, 'sess');
    expect(kw.startsWith(`CO-${CAMPAIGN_ID}-W5-009-`)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    expect(mintWeeklyKeyword(2, 3, 's')).toBe(mintWeeklyKeyword(2, 3, 's'));
  });

  it('differs across weeks, packs, and sessions', () => {
    const base = mintWeeklyKeyword(1, 1, 'sess');
    expect(mintWeeklyKeyword(2, 1, 'sess')).not.toBe(base);
    expect(mintWeeklyKeyword(1, 2, 'sess')).not.toBe(base);
    expect(mintWeeklyKeyword(1, 1, 'other')).not.toBe(base);
  });
});
