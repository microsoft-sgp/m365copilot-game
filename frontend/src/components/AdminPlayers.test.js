import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AdminPlayers from './AdminPlayers.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminSearchPlayers: vi.fn(),
  apiAdminGetPlayer: vi.fn(),
  apiAdminDeletePlayer: vi.fn(),
  apiAdminRevokeSubmission: vi.fn(),
}));

const api = await import('../lib/api.js');

const playerFixture = {
  id: 3,
  player_name: 'Ada',
  email: 'ada@nus.edu.sg',
  session_count: 2,
  submission_count: 1,
};

const detailFixture = {
  player: playerFixture,
  sessions: [
    {
      id: 8,
      pack_id: 42,
      tiles_cleared: 3,
      lines_won: 1,
      keywords_earned: 2,
      last_active_at: '2026-04-29T00:00:00.000Z',
    },
  ],
  submissions: [
    {
      id: 9,
      org: 'NUS',
      keyword: 'CO-APR26-042-R1-TEST',
      created_at: '2026-04-29T00:00:00.000Z',
    },
  ],
};

let confirmSpy;

beforeEach(() => {
  vi.clearAllMocks();
  confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
  api.apiAdminSearchPlayers.mockResolvedValue({ ok: true, data: { players: [playerFixture] } });
  api.apiAdminGetPlayer.mockResolvedValue({ ok: true, data: detailFixture });
  api.apiAdminDeletePlayer.mockResolvedValue({ ok: true, data: { ok: true } });
  api.apiAdminRevokeSubmission.mockResolvedValue({ ok: true, data: { ok: true } });
});

afterEach(() => {
  confirmSpy.mockRestore();
});

describe('AdminPlayers', () => {
  it('does not search for blank queries', async () => {
    const wrapper = mount(AdminPlayers);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Search')
      .trigger('click');
    await flushPromises();
    expect(api.apiAdminSearchPlayers).not.toHaveBeenCalled();
  });

  it('searches players and opens a detail view', async () => {
    const wrapper = mount(AdminPlayers);
    await wrapper.find('input[placeholder="Search by email or name"]').setValue('ada');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Search')
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminSearchPlayers).toHaveBeenCalledWith('ada');
    expect(wrapper.text()).toContain('ada@nus.edu.sg');

    await wrapper.find('tbody tr').trigger('click');
    await flushPromises();

    expect(api.apiAdminGetPlayer).toHaveBeenCalledWith(3);
    expect(wrapper.text()).toContain('Game Sessions');
    expect(wrapper.text()).toContain('CO-APR26-042-R1-TEST');
  });

  it('revokes a submission after confirmation and refreshes details', async () => {
    const wrapper = mount(AdminPlayers);
    await wrapper.find('input[placeholder="Search by email or name"]').setValue('ada');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Search')
      .trigger('click');
    await flushPromises();
    await wrapper.find('tbody tr').trigger('click');
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Revoke')
      .trigger('click');
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith('Revoke this keyword submission?');
    expect(api.apiAdminRevokeSubmission).toHaveBeenCalledWith(9);
    expect(api.apiAdminGetPlayer).toHaveBeenCalledTimes(2);
  });

  it('deletes a selected player after confirmation and re-runs the current search', async () => {
    const wrapper = mount(AdminPlayers);
    await wrapper.find('input[placeholder="Search by email or name"]').setValue('ada');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Search')
      .trigger('click');
    await flushPromises();
    await wrapper.find('tbody tr').trigger('click');
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete Player')
      .trigger('click');
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this player and all their data? This cannot be undone.',
    );
    expect(api.apiAdminDeletePlayer).toHaveBeenCalledWith(3);
    expect(api.apiAdminSearchPlayers).toHaveBeenCalledTimes(2);
  });
});
