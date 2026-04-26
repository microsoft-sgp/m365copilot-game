import { reactive, computed, watch } from 'vue';
import {
  CAMPAIGN_ID,
  MS_PER_WEEK,
  STORAGE_KEYS,
  TOTAL_WEEKS,
} from '../data/constants.js';
import { LINES } from '../data/lines.js';
import { loadJson, saveJson, saveString } from '../lib/storage.js';
import { genId } from '../lib/rng.js';
import { getPack } from '../lib/packGenerator.js';
import {
  mintLineKeyword,
  mintWeeklyKeyword,
} from '../lib/keywordMinting.js';
import { apiCreateSession, apiRecordEvent, apiUpdateSession } from '../lib/api.js';

function freshState() {
  return {
    sessionId: '',
    playerName: '',
    email: '',
    packId: 0,
    gameSessionId: null,
    tiles: [],
    cleared: [],
    wonLines: [],
    keywords: [],
    challengeProfile: null,
    boardActive: false,
  };
}

const state = reactive(freshState());

function persist() {
  saveJson(STORAGE_KEYS.state, {
    sessionId: state.sessionId,
    playerName: state.playerName,
    packId: state.packId,
    gameSessionId: state.gameSessionId,
    // Persist tile metadata WITHOUT the verify function (functions cannot be
    // serialized). We re-hydrate by regenerating the pack on load.
    tiles: state.tiles.map((t) => ({
      title: t.title,
      tag: t.tag,
      tileIndex: t.tileIndex,
      packId: t.packId,
    })),
    cleared: state.cleared,
    wonLines: state.wonLines,
    keywords: state.keywords,
    challengeProfile: state.challengeProfile,
    boardActive: state.boardActive,
  });
}

function load() {
  const saved = loadJson(STORAGE_KEYS.state, null);
  if (saved && saved.sessionId) {
    Object.assign(state, freshState(), saved);
    // Rehydrate tile verify functions if a board was active.
    if (state.boardActive && state.packId) {
      state.tiles = getPack(state.packId);
    }
  }
  if (!state.sessionId) {
    state.sessionId = genId(16);
  }
  persist();
}

load();
watch(
  state,
  () => {
    persist();
  },
  { deep: true },
);

