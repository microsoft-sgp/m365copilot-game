import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Silence the fire-and-forget API calls so tests don't touch the real fetch.
vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
  isPlayerRecoveryRequiredResponse: vi.fn(
    (res) => res.status === 409 && res.data?.code === 'PLAYER_RECOVERY_REQUIRED',
  ),
}));

// Swap the pack generator for a predictable 9-tile fixture whose verify
// function accepts any proof containing "PASS". This isolates the game-state
// logic (line detection, keyword minting, persistence) from the rule engine,
// which is already covered by verification.test.js.
vi.mock('../lib/packGenerator.js', () => ({
  getPack: (packId) =>
    Array.from({ length: 9 }, (_, i) => ({
      title: `Tile ${i}`,
      tag: 'Test',
      tileIndex: i,
      packId,
      prompt: `Prompt ${i}`,
      verify: (proof) => (proof.includes('PASS') ? [] : ['invalid proof']),
    })),
}));

import { apiCreateSession, apiRecordEvent, apiUpdateSession } from '../lib/api.js';
import { useBingoGame } from './useBingoGame.js';
import { LINES } from '../data/lines.js';
import { MS_PER_WEEK } from '../data/constants.js';

function resetState() {
  const { state } = useBingoGame();
  state.sessionId = 'test-session';
  state.playerName = '';
  state.email = '';
  state.organization = '';
  state.assignedPackId = 0;
  state.assignmentCycle = 0;
  state.assignmentRotated = false;
  state.completedPackId = null;
  state.packId = 0;
  state.gameSessionId = null;
  state.tiles = [];
  state.cleared = [];
  state.wonLines = [];
  state.keywords = [];
  state.challengeProfile = null;
  state.boardActive = false;
  state.recoveryRequired = false;
  state.recoveryEmail = '';
  state.recoveryMessage = '';
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  apiCreateSession.mockResolvedValue({ ok: false, data: null });
  apiUpdateSession.mockResolvedValue({ ok: false, data: null });
  apiRecordEvent.mockResolvedValue({ ok: false, data: null });
  resetState();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBingoGame.ensurePackAssignment', () => {
  it('stores a server-assigned pack without activating the board', async () => {
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: {
        gameSessionId: 456,
        packId: 88,
        activeAssignment: {
          assignmentId: 9,
          packId: 88,
          cycleNumber: 1,
          rotated: false,
          completedPackId: null,
        },
      },
    });

    const { ensurePackAssignment, state } = useBingoGame();
    const result = await ensurePackAssignment({ name: 'Ada', email: 'ada@example.com' });

    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Ada',
      email: 'ada@example.com',
    });
    expect(result).toEqual({ ok: true, packId: 88 });
    expect(state.boardActive).toBe(false);
    expect(state.packId).toBe(0);
    expect(state.assignedPackId).toBe(88);
    expect(state.assignmentCycle).toBe(1);
    expect(state.gameSessionId).toBe(456);
    expect(localStorage.getItem('copilot_bingo_last_pack')).toBe('88');
  });

  it('does not call the API when an assignment is already available', async () => {
    const { ensurePackAssignment, state } = useBingoGame();
    state.assignedPackId = 42;

    const result = await ensurePackAssignment({ name: 'Ada', email: 'ada@example.com' });

    expect(result).toEqual({ ok: true, packId: 42 });
    expect(apiCreateSession).not.toHaveBeenCalled();
  });

  it('enters recovery-required state when session creation returns recoverable 409', async () => {
    apiCreateSession.mockResolvedValue({
      ok: false,
      status: 409,
      data: { ok: false, code: 'PLAYER_RECOVERY_REQUIRED', message: 'Identity in use' },
    });

    const { ensurePackAssignment, state } = useBingoGame();
    const result = await ensurePackAssignment({ name: 'Ada', email: 'ada@example.com' });

    expect(result.recoveryRequired).toBe(true);
    expect(state.recoveryRequired).toBe(true);
    expect(state.recoveryEmail).toBe('ada@example.com');
    expect(state.boardActive).toBe(false);
  });
});

