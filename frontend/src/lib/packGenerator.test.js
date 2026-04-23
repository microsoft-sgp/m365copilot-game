import { describe, expect, it } from 'vitest';
import { TASK_BANK } from '../data/taskBank.js';
import { getPack } from './packGenerator.js';

describe('getPack', () => {
  it('returns exactly 9 tiles', () => {
    expect(getPack(1)).toHaveLength(9);
    expect(getPack(500)).toHaveLength(9);
    expect(getPack(999)).toHaveLength(9);
  });

  it('is deterministic: same pack id yields identical board', () => {
    const a = getPack(42);
    const b = getPack(42);
    expect(a.map((t) => t.title)).toEqual(b.map((t) => t.title));
  });

  it('produces different boards for different pack ids', () => {
    const a = getPack(1).map((t) => t.title);
    const b = getPack(2).map((t) => t.title);
    expect(a).not.toEqual(b);
  });

  it('attaches tileIndex 0..8 in order', () => {
    const pack = getPack(17);
    pack.forEach((tile, i) => expect(tile.tileIndex).toBe(i));
  });

  it('stamps the packId on every tile', () => {
    const pack = getPack(321);
    pack.forEach((tile) => expect(tile.packId).toBe(321));
  });

  it('only contains tasks from the task bank', () => {
    const bankTitles = new Set(TASK_BANK.map((t) => t.title));
    getPack(77).forEach((tile) => expect(bankTitles.has(tile.title)).toBe(true));
  });

  it('does not mutate the underlying task bank', () => {
    const snapshot = TASK_BANK.map((t) => t.title);
    getPack(1);
    getPack(2);
    getPack(3);
    expect(TASK_BANK.map((t) => t.title)).toEqual(snapshot);
  });

  it('does not repeat tiles within a single pack', () => {
    const pack = getPack(123);
    const titles = pack.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('preserves original task fields (prompt, verify, tag)', () => {
    const pack = getPack(5);
    pack.forEach((tile) => {
      expect(typeof tile.prompt).toBe('string');
      expect(typeof tile.verify).toBe('function');
      expect(typeof tile.tag).toBe('string');
    });
  });
});
