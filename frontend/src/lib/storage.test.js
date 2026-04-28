import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadJson,
  saveJson,
  loadString,
  saveString,
  removeKey,
  clearAllGameData,
} from './storage.js';
import { STORAGE_KEYS } from '../data/constants.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('JSON helpers', () => {
  it('round-trips JSON via saveJson/loadJson', () => {
    saveJson('k', { a: 1, b: [2, 3] });
    expect(loadJson('k', null)).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns fallback when key is absent', () => {
    expect(loadJson('missing', { default: true })).toEqual({ default: true });
  });

  it('returns fallback when stored JSON is malformed', () => {
    localStorage.setItem('bad', '{not-json');
    expect(loadJson('bad', 'fallback')).toBe('fallback');
  });
});

describe('string helpers', () => {
  it('round-trips strings via saveString/loadString', () => {
    saveString('s', 'hello');
    expect(loadString('s')).toBe('hello');
  });

  it('returns empty string for missing key', () => {
    expect(loadString('missing')).toBe('');
  });
});

describe('removeKey', () => {
  it('removes a stored key', () => {
    saveString('k', 'v');
    removeKey('k');
    expect(loadString('k')).toBe('');
  });

  it('does not throw when key is absent', () => {
    expect(() => removeKey('absent')).not.toThrow();
  });
});

describe('clearAllGameData', () => {
  it('removes every storage key managed by the game', () => {
    saveString(STORAGE_KEYS.state, 'state');
    saveString(STORAGE_KEYS.submissions, 'subs');
    saveString(STORAGE_KEYS.playerName, 'Ada');
    saveString(STORAGE_KEYS.organization, 'NUS');
    saveString(STORAGE_KEYS.lastPack, '42');
    saveString(STORAGE_KEYS.email, 'ada@nus.edu.sg');
    saveString('unrelated-key', 'keep me');

    clearAllGameData();

    expect(loadString(STORAGE_KEYS.state)).toBe('');
    expect(loadString(STORAGE_KEYS.submissions)).toBe('');
    expect(loadString(STORAGE_KEYS.playerName)).toBe('');
    expect(loadString(STORAGE_KEYS.organization)).toBe('');
    expect(loadString(STORAGE_KEYS.lastPack)).toBe('');
    expect(loadString(STORAGE_KEYS.email)).toBe('');
    expect(loadString('unrelated-key')).toBe('keep me');
  });
});

describe('failure tolerance', () => {
  it('saveJson swallows errors thrown by setItem', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => saveJson('k', { a: 1 })).not.toThrow();
      expect(() => saveString('k', 'v')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('loadString returns empty string when getItem throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('boom');
    };
    try {
      expect(loadString('k')).toBe('');
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
