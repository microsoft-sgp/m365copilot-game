export const ADMIN_AUTHENTICATED_STORAGE_KEY = 'admin_authenticated';
export const ADMIN_EMAIL_STORAGE_KEY = 'admin_email';
export const ADMIN_SESSION_CONFIRMATION_MESSAGE =
  'Your admin session could not be confirmed. Please sign in again.';

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function hasAdminSessionHint(): boolean {
  const store = safeSessionStorage();
  if (!store) return false;
  try {
    return store.getItem(ADMIN_AUTHENTICATED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminSessionHint(email?: string | null): void {
  const store = safeSessionStorage();
  if (!store) return;
  try {
    store.setItem(ADMIN_AUTHENTICATED_STORAGE_KEY, 'true');
    if (email) store.setItem(ADMIN_EMAIL_STORAGE_KEY, email);
  } catch {
    // HttpOnly cookies are the actual admin session; this marker only drives UI state.
  }
}

export function clearAdminSessionHint(): void {
  const store = safeSessionStorage();
  if (!store) return;
  try {
    store.removeItem(ADMIN_AUTHENTICATED_STORAGE_KEY);
    store.removeItem(ADMIN_EMAIL_STORAGE_KEY);
  } catch {
    // Ignore private-mode/sessionStorage failures; the backend remains authoritative.
  }
}
