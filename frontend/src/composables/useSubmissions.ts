import { computed, ref } from 'vue';
import { STORAGE_KEYS } from '../data/constants.js';
import { ORG_MAP } from '../data/orgMap.js';
import { loadJson, saveJson } from '../lib/storage.js';
import { validateKeywordFormat } from '../lib/verification.js';
import { apiSubmitKeyword, apiGetLeaderboard, apiGetOrgDomains } from '../lib/api.js';
import type { ApiResponse } from '../lib/api.js';

type Submission = {
  org: string;
  name: string;
  email: string;
  kw: string;
  ts: number;
  orgDupe?: boolean;
};

type ServerLeaderboardRow = {
  org: string;
  score: number;
  contributors: number;
  lastSubmission: string | number | null;
};

type LeaderboardRow = {
  org: string;
  score: number;
  contributorCount: number;
  lastTs: string | number | null;
};

type OrgDomainsPayload = { domains?: Record<string, string> };
type LeaderboardPayload = { leaderboard?: ServerLeaderboardRow[] };
type SubmitKeywordPayload = { ok?: boolean; orgDupe?: boolean; message?: string };
type SubmitArgs = { org?: string; name?: string; email?: string; kw?: string };

const submissions = ref<Submission[]>(loadJson<Submission[]>(STORAGE_KEYS.submissions, []));
const serverLeaderboard = ref<ServerLeaderboardRow[]>([]);
const orgDomainMap = ref<Record<string, string>>({ ...ORG_MAP });

// Fetch org domain map from API (with hardcoded fallback)
async function refreshOrgMap() {
  try {
    const res = (await apiGetOrgDomains()) as ApiResponse<OrgDomainsPayload>;
    if (res.ok && res.data && res.data.domains) {
      orgDomainMap.value = res.data.domains;
    }
  } catch {
    // Use hardcoded fallback
  }
}

function persist() {
  saveJson(STORAGE_KEYS.submissions, submissions.value);
}

// Fetch the shared leaderboard from the server
async function refreshLeaderboard() {
  const res = (await apiGetLeaderboard()) as ApiResponse<LeaderboardPayload>;
  if (res.ok && res.data && res.data.leaderboard) {
    serverLeaderboard.value = res.data.leaderboard;
  }
}

export function useSubmissions() {
  // Prefer server leaderboard; fall back to local computation if empty
  const leaderboard = computed(() => {
    if (serverLeaderboard.value.length > 0) {
      return serverLeaderboard.value.map((r) => ({
        org: r.org,
        score: r.score,
        contributorCount: r.contributors,
        lastTs: r.lastSubmission,
      }));
    }
    // Fallback: local computation from localStorage
    const orgMap: Record<
      string,
      { org: string; score: number; contributors: Set<string>; lastTs: number }
    > = {};
    const seen = new Set();
    submissions.value.forEach((s) => {
      const key = `${s.org}||${s.kw}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!orgMap[s.org]) {
        orgMap[s.org] = {
          org: s.org,
          score: 0,
          contributors: new Set(),
          lastTs: 0,
        };
      }
      orgMap[s.org].score++;
      orgMap[s.org].contributors.add(s.email);
      if (s.ts > orgMap[s.org].lastTs) orgMap[s.org].lastTs = s.ts;
    });
    return Object.values(orgMap)
      .map(
        (r): LeaderboardRow => ({
          org: r.org,
          score: r.score,
          contributorCount: r.contributors.size,
          lastTs: r.lastTs,
        }),
      )
      .sort((a, b) => b.score - a.score || (a.org > b.org ? 1 : -1));
  });

  function detectOrg(email: string) {
    const domain = (email.split('@')[1] || '').toLowerCase().trim();
    return { domain, org: orgDomainMap.value[domain] || null };
  }

  // Returns { ok, message, orgDupe }
  async function submit({ org, name, email, kw }: SubmitArgs) {
    const trimmedOrg = (org || '').trim();
    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim().toLowerCase();
    const upperKw = (kw || '').trim().toUpperCase();

    if (!trimmedOrg || !trimmedName || !trimmedEmail || !upperKw) {
      return { ok: false, message: '❌ All fields are required.' };
    }
    if (!trimmedEmail.includes('@')) {
      return { ok: false, message: '❌ Invalid email.' };
    }
    if (!validateKeywordFormat(upperKw)) {
      return {
        ok: false,
        message:
          '❌ Invalid keyword format. Expected: CO-{CampaignId}-{PackId}-{LineId}-{Token} or CO-{CampaignId}-W{weekNo}-{PackId}-{Token}. Uppercase, digits, hyphens only.',
      };
    }

    // Try server submission first
    const serverRes = (await apiSubmitKeyword({
      org: trimmedOrg,
      name: trimmedName,
      email: trimmedEmail,
      keyword: upperKw,
    })) as ApiResponse<SubmitKeywordPayload>;

    if (serverRes.ok && serverRes.data) {
      // Also save locally as cache
      submissions.value.push({
        org: trimmedOrg,
        name: trimmedName,
        email: trimmedEmail,
        kw: upperKw,
        ts: Date.now(),
        orgDupe: serverRes.data.orgDupe,
      });
      persist();

      // Immediately refresh leaderboard
      await refreshLeaderboard();

      return {
        ok: serverRes.data.ok,
        orgDupe: serverRes.data.orgDupe,
        message: serverRes.data.ok
          ? serverRes.data.orgDupe
            ? `✅ Submitted! Note: this keyword was already counted for ${trimmedOrg}, so org score won't increase.`
            : `✅ Keyword accepted for ${trimmedOrg}! Leaderboard updated.`
          : `❌ ${serverRes.data.message}`,
      };
    }

    if (serverRes.status === 409 && serverRes.data) {
      return { ok: false, message: `❌ ${serverRes.data.message}` };
    }

    if (serverRes.status === 400 && serverRes.data) {
      return { ok: false, message: `❌ ${serverRes.data.message}` };
    }

    // Server unavailable — fall back to localStorage only
    const dupSelf = submissions.value.find((s) => s.kw === upperKw && s.email === trimmedEmail);
    if (dupSelf) {
      return {
        ok: false,
        message: '❌ You have already submitted this keyword.',
      };
    }
    const orgDupe = !!submissions.value.find((s) => s.kw === upperKw && s.org === trimmedOrg);

    submissions.value.push({
      org: trimmedOrg,
      name: trimmedName,
      email: trimmedEmail,
      kw: upperKw,
      ts: Date.now(),
      orgDupe,
    });
    persist();

    return {
      ok: true,
      orgDupe,
      message: orgDupe
        ? `✅ Submitted locally! Note: this keyword was already counted for ${trimmedOrg}, so org score won't increase. (Server unavailable — saved locally)`
        : `✅ Keyword saved locally for ${trimmedOrg}! (Server unavailable — leaderboard may not reflect this yet)`,
    };
  }

  // Polling: 30-second interval, controlled by start/stop
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function startPolling() {
    refreshLeaderboard();
    refreshOrgMap();
    pollTimer = setInterval(refreshLeaderboard, 30000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    submissions,
    leaderboard,
    detectOrg,
    submit,
    refreshLeaderboard,
    startPolling,
    stopPolling,
  };
}
