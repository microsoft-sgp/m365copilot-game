// Player session token storage. Backed by sessionStorage so the token only
// survives within the current browser tab session — consistent with the
// admin auth pattern that uses sessionStorage for the `admin_authenticated`
// flag. We deliberately do NOT use localStorage so the token does not
// persist across tab closures (the cookie is the long-term carrier; this
// is just the SameSite-None / ITP fallback transport).

const STORAGE_KEY = 'copilot_bingo_player_token';

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getPlayerToken(): string {
  const store = safeSessionStorage();
  if (!store) return '';
  try {
    return store.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setPlayerToken(token: string | null | undefined): void {
  const store = safeSessionStorage();
  if (!store) return;
  try {
    if (!token) {
      store.removeItem(STORAGE_KEY);
      return;
    }
    store.setItem(STORAGE_KEY, token);
  } catch {
    // Quota / private mode — the cookie is the primary carrier so it's
    // safe to silently ignore failures here.
  }
}

export function clearPlayerToken(): void {
  setPlayerToken(null);
}

export const PLAYER_TOKEN_STORAGE_KEY = STORAGE_KEY;