export function useBingoGame() {
  const clearedCount = computed(
    () => state.cleared.filter(Boolean).length,
  );
  const linesWon = computed(() => state.wonLines.length);
  const keywordCount = computed(() => state.keywords.length);
  const boardProgress = computed(() =>
    Math.round((clearedCount.value / 9) * 100),
  );

  function startBoard({ name, packId, email }) {
    const canonicalName = state.playerName || (name || '').trim() || 'Player';
    if (!state.playerName && canonicalName) {
      state.playerName = canonicalName;
    }
    state.packId = packId;
    if (email) state.email = email;
    state.tiles = getPack(packId);
    state.cleared = new Array(9).fill(false);
    state.wonLines = state.wonLines || [];
    state.keywords = state.keywords || [];
    state.boardActive = true;

    if (!state.challengeProfile) {
      state.challengeProfile = {
        challengeStartAt: Date.now(),
        currentWeek: 1,
        weeksCompleted: 0,
        weeklySubmissions: [],
      };
    }

    saveString(STORAGE_KEYS.playerName, canonicalName);
    saveString(STORAGE_KEYS.lastPack, String(packId));

    // Fire-and-forget: register session server-side
    apiCreateSession(state.sessionId, canonicalName, packId, state.email)
      .then((res) => {
        if (res.ok && res.data && res.data.gameSessionId) {
          state.gameSessionId = res.data.gameSessionId;
        }
      })
      .catch(() => { /* API unavailable — continue normally */ });
  }

  function resetBoard() {
    state.boardActive = false;
    state.tiles = [];
    state.cleared = [];
  }

  // Returns { ok, errors, linesWon: [{ line, kw }], weeklyKw: string | null }
  function verifyTile(tileIndex, proof) {
    const tile = state.tiles[tileIndex];
    if (!tile) return { ok: false, errors: ['No active tile.'] };
    const errors = tile.verify(proof, state.packId, tileIndex);
    if (errors.length > 0) return { ok: false, errors };

    state.cleared[tileIndex] = true;

    // Fire-and-forget: record tile clear event
    if (state.gameSessionId) {
      apiRecordEvent({
        gameSessionId: state.gameSessionId,
        tileIndex,
        eventType: 'cleared',
      }).catch(() => {});
    }

    const newLinesWon = [];
    let weeklyKw = null;

    for (const line of LINES) {
      if (state.wonLines.includes(line.id)) continue;
      if (line.cells.every((c) => state.cleared[c])) {
        state.wonLines.push(line.id);
        const kw = mintLineKeyword(line.id, state.packId, state.sessionId);
        if (!state.keywords.find((k) => k.code === kw)) {
          state.keywords.push({
            code: kw,
            packId: state.packId,
            lineId: line.id,
            ts: Date.now(),
          });
        }

        // Fire-and-forget: record line win event
        if (state.gameSessionId) {
          apiRecordEvent({
            gameSessionId: state.gameSessionId,
            tileIndex,
            eventType: 'line_won',
            keyword: kw,
            lineId: line.id,
          }).catch(() => {});
        }

        const weeklyAward = tryWeeklyClear();
        weeklyKw = weeklyAward?.keyword || weeklyKw;
        if (weeklyAward && state.gameSessionId) {
          apiRecordEvent({
            gameSessionId: state.gameSessionId,
            tileIndex,
            eventType: 'weekly_won',
            keyword: weeklyAward.keyword,
            lineId: `W${weeklyAward.week}`,
          }).catch(() => {});
        }
        newLinesWon.push({ line, kw });
      }
    }

    // Fire-and-forget: update session progress counts and board state
    if (state.gameSessionId) {
      apiUpdateSession(state.gameSessionId, {
        tilesCleared: state.cleared.filter(Boolean).length,
        linesWon: state.wonLines.length,
        keywordsEarned: state.keywords.length,
        boardState: {
          cleared: state.cleared,
          wonLines: state.wonLines,
          keywords: state.keywords,
          challengeProfile: state.challengeProfile,
        },
      }).catch(() => {});
    }

    // Backward compat: lineWon returns last line (or null)
    return {
      ok: true,
      errors: [],
      lineWon: newLinesWon.length > 0 ? newLinesWon[newLinesWon.length - 1] : null,
      linesWon: newLinesWon,
      weeklyKw,
    };
  }

  function tryWeeklyClear() {
    const cp = state.challengeProfile;
    if (!cp) return null;
    if ((cp.weeklySubmissions || []).includes(cp.currentWeek)) return null;
    const awardedWeek = cp.currentWeek;
    const wkw = mintWeeklyKeyword(cp.currentWeek, state.packId, state.sessionId);
    if (state.keywords.find((k) => k.code === wkw)) return null;
    state.keywords.push({
      code: wkw,
      packId: state.packId,
      lineId: `W${cp.currentWeek}`,
      ts: Date.now(),
    });
    cp.weeklySubmissions = cp.weeklySubmissions || [];
    cp.weeklySubmissions.push(cp.currentWeek);
    cp.weeksCompleted = Math.min(cp.weeklySubmissions.length, TOTAL_WEEKS);
    const elapsed = Date.now() - cp.challengeStartAt;
    const maxWeek = Math.min(
      Math.floor(elapsed / MS_PER_WEEK) + 1,
      TOTAL_WEEKS,
    );
    cp.currentWeek = Math.min(cp.currentWeek + 1, maxWeek, TOTAL_WEEKS);
    return { keyword: wkw, week: awardedWeek };
  }

  function hydrateFromServer(serverState) {
    if (!serverState || !serverState.activeSession) return;
    const session = serverState.activeSession;
    state.playerName = serverState.playerName || state.playerName;
    state.gameSessionId = session.gameSessionId;
    state.packId = session.packId;

    if (session.boardState) {
      state.cleared = session.boardState.cleared || [];
      state.wonLines = session.boardState.wonLines || [];
      state.keywords = session.boardState.keywords || [];
      state.challengeProfile = session.boardState.challengeProfile || state.challengeProfile;
    }

    if (state.packId) {
      state.tiles = getPack(state.packId);
      state.boardActive = true;
    }
  }

  function setIdentity({ email, name }) {
    state.email = email;
    if (!state.playerName && name) {
      state.playerName = name;
    }
    if (name) {
      saveString(STORAGE_KEYS.playerName, state.playerName || name);
    }
  }

  function setEmail(email) {
    state.email = email;
  }

  return {
    state,
    clearedCount,
    linesWon,
    keywordCount,
    boardProgress,
    startBoard,
    resetBoard,
    verifyTile,
    hydrateFromServer,
    setIdentity,
    setEmail,
    campaignId: CAMPAIGN_ID,
  };
}
