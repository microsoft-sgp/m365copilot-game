import { ref, computed } from 'vue';
import { STORAGE_KEYS } from '../data/constants.js';
import { ORG_MAP } from '../data/orgMap.js';
import { loadJson, saveJson } from '../lib/storage.js';
import { validateKeywordFormat } from '../lib/verification.js';

const submissions = ref(loadJson(STORAGE_KEYS.submissions, []));

function persist() {
  saveJson(STORAGE_KEYS.submissions, submissions.value);
}

export function useSubmissions() {
  const leaderboard = computed(() => {
    const orgMap = {};
    const seen = new Set();
    submissions.value.forEach((s) => {
      const key = `${s.org}||${s.kw}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!orgMap[s.org]) {
        orgMap[s.org] = {
          org: s.org,
          count: 0,
          contributors: new Set(),
          lastTs: 0,
        };
      }
      orgMap[s.org].count++;
      orgMap[s.org].contributors.add(s.email);
      if (s.ts > orgMap[s.org].lastTs) orgMap[s.org].lastTs = s.ts;
    });
    return Object.values(orgMap)
      .map((r) => ({
        org: r.org,
        count: r.count,
        contributorCount: r.contributors.size,
        lastTs: r.lastTs,
      }))
      .sort((a, b) => b.count - a.count || (a.org > b.org ? 1 : -1));
  });

  function detectOrg(email) {
    const domain = (email.split('@')[1] || '').toLowerCase().trim();
    return { domain, org: ORG_MAP[domain] || null };
  }

  // Returns { ok, message, orgDupe }
  function submit({ org, name, email, kw }) {
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

    const dupSelf = submissions.value.find(
      (s) => s.kw === upperKw && s.email === trimmedEmail,
    );
    if (dupSelf) {
      return {
        ok: false,
        message: '❌ You have already submitted this keyword.',
      };
    }
    const orgDupe = !!submissions.value.find(
      (s) => s.kw === upperKw && s.org === trimmedOrg,
    );

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
        ? `✅ Submitted! Note: this keyword was already counted for ${trimmedOrg}, so org score won't increase.`
        : `✅ Keyword accepted for ${trimmedOrg}! Leaderboard updated.`,
    };
  }

  return {
    submissions,
    leaderboard,
    detectOrg,
    submit,
  };
}