describe('useBingoGame.startBoard', () => {
  it('populates tiles and marks the board active', () => {
    const { startBoard, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 42 });
    expect(state.boardActive).toBe(true);
    expect(state.playerName).toBe('Ada');
    expect(state.packId).toBe(42);
    expect(state.tiles).toHaveLength(9);
    expect(state.cleared).toEqual(new Array(9).fill(false));
    expect(state.tiles[0].title).toBe('Tile 0');
  });

  it('initializes a fresh challenge profile when none exists', () => {
    const before = Date.now();
    const { startBoard, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    expect(state.challengeProfile.currentWeek).toBe(1);
    expect(state.challengeProfile.weeksCompleted).toBe(0);
    expect(state.challengeProfile.weeklySubmissions).toEqual([]);
    expect(state.challengeProfile.challengeStartAt).toBeGreaterThanOrEqual(before);
  });

  it('preserves an existing challenge profile across new boards', () => {
    const { startBoard, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    state.challengeProfile.currentWeek = 3;
    state.challengeProfile.weeksCompleted = 2;
    startBoard({ name: 'Ada', packId: 2 });
    expect(state.challengeProfile.currentWeek).toBe(3);
    expect(state.challengeProfile.weeksCompleted).toBe(2);
  });

  it('persists player name and last pack to localStorage', () => {
    const { startBoard } = useBingoGame();
    startBoard({ name: 'Ada', packId: 42 });
    expect(localStorage.getItem('copilot_bingo_player_name')).toBe('Ada');
    expect(localStorage.getItem('copilot_bingo_last_pack')).toBe('42');
  });

  it('includes organization in the session payload when stored', async () => {
    apiCreateSession.mockResolvedValue({ ok: true, data: { gameSessionId: 789 } });
    const { startBoard, state } = useBingoGame();

    await startBoard({ name: 'Alex', email: 'alex@gmail.com', organization: 'Contoso', packId: 1 });

    expect(state.organization).toBe('Contoso');
    expect(localStorage.getItem('copilot_bingo_organization')).toBe('Contoso');
    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Alex',
      email: 'alex@gmail.com',
      organization: 'Contoso',
      packId: 1,
    });
  });

  it('calls apiCreateSession and stores the returned gameSessionId', async () => {
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: { gameSessionId: 789 },
    });
    const { startBoard, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Ada',
      email: '',
      packId: 1,
    });
    expect(state.gameSessionId).toBe(789);
  });

  it('starts with a server-assigned pack when no client pack is available yet', async () => {
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: {
        gameSessionId: 456,
        packId: 88,
        activeAssignment: {
          assignmentId: 9,
          packId: 88,
          cycleNumber: 1,
          rotated: false,
          completedPackId: null,
        },
      },
    });

    const { startBoard, state } = useBingoGame();
    const result = await startBoard({ name: 'Ada', email: 'ada@example.com' });

    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Ada',
      email: 'ada@example.com',
    });
    expect(result).toEqual({ ok: true, packId: 88 });
    expect(state.boardActive).toBe(true);
    expect(state.packId).toBe(88);
    expect(state.assignedPackId).toBe(88);
    expect(state.assignmentCycle).toBe(1);
    expect(state.gameSessionId).toBe(456);
  });

  it('does not launch cached local board state after a recoverable conflict', async () => {
    apiCreateSession.mockResolvedValue({
      ok: false,
      status: 409,
      data: { ok: false, code: 'PLAYER_RECOVERY_REQUIRED', message: 'Identity in use' },
    });
    const { startBoard, state } = useBingoGame();
    state.assignedPackId = 77;
    localStorage.setItem('copilot_bingo_last_pack', '77');

    const result = await startBoard({ name: 'Ada', email: 'ada@example.com', packId: 77 });

    expect(result.recoveryRequired).toBe(true);
    expect(state.recoveryRequired).toBe(true);
    expect(state.boardActive).toBe(false);
    expect(state.tiles).toEqual([]);
    expect(state.packId).toBe(0);
  });

  it('continues when apiCreateSession rejects', async () => {
    apiCreateSession.mockRejectedValue(new Error('network'));
    const { startBoard, state } = useBingoGame();
    expect(() => startBoard({ name: 'Ada', packId: 1 })).not.toThrow();
    await Promise.resolve();
    expect(state.gameSessionId).toBeNull();
  });
});

