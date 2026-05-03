import { reactive, computed, watch } from 'vue';
import { CAMPAIGN_ID, MS_PER_WEEK, STORAGE_KEYS, TOTAL_WEEKS } from '../data/constants.js';
import { LINES } from '../data/lines.js';
import { loadJson, loadString, saveJson, saveString } from '../lib/storage.js';
import { genId } from '../lib/rng.js';
import { getPack } from '../lib/packGenerator.js';
import type { TileTask } from '../lib/packGenerator.js';
import { mintLineKeyword, mintWeeklyKeyword } from '../lib/keywordMinting.js';
import {
  apiCreateSession,
  apiRerollAssignment,
  apiRecordEvent,
  apiUpdateSession,
  isAssignmentNotActiveResponse,
  isPlayerRecoveryRequiredResponse,
} from '../lib/api.js';
import type { ApiResponse } from '../lib/api.js';

type Keyword = {
  code: string;
  packId: number;
  lineId: string;
  ts: number;
};

type ChallengeProfile = {
  challengeStartAt: number;
  currentWeek: number;
  weeksCompleted: number;
  weeklySubmissions: number[];
};

type PersistedTile = Pick<TileTask, 'title' | 'tag' | 'tileIndex' | 'packId'>;

type GameState = {
  sessionId: string;
  playerName: string;
  email: string;
  organization: string;
  assignmentId: number | null;
  assignedPackId: number;
  assignmentCycle: number;
  assignmentRotated: boolean;
  completedPackId: number | null;
  packId: number;
  gameSessionId: number | null;
  tiles: TileTask[];
  cleared: boolean[];
  wonLines: string[];
  keywords: Keyword[];
  challengeProfile: ChallengeProfile | null;
  boardActive: boolean;
  recoveryRequired: boolean;
  recoveryEmail: string;
  recoveryMessage: string;
};

type ActiveAssignment = {
  assignmentId?: number;
  packId?: number;
  cycleNumber?: number;
  rotated?: boolean;
  completedPackId?: number | null;
};

type CreateSessionPayload = {
  ok?: boolean;
  gameSessionId?: number;
  packId?: number;
  activeAssignment?: ActiveAssignment;
};

type BoardStatePayload = {
  cleared?: boolean[];
  wonLines?: string[];
  keywords?: Keyword[];
  challengeProfile?: ChallengeProfile | null;
};

type ServerPlayerState = {
  playerName?: string;
  organization?: { name?: string } | null;
  activeAssignment?: ActiveAssignment | null;
  activeSession?: {
    gameSessionId?: number;
    packId?: number;
    boardState?: BoardStatePayload | null;
  } | null;
};

type StartBoardArgs = {
  name?: string;
  packId?: number | string;
  email?: string;
  organization?: string;
};

type AssignmentResult = {
  ok: boolean;
  packId?: number;
  message?: string;
  recoveryRequired?: boolean;
};

function freshState(): GameState {
  return {
    sessionId: '',
    playerName: '',
    email: '',
    organization: '',
    assignmentId: null,
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
    recoveryRequired: false,
    recoveryEmail: '',
    recoveryMessage: '',
  };
}

const state = reactive<GameState>(freshState());

function persist() {
  saveJson(STORAGE_KEYS.state, {
    sessionId: state.sessionId,
    playerName: state.playerName,
    organization: state.organization,
    assignmentId: state.assignmentId,
    assignedPackId: state.assignedPackId,
    assignmentCycle: state.assignmentCycle,
    assignmentRotated: state.assignmentRotated,
    completedPackId: state.completedPackId,
    packId: state.packId,
    gameSessionId: state.gameSessionId,
    // Persist tile metadata WITHOUT the verify function (functions cannot be
    // serialized). We re-hydrate by regenerating the pack on load.
    tiles: state.tiles.map(
      (t): PersistedTile => ({
        title: t.title,
        tag: t.tag,
        tileIndex: t.tileIndex,
        packId: t.packId,
      }),
    ),
    cleared: state.cleared,
    wonLines: state.wonLines,
    keywords: state.keywords,
    challengeProfile: state.challengeProfile,
    boardActive: state.boardActive,
    recoveryRequired: state.recoveryRequired,
    recoveryEmail: state.recoveryEmail,
    recoveryMessage: state.recoveryMessage,
  });
}

