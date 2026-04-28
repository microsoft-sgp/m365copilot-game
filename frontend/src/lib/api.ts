const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const ADMIN_API = '/portal-api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type ApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  blob?: Blob;
};

async function request<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: RequestBody,
  init: Pick<RequestInit, 'credentials'> = {},
): Promise<ApiResponse<T>> {
  try {
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...init,
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export function apiCreateSession(payload: Record<string, unknown>) {
  return request('POST', '/sessions', payload);
}

export function apiUpdateSession(gameSessionId: number | string, counts: Record<string, unknown>) {
  return request('PATCH', `/sessions/${gameSessionId}`, counts);
}

export function apiRecordEvent(event: Record<string, unknown>) {
  return request('POST', '/events', event);
}

export function apiSubmitKeyword(payload: Record<string, unknown>) {
  return request('POST', '/submissions', payload);
}

export async function apiGetLeaderboard(campaign = 'APR26') {
  return request('GET', `/leaderboard?campaign=${encodeURIComponent(campaign)}`);
}

export function apiGetPlayerState(email: string) {
  return request('GET', `/player/state?email=${encodeURIComponent(email)}`);
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
      if (contentType.includes('text/csv')) {
        return { ok: res.ok, status: res.status, data: null, blob: await res.blob() };
      }
      const data = (await res.json()) as T;
      return { ok: res.ok, status: res.status, data };
    })
    .catch(() => ({ ok: false, status: 0, data: null }));
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
