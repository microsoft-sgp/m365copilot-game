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

function findButton(wrapper, label) {
  return wrapper.findAll('button').find((b) => b.text().includes(label));
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function showRecoveryForAda() {
  localStorage.setItem('copilot_bingo_email', 'ada@example.com');
  const { state } = useBingoGame();
  state.recoveryRequired = true;
  state.recoveryEmail = 'ada@example.com';
}

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

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

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
    showRecoveryForAda();

    const w = mount(SetupPanel);
    await flushPromises();

    expect(w.text()).toContain('Player Recovery');
    expect(w.text()).toContain('Recover your board');
    expect(w.text()).toContain('ada@example.com');
    const sendCode = findButton(w, 'Send Recovery Code');
    const differentEmail = findButton(w, 'Use Different Email');
    const launchBoard = findButton(w, 'Launch Board');

    expect(sendCode.classes()).toEqual(expect.arrayContaining(['btn', 'btn-primary', 'w-full']));
    expect(differentEmail.classes()).toEqual(expect.arrayContaining(['btn', 'btn-ghost', 'w-full']));
    expect(launchBoard.attributes('disabled')).toBeDefined();

    await sendCode.trigger('click');
    await flushPromises();

    expect(apiPlayerRecoveryRequest).toHaveBeenCalledWith('ada@example.com');
    expect(w.text()).toContain('Recovery code sent');
    expect(w.text()).toContain('Enter recovery code');
    expect(w.find('input[placeholder="000000"]').classes()).toContain('field-input');
    expect(findButton(w, 'Verify Code').classes()).toContain('btn-primary');
    expect(findButton(w, 'Send Again').classes()).toContain('btn-ghost');
  });

  it('shows delivery confirmation status while recovery request remains pending', async () => {
    vi.useFakeTimers();
    showRecoveryForAda();
    const pending = deferred();
    apiPlayerRecoveryRequest.mockReturnValue(pending.promise);

    const w = mount(SetupPanel);
    await w.vm.$nextTick();

    await findButton(w, 'Send Recovery Code').trigger('click');
    await w.vm.$nextTick();

    expect(w.text()).toContain('Sending...');
    expect(findButton(w, 'Sending...').attributes('disabled')).toBeDefined();
    expect(w.find('input[placeholder="000000"]').exists()).toBe(false);

    vi.advanceTimersByTime(3000);
    await w.vm.$nextTick();

    expect(w.text()).toContain('Confirming delivery...');
    expect(findButton(w, 'Confirming delivery...').attributes('disabled')).toBeDefined();
    expect(w.find('input[placeholder="000000"]').exists()).toBe(false);

    pending.resolve({ ok: true, data: { ok: true } });
    await pending.promise;
    await w.vm.$nextTick();

    expect(w.text()).toContain('Recovery code sent');
    expect(w.find('input[placeholder="000000"]').exists()).toBe(true);
  });

  it('clears delivery confirmation status when recovery request fails', async () => {
    vi.useFakeTimers();
    showRecoveryForAda();
    const pending = deferred();
    apiPlayerRecoveryRequest.mockReturnValue(pending.promise);

    const w = mount(SetupPanel);
    await w.vm.$nextTick();

    await findButton(w, 'Send Recovery Code').trigger('click');
    vi.advanceTimersByTime(3000);
    await w.vm.$nextTick();
    expect(w.text()).toContain('Confirming delivery...');

    pending.resolve({ ok: false, status: 500, data: { message: 'mail down' } });
    await pending.promise;
    await w.vm.$nextTick();

    expect(w.text()).toContain('mail down');
    expect(w.text()).not.toContain('Confirming delivery...');
    expect(findButton(w, 'Send Recovery Code').attributes('disabled')).toBeUndefined();
    expect(w.find('input[placeholder="000000"]').exists()).toBe(false);
  });

  it('clears the slow-send timer when unmounted mid-request', async () => {
    vi.useFakeTimers();
    showRecoveryForAda();
    const pending = deferred();
    apiPlayerRecoveryRequest.mockReturnValue(pending.promise);

    const w = mount(SetupPanel);
    await w.vm.$nextTick();

    await findButton(w, 'Send Recovery Code').trigger('click');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    w.unmount();
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve({ ok: true, data: { ok: true } });
    await pending.promise;
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
      .find((b) => b.text().includes('Send Recovery Code'))
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

  it('shows invalid-or-expired copy for recovery verification 401 responses', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    const { state } = useBingoGame();
    state.recoveryRequired = true;
    state.recoveryEmail = 'ada@example.com';
    apiPlayerRecoveryVerify.mockResolvedValueOnce({
      ok: false,
      status: 401,
      data: { ok: false, message: 'Invalid or expired code' },
    });

    const w = mount(SetupPanel);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text().includes('Send Recovery Code'))
      .trigger('click');
    await flushPromises();
    await w.find('input[placeholder="000000"]').setValue('123456');
    await w
      .findAll('button')
      .find((b) => b.text().includes('Verify Code'))
      .trigger('click');
    await flushPromises();

    expect(w.text()).toContain('Invalid or expired code');
    expect(w.text()).not.toContain('Could not verify recovery code');
    expect(state.recoveryRequired).toBe(true);
  });

  it('shows retry copy for recovery verification service failures', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    const { state } = useBingoGame();
    state.recoveryRequired = true;
    state.recoveryEmail = 'ada@example.com';
    apiPlayerRecoveryVerify.mockResolvedValueOnce({
      ok: false,
      status: 500,
      data: { ok: false, message: 'Internal Server Error' },
    });

    const w = mount(SetupPanel);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text().includes('Send Recovery Code'))
      .trigger('click');
    await flushPromises();
    await w.find('input[placeholder="000000"]').setValue('123456');
    await w
      .findAll('button')
      .find((b) => b.text().includes('Verify Code'))
      .trigger('click');
    await flushPromises();

    expect(w.text()).toContain('Could not verify recovery code. Please try again.');
    expect(w.text()).not.toContain('Invalid or expired code');
    expect(state.recoveryRequired).toBe(true);
  });

  it('shows resume failure copy when recovery succeeds but the board cannot relaunch', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    localStorage.removeItem('copilot_bingo_last_pack');
    const { state } = useBingoGame();
    state.recoveryRequired = true;
    state.recoveryEmail = 'ada@example.com';
    state.assignedPackId = 0;
    apiCreateSession.mockResolvedValue({ ok: false, status: 503, data: { ok: false } });

    const w = mount(SetupPanel);
    await flushPromises();
    await findButton(w, 'Send Recovery Code').trigger('click');
    await flushPromises();
    await w.find('input[placeholder="000000"]').setValue('123456');
    await findButton(w, 'Verify Code').trigger('click');
    await flushPromises();

    expect(apiPlayerRecoveryVerify).toHaveBeenCalledWith('ada@example.com', '123456');
    expect(w.text()).toContain('Unable to resolve your assigned pack. Please try again.');
    expect(state.recoveryRequired).toBe(false);
    expect(state.boardActive).toBe(false);
  });

  it('still completes recovery when no server player state is returned after relaunch', async () => {
    localStorage.setItem('copilot_bingo_email', 'ada@example.com');
    const { state } = useBingoGame();
    state.recoveryRequired = true;
    state.recoveryEmail = 'ada@example.com';
    state.assignedPackId = 42;
    apiCreateSession.mockResolvedValue({
      ok: true,
      data: { gameSessionId: 123, packId: 42, activeAssignment: { packId: 42 } },
    });
    apiGetPlayerState.mockResolvedValueOnce({ ok: true, data: { player: null } });

    const w = mount(SetupPanel);
    await flushPromises();
    await findButton(w, 'Send Recovery Code').trigger('click');
    await flushPromises();
    await w.find('input[placeholder="000000"]').setValue('123456');
    await findButton(w, 'Verify Code').trigger('click');
    await flushPromises();

    expect(apiGetPlayerState).toHaveBeenCalledWith('ada@example.com');
    expect(w.text()).not.toContain('Player Recovery');
    expect(state.recoveryRequired).toBe(false);
    expect(state.boardActive).toBe(true);
    expect(state.gameSessionId).toBe(123);
  });
});