function load() {
  const saved = loadJson<Partial<GameState> | null>(STORAGE_KEYS.state, null);
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
  const clearedCount = computed(() => state.cleared.filter(Boolean).length);
  const linesWon = computed(() => state.wonLines.length);
  const keywordCount = computed(() => state.keywords.length);
  const boardProgress = computed(() => Math.round((clearedCount.value / 9) * 100));

  function applyAssignment(assignment?: ActiveAssignment | null) {
    if (!assignment) return;
    if (assignment.assignmentId) {
      state.assignmentId = assignment.assignmentId;
    }
    if (assignment.packId) {
      state.assignedPackId = assignment.packId;
    }
    if (assignment.cycleNumber) {
      state.assignmentCycle = assignment.cycleNumber;
    }
    state.assignmentRotated = Boolean(assignment.rotated);
    state.completedPackId = assignment.completedPackId ?? null;
  }

  function setRecoveryRequired(email?: string, message = 'Player recovery is required.') {
    state.recoveryRequired = true;
    state.recoveryEmail = (email || state.email || '').trim().toLowerCase();
    state.recoveryMessage = message;
    state.boardActive = false;
  }

  function clearRecoveryRequired() {
    state.recoveryRequired = false;
    state.recoveryEmail = '';
    state.recoveryMessage = '';
  }

  function recoveryResult(message = 'Recover this player identity to continue.') {
    return { ok: false, recoveryRequired: true, message };
  }

  function handleCreateSessionRecovery(res: ApiResponse<unknown>, email?: string) {
    if (!isPlayerRecoveryRequiredResponse(res)) return false;
    setRecoveryRequired(email, 'Recover this player identity to continue.');
    return true;
  }

  function watchGameAuthFailure(promise: Promise<ApiResponse<unknown>>) {
    promise
      .then((res) => {
        if (res.status === 401 && state.email) {
          setRecoveryRequired(state.email, 'Recover this player identity to continue.');
        }
      })
      .catch(() => {});
  }

  function applyIdentity({ name, email, organization }: StartBoardArgs = {}) {
    const canonicalName = state.playerName || (name || '').trim() || 'Player';
    if (!state.playerName && canonicalName) {
      state.playerName = canonicalName;
    }
    if (email) {
      const nextEmail = email.trim().toLowerCase();
      if (state.recoveryRequired && state.recoveryEmail && state.recoveryEmail !== nextEmail) {
        clearRecoveryRequired();
      }
      state.email = nextEmail;
    }
    if (organization !== undefined) {
      state.organization = (organization || '').trim();
      if (state.organization) {
        saveString(STORAGE_KEYS.organization, state.organization);
      }
    }
    return canonicalName;
  }

  function freshChallengeProfile(): ChallengeProfile {
    return {
      challengeStartAt: Date.now(),
      currentWeek: 1,
      weeksCompleted: 0,
      weeklySubmissions: [],
    };
  }

  function initializeBoard(
    targetPackId: number,
    canonicalName: string,
    {
      resetProgress = false,
      resetChallengeProfile = false,
    }: { resetProgress?: boolean; resetChallengeProfile?: boolean } = {},
  ) {
    state.packId = targetPackId;
    state.assignedPackId = targetPackId;
    state.tiles = getPack(targetPackId);
    state.cleared = new Array(9).fill(false);
    if (resetProgress) {
      state.wonLines = [];
      state.keywords = [];
    } else {
      state.wonLines = state.wonLines || [];
      state.keywords = state.keywords || [];
    }
    state.boardActive = true;

    if (resetChallengeProfile || !state.challengeProfile) {
      state.challengeProfile = freshChallengeProfile();
    }

    saveString(STORAGE_KEYS.playerName, canonicalName);
    saveString(STORAGE_KEYS.lastPack, String(targetPackId));
  }

  function applySessionPayload(data?: CreateSessionPayload | null): number {
    if (!data) return 0;
    if (data.activeAssignment) {
      applyAssignment(data.activeAssignment);
    }
    if (data.gameSessionId) {
      state.gameSessionId = data.gameSessionId;
    }
    const assignedPackId = Number(data.packId || data.activeAssignment?.packId || 0);
    if (assignedPackId > 0) {
      state.assignedPackId = assignedPackId;
      saveString(STORAGE_KEYS.lastPack, String(assignedPackId));
    }
    return assignedPackId;
  }

  async function ensurePackAssignment(args: StartBoardArgs = {}): Promise<AssignmentResult> {
    const canonicalName = applyIdentity(args);
    if (state.recoveryRequired && (!state.recoveryEmail || state.recoveryEmail === state.email)) {
      return recoveryResult();
    }
    const currentPackId = Number(state.assignedPackId || state.packId || 0);
    if (currentPackId > 0) return { ok: true, packId: currentPackId };

    try {
      const sessionPayload: Record<string, unknown> = {
        sessionId: state.sessionId,
        playerName: canonicalName,
        email: state.email,
      };
      if (state.organization) sessionPayload.organization = state.organization;

      const res = (await apiCreateSession(sessionPayload)) as ApiResponse<CreateSessionPayload>;
      if (handleCreateSessionRecovery(res, state.email)) return recoveryResult();
      if (res.ok && res.data) {
        const assignedPackId = applySessionPayload(res.data);
        if (assignedPackId > 0) return { ok: true, packId: assignedPackId };
      }
    } catch {
      // API unavailable — launch can retry assignment when the player taps the button.
    }

    return { ok: false, message: 'Unable to resolve your assigned pack. Please try again.' };
  }

  async function startBoard({ name, packId, email, organization }: StartBoardArgs = {}) {
    const canonicalName = applyIdentity({ name, email, organization });

    if (state.recoveryRequired && (!state.recoveryEmail || state.recoveryEmail === state.email)) {
      return recoveryResult();
    }

    let resolvedPackId = Number(packId || state.assignedPackId || state.packId || 0);
    let resolvedGameSessionId = state.gameSessionId;

    const mustVerifyBeforeLocalLaunch = Boolean(state.email);
    if (resolvedPackId > 0 && !mustVerifyBeforeLocalLaunch) {
      initializeBoard(resolvedPackId, canonicalName);
    }

    try {
      const sessionPayload: Record<string, unknown> = {
        sessionId: state.sessionId,
        playerName: canonicalName,
        email: state.email,
      };
      if (state.organization) sessionPayload.organization = state.organization;
      if (packId) sessionPayload.packId = Number(packId);

      const res = (await apiCreateSession(sessionPayload)) as ApiResponse<CreateSessionPayload>;
      if (handleCreateSessionRecovery(res, state.email)) return recoveryResult();
      if (res.ok && res.data) {
        const assignedPackId = applySessionPayload(res.data);
        if (res.data.packId) {
          resolvedPackId = Number(res.data.packId);
        } else if (assignedPackId > 0) {
          resolvedPackId = assignedPackId;
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
      initializeBoard(resolvedPackId, canonicalName);
    }

    return { ok: true, packId: resolvedPackId };
  }

  async function rerollBoard(args: StartBoardArgs = {}): Promise<AssignmentResult> {
    const identityArgs = {
      name: args.name ?? loadString(STORAGE_KEYS.playerName) ?? undefined,
      email: args.email ?? loadString(STORAGE_KEYS.email) ?? undefined,
      organization: args.organization ?? loadString(STORAGE_KEYS.organization) ?? undefined,
    };
    const canonicalName = applyIdentity(identityArgs);

    if (state.recoveryRequired && (!state.recoveryEmail || state.recoveryEmail === state.email)) {
      return recoveryResult();
    }

    if (!state.email) {
      return { ok: false, message: 'Email is required to assign a new pack.' };
    }

    try {
      const payload: Record<string, unknown> = {
        sessionId: state.sessionId,
        playerName: canonicalName,
        email: state.email,
      };
      if (state.organization) payload.organization = state.organization;
      if (state.gameSessionId) payload.gameSessionId = state.gameSessionId;

      const res = (await apiRerollAssignment(payload)) as ApiResponse<CreateSessionPayload>;
      if (handleCreateSessionRecovery(res, state.email)) return recoveryResult();
      if (isAssignmentNotActiveResponse(res)) {
        return { ok: false, message: 'This board is no longer active. Refresh and try again.' };
      }
      if (!res.ok || !res.data) {
        return { ok: false, message: 'Unable to assign a new pack. Please try again.' };
      }

      const assignedPackId = applySessionPayload(res.data);
      const resolvedPackId = Number(res.data.packId || assignedPackId || 0);
      if (resolvedPackId < 1) {
        return { ok: false, message: 'Unable to assign a new pack. Please try again.' };
      }

      state.gameSessionId = res.data.gameSessionId ?? null;
      state.assignmentRotated = false;
      state.completedPackId = null;
      initializeBoard(resolvedPackId, canonicalName, {
        resetProgress: true,
        resetChallengeProfile: true,
      });

      return { ok: true, packId: resolvedPackId };
    } catch {
      return { ok: false, message: 'Unable to assign a new pack. Please try again.' };
    }
  }

  function resetBoard() {
    state.boardActive = false;
    state.tiles = [];
    state.cleared = [];
  }

  // Returns { ok, errors, linesWon: [{ line, kw }], weeklyKw: string | null }
  function verifyTile(tileIndex: number, proof: string) {
    if (state.recoveryRequired) {
      return { ok: false, errors: ['Player recovery is required before continuing.'] };
    }
    const tile = state.tiles[tileIndex];
    if (!tile) return { ok: false, errors: ['No active tile.'] };
    const errors = tile.verify(proof, state.packId, tileIndex);
    if (errors.length > 0) return { ok: false, errors };

    state.cleared[tileIndex] = true;

    // Fire-and-forget: record tile clear event
    if (state.gameSessionId) {
      watchGameAuthFailure(
        apiRecordEvent({
          gameSessionId: state.gameSessionId,
          tileIndex,
          eventType: 'cleared',
        }),
      );
    }

    const newLinesWon: Array<{ line: (typeof LINES)[number]; kw: string }> = [];
    let weeklyKw: string | null = null;

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
          watchGameAuthFailure(
            apiRecordEvent({
              gameSessionId: state.gameSessionId,
              tileIndex,
              eventType: 'line_won',
              keyword: kw,
              lineId: line.id,
            }),
          );
        }

        const weeklyAward = tryWeeklyClear();
        weeklyKw = weeklyAward?.keyword || weeklyKw;
        if (weeklyAward && state.gameSessionId) {
          watchGameAuthFailure(
            apiRecordEvent({
              gameSessionId: state.gameSessionId,
              tileIndex,
              eventType: 'weekly_won',
              keyword: weeklyAward.keyword,
              lineId: `W${weeklyAward.week}`,
            }),
          );
        }
        newLinesWon.push({ line, kw });
      }
    }

    // Fire-and-forget: update session progress counts and board state
    if (state.gameSessionId) {
      watchGameAuthFailure(
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
        }),
      );
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

  function tryWeeklyClear(): { keyword: string; week: number } | null {
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
    const maxWeek = Math.min(Math.floor(elapsed / MS_PER_WEEK) + 1, TOTAL_WEEKS);
    cp.currentWeek = Math.min(cp.currentWeek + 1, maxWeek, TOTAL_WEEKS);
    return { keyword: wkw, week: awardedWeek };
  }

  function hydrateFromServer(serverState?: ServerPlayerState | null) {
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

    state.gameSessionId = session.gameSessionId ?? null;
    state.packId = session.packId ?? 0;
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
      clearRecoveryRequired();
    }
  }

  function setIdentity({
    email,
    name,
    organization,
  }: {
    email: string;
    name?: string;
    organization?: string;
  }) {
    state.email = email;
    if (state.recoveryRequired && state.recoveryEmail && state.recoveryEmail !== email) {
      clearRecoveryRequired();
    }
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

  function setEmail(email: string) {
    state.email = email;
  }

  return {
    state,
    clearedCount,
    linesWon,
    keywordCount,
    boardProgress,
    startBoard,
    rerollBoard,
    ensurePackAssignment,
    resetBoard,
    verifyTile,
    hydrateFromServer,
    setRecoveryRequired,
    clearRecoveryRequired,
    setIdentity,
    setEmail,
    campaignId: CAMPAIGN_ID,
  };
}
