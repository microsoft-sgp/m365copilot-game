import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PLAYER_TOKEN_STORAGE_KEY,
  clearPlayerToken,
  getPlayerToken,
  setPlayerToken,
} from './playerToken.js';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('playerToken storage', () => {
  it('returns an empty string when no token is set', () => {
    expect(getPlayerToken()).toBe('');
  });

  it('round-trips a token through setPlayerToken and getPlayerToken', () => {
    setPlayerToken('abc.def.ghi');
    expect(getPlayerToken()).toBe('abc.def.ghi');
    expect(sessionStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBe('abc.def.ghi');
  });

  it('clears the token when set to an empty value', () => {
    setPlayerToken('something');
    setPlayerToken('');
    expect(getPlayerToken()).toBe('');
    expect(sessionStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('clears the token when set to null', () => {
    setPlayerToken('something');
    setPlayerToken(null);
    expect(getPlayerToken()).toBe('');
  });

  it('clearPlayerToken removes the entry', () => {
    setPlayerToken('something');
    clearPlayerToken();
    expect(getPlayerToken()).toBe('');
  });

  it('does not touch localStorage', () => {
    setPlayerToken('something');
    expect(localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
