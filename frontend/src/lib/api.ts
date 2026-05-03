import { clearPlayerToken, getPlayerToken, setPlayerToken } from './playerToken.js';
import { captureFrontendApiFailure } from './sentry.js';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const ADMIN_API = '/portal-api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

type AdminSessionInvalidHandler = () => void;

export type ApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  blob?: Blob;
};

export const PLAYER_RECOVERY_REQUIRED = 'PLAYER_RECOVERY_REQUIRED';

type MaybeRecoveryResponse = {
  code?: string;
};

type PlayerRecoveryVerifyResponse = {
  playerToken?: string;
};

export function isPlayerRecoveryRequiredResponse(res: ApiResponse<unknown>): boolean {
  const data = res.data as MaybeRecoveryResponse | null;
  return res.status === 409 && data?.code === PLAYER_RECOVERY_REQUIRED;
}

// Optional consumer-supplied callback for re-bootstrapping the player session
// when a game endpoint returns 401. The callback should call apiCreateSession
// with the player's onboarding identity; api.ts will pick up the new token
// from that call automatically. Returns true if a fresh token was obtained.
type PlayerAuthRefresher = () => Promise<boolean>;
let authRefresher: PlayerAuthRefresher | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let adminSessionInvalidHandler: AdminSessionInvalidHandler | null = null;

export function installPlayerAuthRefresher(fn: PlayerAuthRefresher | null): void {
  authRefresher = fn;
}

export function installAdminSessionInvalidHandler(fn: AdminSessionInvalidHandler | null): void {
  adminSessionInvalidHandler = fn;
}

function notifyAdminSessionInvalid(): void {
  if (adminSessionInvalidHandler) adminSessionInvalidHandler();
}

async function refreshPlayerToken(): Promise<boolean> {
  if (!authRefresher) return false;
  // Coalesce concurrent refresh attempts so a burst of failed calls doesn't
  // recreate the session N times.
  if (!refreshInFlight) {
    refreshInFlight = Promise.resolve()
      .then(() => (authRefresher ? authRefresher() : Promise.resolve(false)))
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Forward the player token as a header in addition to relying on the
  // HttpOnly cookie. This is the SameSite=None / Safari ITP fallback path.
  const token = getPlayerToken();
  if (token) headers['X-Player-Token'] = token;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    Object.assign(headers, extra as Record<string, string>);
  }
  return headers;
}

async function request<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: RequestBody,
  init: Pick<RequestInit, 'credentials' | 'headers'> = {},
): Promise<ApiResponse<T>> {
  try {
    const opts: RequestInit = {
      method,
      // Default to 'include' so the player_token cookie travels with every
      // game-API call. Admin helpers already pass credentials: 'include' too,
      // so this is now consistent across both surfaces.
      credentials: init.credentials ?? 'include',
      headers: buildHeaders(init.headers),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = (await res.json()) as T;
    if (res.status >= 500) {
      captureFrontendApiFailure({ method, path, status: res.status, apiBase: API_BASE });
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    captureFrontendApiFailure({ method, path, status: 0, apiBase: API_BASE, error });
    return { ok: false, status: 0, data: null };
  }
}

// Wrapper for game-API endpoints (PATCH /sessions/:id, POST /events,
// POST /submissions, POST /player/state) that retries exactly once after
// re-bootstrapping the player session when a 401 indicates a stale token.
// Falls back to the original 401 response if no refresher is installed or
// the refresh did not yield a usable token.
async function requestGame<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: RequestBody,
): Promise<ApiResponse<T>> {
  const initial = await request<T>(method, path, body);
  if (initial.status !== 401) return initial;

  clearPlayerToken();
  const refreshed = await refreshPlayerToken();
  if (!refreshed || !getPlayerToken()) return initial;

  return request<T>(method, path, body);
}

export function apiCreateSession(payload: Record<string, unknown>) {
  return request<{ playerToken?: string }>('POST', '/sessions', payload).then((res) => {
    // Capture the issued token transparently so call sites do not need to
    // remember to persist it. Failed calls leave the existing token alone.
    if (res.ok && res.data && typeof res.data.playerToken === 'string') {
      setPlayerToken(res.data.playerToken);
    }
    return res;
  });
}

export function apiPlayerRecoveryRequest(email: string) {
  return request('POST', '/player/recovery/request', { email });
}

export function apiPlayerRecoveryVerify(email: string, code: string) {
  return request<PlayerRecoveryVerifyResponse>('POST', '/player/recovery/verify', {
    email,
    code,
  }).then((res) => {
    if (res.ok && res.data && typeof res.data.playerToken === 'string') {
      setPlayerToken(res.data.playerToken);
    }
    return res;
  });
}

export function apiUpdateSession(gameSessionId: number | string, counts: Record<string, unknown>) {
  return requestGame('PATCH', `/sessions/${gameSessionId}`, counts);
}

export function apiRecordEvent(event: Record<string, unknown>) {
  return requestGame('POST', '/events', event);
}

export function apiSubmitKeyword(payload: Record<string, unknown>) {
  return requestGame('POST', '/submissions', payload);
}

export async function apiGetLeaderboard(campaign = 'APR26') {
  return request('GET', `/leaderboard?campaign=${encodeURIComponent(campaign)}`);
}

export function apiGetPlayerState(email: string) {
  return requestGame('POST', '/player/state', { email });
}

export function apiGetCampaignConfig() {
  return request('GET', '/campaigns/active');
}

export function apiGetOrgDomains() {
  return request('GET', '/organizations/domains');
}

export function apiGetHealth() {
  return request('GET', '/health');
}

// Admin API functions
function adminRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: RequestBody,
): Promise<ApiResponse<T>> {
  const opts: RequestInit = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  return fetch(`${API_BASE}${path}`, opts)
    .then(async (res) => {
      const contentType = res.headers.get('content-type') || '';
      let response: ApiResponse<T>;
      if (contentType.includes('text/csv')) {
        response = { ok: res.ok, status: res.status, data: null, blob: await res.blob() };
      } else {
        const data = (await res.json()) as T;
        response = { ok: res.ok, status: res.status, data };
      }

      if (response.status === 401) notifyAdminSessionInvalid();
      if (response.status >= 500) {
        captureFrontendApiFailure({ method, path, status: response.status, apiBase: API_BASE });
      }
      return response;
    })
    .catch((error) => {
      captureFrontendApiFailure({ method, path, status: 0, apiBase: API_BASE, error });
      return { ok: false, status: 0, data: null };
    });
}

