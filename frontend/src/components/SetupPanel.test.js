import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRerollAssignment: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiGetPlayerState: vi.fn().mockResolvedValue({ ok: true, data: { player: null } }),
  apiPlayerRecoveryRequest: vi.fn().mockResolvedValue({ ok: true, data: { ok: true } }),
  apiPlayerRecoveryVerify: vi.fn().mockResolvedValue({ ok: true, data: { playerToken: 'token' } }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
  isAssignmentNotActiveResponse: vi.fn(
    (res) => res.status === 409 && res.data?.code === 'ASSIGNMENT_NOT_ACTIVE',
  ),
  isPlayerRecoveryRequiredResponse: vi.fn(
    (res) => res.status === 409 && res.data?.code === 'PLAYER_RECOVERY_REQUIRED',
  ),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import {
  apiCreateSession,
  apiGetPlayerState,
  apiPlayerRecoveryRequest,
  apiPlayerRecoveryVerify,
} from '../lib/api.js';
import SetupPanel from './SetupPanel.vue';

beforeEach(() => {
  localStorage.clear();
  const { state } = useBingoGame();
  state.sessionId = 'test-session';
  state.boardActive = false;
  state.tiles = [];
  state.cleared = [];
  state.playerName = '';
  state.email = '';
  state.organization = '';
  state.assignmentId = null;
  state.assignedPackId = 0;
  state.assignmentCycle = 0;
  state.assignmentRotated = false;
  state.completedPackId = null;
  state.packId = 0;
  state.gameSessionId = null;
  state.challengeProfile = null;
  state.recoveryRequired = false;
  state.recoveryEmail = '';
  state.recoveryMessage = '';
  apiCreateSession.mockResolvedValue({ ok: false, data: null });
  apiGetPlayerState.mockResolvedValue({ ok: true, data: { player: null } });
  apiPlayerRecoveryRequest.mockResolvedValue({ ok: true, data: { ok: true } });
  apiPlayerRecoveryVerify.mockResolvedValue({ ok: true, data: { playerToken: 'token' } });
});

afterEach(() => vi.clearAllMocks());

describe('SetupPanel', () => {
  beforeEach(() => {
    localStorage.setItem('copilot_bingo_player_name', 'Ada');
    const { state } = useBingoGame();
    state.assignedPackId = 42;
    state.assignmentCycle = 2;
    state.assignmentRotated = false;
    state.completedPackId = null;
  });

  it('renders assigned-pack setup with Launch Board button', () => {
    const w = mount(SetupPanel);
    expect(w.text()).toContain('Start Your Board');
    expect(w.text()).toContain('#042');
    expect(w.text()).toContain('Your current pack is ready.');
    expect(w.text()).not.toContain('locked for this challenge cycle');
    expect(w.findAll('button').some((b) => b.text().includes('Launch Board'))).toBe(true);
    expect(w.text()).not.toContain('Quick Pick');
    expect(w.find('input[type="number"]').exists()).toBe(false);
  });

  it('calls startBoard on valid input', async () => {
    const w = mount(SetupPanel);
    await w
      .findAll('button')
      .find((b) => b.text().includes('Launch Board'))
      .trigger('click');
    await flushPromises();
    const { state } = useBingoGame();
    expect(state.boardActive).toBe(true);
    expect(state.playerName).toBe('Ada');
    expect(state.packId).toBe(42);
  });

  it('requests first assignment from the server when the setup panel appears', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    const { state } = useBingoGame();
    state.assignedPackId = 0;
    localStorage.removeItem('copilot_bingo_last_pack');
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: {
        gameSessionId: 123,
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

    const w = mount(SetupPanel);
    await flushPromises();

    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Ada',
      email: 'ada@example.com',
    });
    expect(state.boardActive).toBe(false);
    expect(w.text()).toContain('#088');

    await w
      .findAll('button')
      .find((b) => b.text().includes('Launch Board'))
      .trigger('click');
    await flushPromises();

    expect(state.boardActive).toBe(true);
    expect(state.packId).toBe(88);
    expect(state.assignedPackId).toBe(88);
    expect(state.gameSessionId).toBe(123);
  });

  it('includes stored organization when assigning a public-email player', async () => {
    localStorage.setItem('copilot_bingo_email', 'alex@gmail.com');
    localStorage.setItem('copilot_bingo_organization', 'Contoso');
    const { state } = useBingoGame();
    state.assignedPackId = 0;
    localStorage.removeItem('copilot_bingo_last_pack');
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: {
        gameSessionId: 123,
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

    mount(SetupPanel);
    await flushPromises();

    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Ada',
      email: 'alex@gmail.com',
      organization: 'Contoso',
    });
  });

  it('does not render #000 while assignment is pending', () => {
    const { state } = useBingoGame();
    state.assignedPackId = 0;
    localStorage.removeItem('copilot_bingo_last_pack');
    const w = mount(SetupPanel);
    expect(w.text()).toContain('#---');
    expect(w.text()).not.toContain('#000');
  });

  it('shows assignment rotation copy when server marks rotated assignment', () => {
    const { state } = useBingoGame();
    state.assignmentRotated = true;
    state.completedPackId = 12;
    const w = mount(SetupPanel);
    expect(w.text()).toContain('Pack #012');
    expect(w.text()).toContain('new pack has been assigned');
  });

  it('uses last pack from localStorage when assigned pack is not yet hydrated', () => {
    const { state } = useBingoGame();
    state.assignedPackId = 0;
    localStorage.setItem('copilot_bingo_last_pack', '77');
    const w = mount(SetupPanel);
    expect(w.text()).toContain('#077');
  });

  it('blocks launch if onboarding identity is missing', async () => {
    localStorage.removeItem('copilot_bingo_player_name');
    const w = mount(SetupPanel);
    await w
      .findAll('button')
      .find((b) => b.text().includes('Launch Board'))
      .trigger('click');
    expect(w.text()).toContain('complete onboarding identity');
    expect(useBingoGame().state.boardActive).toBe(false);
  });

  it('shows recovery UI and requests a recovery code', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    const { state } = useBingoGame();
    state.recoveryRequired = true;
    state.recoveryEmail = 'ada@example.com';

    const w = mount(SetupPanel);
    await flushPromises();

    expect(w.text()).toContain('Player Recovery');
    expect(w.text()).toContain('ada@example.com');
    expect(
      w
        .findAll('button')
        .find((b) => b.text().includes('Launch Board'))
        .attributes('disabled'),
    ).toBeDefined();

    await w
      .findAll('button')
      .find((b) => b.text().includes('Send Code'))
      .trigger('click');
    await flushPromises();

    expect(apiPlayerRecoveryRequest).toHaveBeenCalledWith('ada@example.com');
    expect(w.text()).toContain('Recovery code sent');
  });

  it('verifies recovery, retries session bootstrap, and hydrates server board state without admin state', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('admin_email');
    const { state } = useBingoGame();
    state.recoveryRequired = true;
    state.recoveryEmail = 'ada@example.com';
    state.assignedPackId = 42;
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: { gameSessionId: 123, packId: 42, activeAssignment: { packId: 42 } },
    });
    apiGetPlayerState.mockResolvedValue({
      ok: true,
      data: {
        player: {
          playerName: 'Ada',
          activeAssignment: { packId: 42, cycleNumber: 1 },
          activeSession: {
            gameSessionId: 123,
            packId: 42,
            boardState: {
              cleared: [true, false, false, false, false, false, false, false, false],
              wonLines: [],
              keywords: [],
            },
          },
        },
      },
    });

    const w = mount(SetupPanel);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text().includes('Send Code'))
      .trigger('click');
    await flushPromises();
    await w.find('input[placeholder="000000"]').setValue('123456');
    await w
      .findAll('button')
      .find((b) => b.text().includes('Verify Code'))
      .trigger('click');
    await flushPromises();

    expect(apiPlayerRecoveryVerify).toHaveBeenCalledWith('ada@example.com', '123456');
    expect(apiCreateSession).toHaveBeenCalledWith({
      sessionId: 'test-session',
      playerName: 'Ada',
      email: 'ada@example.com',
      packId: 42,
    });
    expect(apiGetPlayerState).toHaveBeenCalledWith('ada@example.com');
    expect(state.recoveryRequired).toBe(false);
    expect(state.boardActive).toBe(true);
    expect(state.gameSessionId).toBe(123);
    expect(state.cleared[0]).toBe(true);
    expect(sessionStorage.getItem('admin_authenticated')).toBeNull();
    expect(sessionStorage.getItem('admin_email')).toBeNull();
  });
});