describe('useBingoGame.resetBoard', () => {
  it('clears tiles and deactivates the board', () => {
    const { startBoard, resetBoard, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    resetBoard();
    expect(state.boardActive).toBe(false);
    expect(state.tiles).toEqual([]);
    expect(state.cleared).toEqual([]);
  });
});

describe('useBingoGame.verifyTile', () => {
  it('blocks tile verification while recovery is required', () => {
    const { setRecoveryRequired, startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    setRecoveryRequired('ada@example.com');

    const result = verifyTile(0, 'PASS please');

    expect(result.ok).toBe(false);
    expect(state.cleared).toEqual(new Array(9).fill(false));
  });

  it('returns errors and does not clear the tile on invalid proof', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    const res = verifyTile(0, 'no-pass-marker');
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(['invalid proof']);
    expect(state.cleared[0]).toBeFalsy();
  });

  it('returns ok and marks the tile cleared on a valid proof', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    const res = verifyTile(0, 'PASS please');
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(state.cleared[0]).toBe(true);
  });

  it('returns an error when no tile exists at the index', () => {
    const { verifyTile } = useBingoGame();
    const res = verifyTile(99, 'PASS');
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(['No active tile.']);
  });

  it('awards a line keyword and weekly keyword on 3-in-a-row', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    let last;
    for (const i of [0, 1, 2]) last = verifyTile(i, 'PASS');
    expect(last.lineWon).toBeTruthy();
    expect(last.lineWon.line.id).toBe('R1');
    expect(last.lineWon.kw).toMatch(/^CO-APR26-001-R1-/);
    expect(last.weeklyKw).toMatch(/^CO-APR26-W1-001-/);
    expect(state.wonLines).toEqual(['R1']);
    expect(state.keywords.map((k) => k.lineId).sort()).toEqual(['R1', 'W1']);
  });

  it('does not double-award the same line on repeat clears', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    for (const i of [0, 1, 2]) verifyTile(i, 'PASS');
    const r1Count = state.keywords.filter((k) => k.lineId === 'R1').length;
    const res = verifyTile(2, 'PASS'); // re-submit a cleared tile
    expect(res.lineWon).toBeNull();
    expect(state.keywords.filter((k) => k.lineId === 'R1')).toHaveLength(r1Count);
  });

  it('does not award a second weekly keyword in the same week', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    for (const i of [0, 1, 2]) verifyTile(i, 'PASS'); // win R1 → week 1 minted
    let r2Result;
    for (const i of [3, 4, 5]) r2Result = verifyTile(i, 'PASS'); // win R2
    expect(r2Result.lineWon.line.id).toBe('R2');
    expect(r2Result.weeklyKw).toBeNull();
    expect(state.keywords.filter((k) => /^W/.test(k.lineId))).toHaveLength(1);
  });

  it('fires apiRecordEvent for cleared + line_won when a gameSessionId is set', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    state.gameSessionId = 42;
    for (const i of [0, 1, 2]) verifyTile(i, 'PASS');
    const events = apiRecordEvent.mock.calls.map((c) => c[0].eventType);
    expect(events.filter((e) => e === 'cleared')).toHaveLength(3);
    expect(events.filter((e) => e === 'line_won').length).toBeGreaterThanOrEqual(1);
  });

  it('does not fire apiRecordEvent when no gameSessionId is set', () => {
    const { startBoard, verifyTile } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    verifyTile(0, 'PASS');
    expect(apiRecordEvent).not.toHaveBeenCalled();
  });

  it('calls apiUpdateSession with running progress counts', () => {
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    state.gameSessionId = 42;
    verifyTile(0, 'PASS');
    expect(apiUpdateSession).toHaveBeenCalled();
    const [id, counts] = apiUpdateSession.mock.calls.at(-1);
    expect(id).toBe(42);
    expect(counts).toMatchObject({ tilesCleared: 1, linesWon: 0, keywordsEarned: 0 });
    expect(counts.boardState).toBeDefined();
  });

  it('pauses the board when a game API ownership failure remains after refresh', async () => {
    apiRecordEvent.mockResolvedValue({ ok: false, status: 401, data: { ok: false } });
    const { startBoard, verifyTile, state } = useBingoGame();
    await startBoard({ name: 'Ada', email: 'ada@example.com', packId: 1 });
    state.gameSessionId = 42;

    verifyTile(0, 'PASS please');
    await Promise.resolve();

    expect(state.recoveryRequired).toBe(true);
    expect(state.boardActive).toBe(false);
  });

  it('advances currentWeek after a weekly mint when elapsed time permits', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { startBoard, verifyTile, state } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    // Advance far into week 2 so the post-mint week bump can move from 1 → 2.
    vi.setSystemTime(MS_PER_WEEK + 1000);
    for (const i of [0, 1, 2]) verifyTile(i, 'PASS');
    expect(state.challengeProfile.currentWeek).toBe(2);
    expect(state.challengeProfile.weeksCompleted).toBe(1);
  });
});

