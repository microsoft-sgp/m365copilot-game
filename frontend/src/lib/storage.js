import { STORAGE_KEYS } from '../data/constants.js';

// Browser-storage adapters preserve the exact key names and value shapes
// from the legacy implementation so existing players keep their progress.

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota or serialization errors */
  }
}

export function loadString(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function saveString(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearAllGameData() {
  removeKey(STORAGE_KEYS.state);
  removeKey(STORAGE_KEYS.submissions);
  removeKey(STORAGE_KEYS.playerName);
  removeKey(STORAGE_KEYS.organization);
  removeKey(STORAGE_KEYS.lastPack);
  removeKey(STORAGE_KEYS.email);
}
