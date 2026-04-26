const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(method, path, body) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export function apiCreateSession(payload) {
  return request('POST', '/sessions', payload);
}

export function apiUpdateSession(gameSessionId, counts) {
  return request('PATCH', `/sessions/${gameSessionId}`, counts);
}

export function apiRecordEvent(event) {
  return request('POST', '/events', event);
}

export function apiSubmitKeyword(payload) {
  return request('POST', '/submissions', payload);
}

export async function apiGetLeaderboard(campaign = 'APR26') {
  return request('GET', `/leaderboard?campaign=${encodeURIComponent(campaign)}`);
}

export function apiGetPlayerState(email) {
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
function adminRequest(method, path, body) {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  return fetch(`${API_BASE}${path}`, opts)
    .then(async (res) => {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/csv')) {
        return { ok: res.ok, status: res.status, data: null, blob: await res.blob() };
      }
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    })
    .catch(() => ({ ok: false, status: 0, data: null }));
}

export function apiAdminRequestOtp(email) {
  return request('POST', '/admin/request-otp', { email });
}

export function apiAdminVerifyOtp(email, code) {
  return request('POST', '/admin/verify-otp', { email, code });
}

export function apiAdminGetDashboard(campaign) {
  return adminRequest('GET', `/admin/dashboard?campaign=${encodeURIComponent(campaign || 'APR26')}`);
}

export function apiAdminExportCsv(campaign) {
  return adminRequest('GET', `/admin/export?campaign=${encodeURIComponent(campaign || 'APR26')}`);
}

export function apiAdminGetOrganizations() {
  return adminRequest('GET', '/admin/organizations');
}

export function apiAdminCreateOrganization(name) {
  return adminRequest('POST', '/admin/organizations', { name });
}

export function apiAdminUpdateOrganization(id, name) {
  return adminRequest('PUT', `/admin/organizations/${id}`, { name });
}

export function apiAdminDeleteOrganization(id) {
  return adminRequest('DELETE', `/admin/organizations/${id}`);
}

export function apiAdminAddDomain(orgId, domain) {
  return adminRequest('POST', `/admin/organizations/${orgId}/domains`, { domain });
}

export function apiAdminRemoveDomain(orgId, domainId) {
  return adminRequest('DELETE', `/admin/organizations/${orgId}/domains/${domainId}`);
}

export function apiAdminGetCampaigns() {
  return adminRequest('GET', '/admin/campaigns');
}

export function apiAdminCreateCampaign(data) {
  return adminRequest('POST', '/admin/campaigns', data);
}

export function apiAdminUpdateCampaign(id, settings) {
  return adminRequest('PUT', `/admin/campaigns/${id}/settings`, settings);
}

export function apiAdminClearCampaignData(id) {
  return adminRequest('POST', `/admin/campaigns/${id}/clear`);
}

export function apiAdminResetLeaderboard(id) {
  return adminRequest('POST', `/admin/campaigns/${id}/reset-leaderboard`);
}

export function apiAdminSearchPlayers(q) {
  return adminRequest('GET', `/admin/players?q=${encodeURIComponent(q)}`);
}

export function apiAdminGetPlayer(id) {
  return adminRequest('GET', `/admin/players/${id}`);
}

export function apiAdminDeletePlayer(id) {
  return adminRequest('DELETE', `/admin/players/${id}`);
}

export function apiAdminRevokeSubmission(id) {
  return adminRequest('DELETE', `/admin/submissions/${id}`);
}