describe('useBingoGame computed counters', () => {
  it('clearedCount reflects only truthy entries', () => {
    const { startBoard, state, clearedCount } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    state.cleared[0] = true;
    state.cleared[2] = true;
    expect(clearedCount.value).toBe(2);
  });

  it('boardProgress rounds (clearedCount/9) to percent', () => {
    const { startBoard, state, boardProgress } = useBingoGame();
    startBoard({ name: 'Ada', packId: 1 });
    state.cleared[0] = true;
    expect(boardProgress.value).toBe(11);
    for (let i = 0; i < 9; i++) state.cleared[i] = true;
    expect(boardProgress.value).toBe(100);
  });

  it('linesWon and keywordCount track their arrays', () => {
    const { state, linesWon, keywordCount } = useBingoGame();
    state.wonLines = ['R1', 'R2'];
    state.keywords = [{ code: 'a' }, { code: 'b' }, { code: 'c' }];
    expect(linesWon.value).toBe(2);
    expect(keywordCount.value).toBe(3);
  });
});

describe('useBingoGame assignment hydration', () => {
  it('hydrates assigned pack without forcing board active when no active session exists', () => {
    const { hydrateFromServer, state } = useBingoGame();
    hydrateFromServer({
      playerName: 'Ada',
      organization: { id: 10, name: 'Contoso' },
      activeAssignment: {
        assignmentId: 21,
        packId: 88,
        cycleNumber: 3,
        rotated: false,
        completedPackId: null,
      },
      activeSession: null,
    });

    expect(state.playerName).toBe('Ada');
    expect(state.organization).toBe('Contoso');
    expect(localStorage.getItem('copilot_bingo_organization')).toBe('Contoso');
    expect(state.assignedPackId).toBe(88);
    expect(state.assignmentCycle).toBe(3);
    expect(state.boardActive).toBe(false);
  });

  it('hydrates rotation metadata for next cycle messaging', () => {
    const { hydrateFromServer, state } = useBingoGame();
    hydrateFromServer({
      playerName: 'Ada',
      activeAssignment: {
        assignmentId: 30,
        packId: 91,
        cycleNumber: 4,
        rotated: true,
        completedPackId: 90,
      },
      activeSession: null,
    });

    expect(state.assignmentRotated).toBe(true);
    expect(state.completedPackId).toBe(90);
  });
});

describe('useBingoGame exposed metadata', () => {
  it('exposes campaignId', () => {
    const { campaignId } = useBingoGame();
    expect(campaignId).toBe('APR26');
  });

  it('all LINES have exactly 3 cells (sanity invariant)', () => {
    LINES.forEach((l) => expect(l.cells).toHaveLength(3));
  });
});

describe('useBingoGame.hydrateFromServer session restoration', () => {
  it('is a no-op for null/undefined server state', () => {
    const { hydrateFromServer, state } = useBingoGame();
    state.playerName = 'KeepMe';
    hydrateFromServer(null);
    hydrateFromServer(undefined);
    expect(state.playerName).toBe('KeepMe');
    expect(state.boardActive).toBe(false);
  });

  it('restores cleared/wonLines/keywords/challengeProfile from board state', () => {
    const { hydrateFromServer, state } = useBingoGame();
    hydrateFromServer({
      playerName: 'Ada',
      activeAssignment: { assignmentId: 1, packId: 7, cycleNumber: 1 },
      activeSession: {
        gameSessionId: 555,
        packId: 7,
        boardState: {
          cleared: [true, false, true, false, false, false, false, false, false],
          wonLines: ['R1'],
          keywords: [{ code: 'WK1', packId: 7, lineId: 'W1', ts: 1 }],
          challengeProfile: {
            currentWeek: 2,
            weeksCompleted: 1,
            weeklySubmissions: [1],
            challengeStartAt: 0,
          },
        },
      },
    });
    expect(state.gameSessionId).toBe(555);
    expect(state.packId).toBe(7);
    expect(state.cleared.filter(Boolean)).toHaveLength(2);
    expect(state.wonLines).toEqual(['R1']);
    expect(state.keywords).toHaveLength(1);
    expect(state.challengeProfile.currentWeek).toBe(2);
    expect(state.boardActive).toBe(true);
    expect(state.tiles).toHaveLength(9);
  });

  it('does not activate board when packId is missing on session', () => {
    const { hydrateFromServer, state } = useBingoGame();
    hydrateFromServer({
      playerName: 'Ada',
      activeSession: { gameSessionId: 1, packId: 0 },
    });
    expect(state.boardActive).toBe(false);
  });

  it('falls back to empty arrays when boardState fields are missing', () => {
    const { hydrateFromServer, state } = useBingoGame();
    hydrateFromServer({
      playerName: 'Ada',
      activeAssignment: { assignmentId: 1, packId: 3, cycleNumber: 1 },
      activeSession: { gameSessionId: 9, packId: 3, boardState: {} },
    });
    expect(state.cleared).toEqual([]);
    expect(state.wonLines).toEqual([]);
    expect(state.keywords).toEqual([]);
    expect(state.boardActive).toBe(true);
  });
});