export function apiAdminRequestOtp(email: string) {
  return request('POST', `${ADMIN_API}/request-otp`, { email });
}

export function apiAdminVerifyOtp(email: string, code: string) {
  return request('POST', `${ADMIN_API}/verify-otp`, { email, code }, { credentials: 'include' });
}

export function apiAdminVerifyStepUpOtp(
  email: string,
  code: string,
  action: string,
  targetEmail: string,
) {
  return request(
    'POST',
    `${ADMIN_API}/verify-otp`,
    {
      email,
      code,
      purpose: 'admin-management',
      action,
      targetEmail,
    },
    { credentials: 'include' },
  );
}

export function apiAdminRefresh() {
  return request('POST', `${ADMIN_API}/refresh`, undefined, { credentials: 'include' });
}

export function apiAdminLogout() {
  return request('POST', `${ADMIN_API}/logout`, undefined, { credentials: 'include' });
}

export function apiAdminGetDashboard(campaign?: string) {
  return adminRequest(
    'GET',
    `${ADMIN_API}/dashboard?campaign=${encodeURIComponent(campaign || 'APR26')}`,
  );
}

export function apiAdminExportCsv(campaign?: string) {
  return adminRequest(
    'GET',
    `${ADMIN_API}/export?campaign=${encodeURIComponent(campaign || 'APR26')}`,
  );
}

export function apiAdminGetOrganizations() {
  return adminRequest('GET', `${ADMIN_API}/organizations`);
}

export function apiAdminCreateOrganization(name: string) {
  return adminRequest('POST', `${ADMIN_API}/organizations`, { name });
}

export function apiAdminUpdateOrganization(id: number | string, name: string) {
  return adminRequest('PUT', `${ADMIN_API}/organizations/${id}`, { name });
}

export function apiAdminDeleteOrganization(id: number | string) {
  return adminRequest('DELETE', `${ADMIN_API}/organizations/${id}`);
}

export function apiAdminAddDomain(orgId: number | string, domain: string) {
  return adminRequest('POST', `${ADMIN_API}/organizations/${orgId}/domains`, { domain });
}

export function apiAdminRemoveDomain(orgId: number | string, domainId: number | string) {
  return adminRequest('DELETE', `${ADMIN_API}/organizations/${orgId}/domains/${domainId}`);
}

export function apiAdminGetCampaigns() {
  return adminRequest('GET', `${ADMIN_API}/campaigns`);
}

export function apiAdminCreateCampaign(data: Record<string, unknown>) {
  return adminRequest('POST', `${ADMIN_API}/campaigns`, data);
}

export function apiAdminUpdateCampaign(id: string, settings: Record<string, unknown>) {
  return adminRequest('PUT', `${ADMIN_API}/campaigns/${id}/settings`, settings);
}

export function apiAdminClearCampaignData(id: string) {
  return adminRequest('POST', `${ADMIN_API}/campaigns/${id}/clear`);
}

export function apiAdminResetLeaderboard(id: string) {
  return adminRequest('POST', `${ADMIN_API}/campaigns/${id}/reset-leaderboard`);
}

export function apiAdminSearchPlayers(q: string) {
  return adminRequest('GET', `${ADMIN_API}/players?q=${encodeURIComponent(q)}`);
}

export function apiAdminGetPlayer(id: number | string) {
  return adminRequest('GET', `${ADMIN_API}/players/${id}`);
}

export function apiAdminDeletePlayer(id: number | string) {
  return adminRequest('DELETE', `${ADMIN_API}/players/${id}`);
}

export function apiAdminRevokeSubmission(id: number | string) {
  return adminRequest('DELETE', `${ADMIN_API}/submissions/${id}`);
}

export function apiAdminGetAdmins() {
  return adminRequest('GET', `${ADMIN_API}/admins`);
}

export function apiAdminAddAdmin(email: string) {
  return adminRequest('POST', `${ADMIN_API}/admins`, { email });
}

export function apiAdminRemoveAdmin(email: string) {
  return adminRequest('DELETE', `${ADMIN_API}/admins/${encodeURIComponent(email)}`);
}
