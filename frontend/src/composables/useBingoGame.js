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
    organization: '',
    assignedPackId: 0,
    assignmentCycle: 0,
    assignmentRotated: false,
    completedPackId: null,
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
    organization: state.organization,
    assignedPackId: state.assignedPackId,
    assignmentCycle: state.assignmentCycle,
    assignmentRotated: state.assignmentRotated,
    completedPackId: state.completedPackId,
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

  function applyAssignment(assignment) {
    if (!assignment) return;
    if (assignment.packId) {
      state.assignedPackId = assignment.packId;
    }
    if (assignment.cycleNumber) {
      state.assignmentCycle = assignment.cycleNumber;
    }
    state.assignmentRotated = Boolean(assignment.rotated);
    state.completedPackId = assignment.completedPackId ?? null;
  }

  async function startBoard({ name, packId, email, organization } = {}) {
    const canonicalName = state.playerName || (name || '').trim() || 'Player';
    if (!state.playerName && canonicalName) {
      state.playerName = canonicalName;
    }
    if (email) state.email = email;
    if (organization !== undefined) {
      state.organization = (organization || '').trim();
      if (state.organization) {
        saveString(STORAGE_KEYS.organization, state.organization);
      }
    }

    let resolvedPackId = Number(packId || state.assignedPackId || state.packId || 0);
    let resolvedGameSessionId = state.gameSessionId;

    function initializeBoard(targetPackId) {
      state.packId = targetPackId;
      state.assignedPackId = targetPackId;
      state.tiles = getPack(targetPackId);
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
      saveString(STORAGE_KEYS.lastPack, String(targetPackId));
    }

    if (resolvedPackId > 0) {
      initializeBoard(resolvedPackId);
    }

    try {
      const sessionPayload = {
        sessionId: state.sessionId,
        playerName: canonicalName,
        email: state.email,
      };
      if (state.organization) sessionPayload.organization = state.organization;
      if (packId) sessionPayload.packId = Number(packId);

      const res = await apiCreateSession(sessionPayload);
      if (res.ok && res.data) {
        if (res.data.activeAssignment) {
          applyAssignment(res.data.activeAssignment);
        }
        if (res.data.packId) {
          resolvedPackId = Number(res.data.packId);
        }
        if (res.data.gameSessionId) {
          resolvedGameSessionId = res.data.gameSessionId;
        }
      }
    } catch {
      // API unavailable — continue with local fallback state.
    }

    if (!resolvedPackId || resolvedPackId < 1) {
      return { ok: false, message: 'Unable to resolve your assigned pack. Please try again.' };
    }

    state.gameSessionId = resolvedGameSessionId ?? null;
    if (!state.boardActive || state.packId !== resolvedPackId) {
      initializeBoard(resolvedPackId);
    }

    return { ok: true, packId: resolvedPackId };
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
    if (!serverState) return;
    state.playerName = serverState.playerName || state.playerName;
    if (serverState.organization?.name) {
      state.organization = serverState.organization.name;
      saveString(STORAGE_KEYS.organization, state.organization);
    }
    applyAssignment(serverState.activeAssignment);

    const session = serverState.activeSession;
    if (!session) {
      state.boardActive = false;
      return;
    }

    state.gameSessionId = session.gameSessionId;
    state.packId = session.packId;
    state.assignedPackId = session.packId || state.assignedPackId;

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

  function setIdentity({ email, name, organization }) {
    state.email = email;
    state.organization = (organization || '').trim();
    if (!state.playerName && name) {
      state.playerName = name;
    }
    if (name) {
      saveString(STORAGE_KEYS.playerName, state.playerName || name);
    }
    if (state.organization) {
      saveString(STORAGE_KEYS.organization, state.organization);
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
