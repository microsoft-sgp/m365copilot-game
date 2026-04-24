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

export function apiCreateSession(sessionId, playerName, packId) {
  return request('POST', '/sessions', { sessionId, playerName, packId });
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
