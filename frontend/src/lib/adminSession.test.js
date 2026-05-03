import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_AUTHENTICATED_STORAGE_KEY,
  ADMIN_EMAIL_STORAGE_KEY,
  clearAdminSessionHint,
  hasAdminSessionHint,
  setAdminSessionHint,
} from './adminSession.js';

const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');

function replaceSessionStorage(store) {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get: () => store,
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  if (originalSessionStorageDescriptor) {
    Object.defineProperty(window, 'sessionStorage', originalSessionStorageDescriptor);
  }
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('admin session hint storage', () => {
  it('reports no hint when storage is empty', () => {
    expect(hasAdminSessionHint()).toBe(false);
  });

  it('stores the authenticated marker and optional email', () => {
    setAdminSessionHint('admin@test.com');

    expect(hasAdminSessionHint()).toBe(true);
    expect(sessionStorage.getItem(ADMIN_AUTHENTICATED_STORAGE_KEY)).toBe('true');
    expect(sessionStorage.getItem(ADMIN_EMAIL_STORAGE_KEY)).toBe('admin@test.com');
  });

  it('does not overwrite email when none is provided', () => {
    sessionStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, 'existing@test.com');

    setAdminSessionHint();

    expect(hasAdminSessionHint()).toBe(true);
    expect(sessionStorage.getItem(ADMIN_EMAIL_STORAGE_KEY)).toBe('existing@test.com');
  });

  it('clears both admin hint entries', () => {
    setAdminSessionHint('admin@test.com');

    clearAdminSessionHint();

    expect(hasAdminSessionHint()).toBe(false);
    expect(sessionStorage.getItem(ADMIN_AUTHENTICATED_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(ADMIN_EMAIL_STORAGE_KEY)).toBeNull();
  });

  it('fails closed when sessionStorage is unavailable', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    expect(hasAdminSessionHint()).toBe(false);
    expect(() => setAdminSessionHint('admin@test.com')).not.toThrow();
    expect(() => clearAdminSessionHint()).not.toThrow();
  });

  it('ignores storage method failures because cookies are authoritative', () => {
    replaceSessionStorage({
      getItem: vi.fn(() => {
        throw new Error('get blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('set blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('remove blocked');
      }),
    });

    expect(hasAdminSessionHint()).toBe(false);
    expect(() => setAdminSessionHint('admin@test.com')).not.toThrow();
    expect(() => clearAdminSessionHint()).not.toThrow();
  });
});