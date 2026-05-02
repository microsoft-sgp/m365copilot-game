import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AdminDashboard from './AdminDashboard.vue';

vi.mock('../lib/api.js', () => ({
  apiAdminGetDashboard: vi.fn(),
  apiAdminExportCsv: vi.fn(),
}));

const api = await import('../lib/api.js');

const dashboardFixture = {
  summary: {
    totalPlayers: 12,
    totalSessions: 18,
    totalSubmissions: 31,
    avgTilesCleared: 4.5,
    topOrg: 'NUS',
  },
  sessions: [
    {
      id: 1,
      player_name: 'Ada',
      pack_id: 42,
      tiles_cleared: 3,
      lines_won: 1,
      last_active_at: '2026-04-29T00:00:00.000Z',
    },
  ],
  submissions: [
    {
      id: 7,
      player_name: 'Ada',
      org: 'NUS',
      event_type: 'line_won',
      event_key: 'R1',
      keyword: 'CO-APR26-042-R1-TEST',
      created_at: '2026-04-29T00:00:00.000Z',
    },
    {
      id: 8,
      player_name: 'Grace',
      org: 'Microsoft',
      event_type: 'weekly_won',
      event_key: 'W1',
      keyword: 'CO-APR26-W1-042-WEEKLY',
      created_at: '2026-04-29T01:00:00.000Z',
    },
    {
      id: 9,
      player_name: 'Lin',
      org: 'SIM',
      event_type: null,
      event_key: null,
      keyword: 'CO-APR26-042-R2-LEGACY',
      created_at: '2026-04-29T02:00:00.000Z',
    },
    {
      id: 10,
      player_name: 'Noor',
      org: 'SMU',
      event_type: 'bonus_award',
      event_key: 'B1',
      keyword: 'CO-APR26-042-B1-BONUS',
      created_at: '2026-04-29T03:00:00.000Z',
    },
  ],
};

let createObjectUrl;
let revokeObjectUrl;
let clickSpy;

beforeEach(() => {
  vi.clearAllMocks();
  api.apiAdminGetDashboard.mockResolvedValue({ ok: true, data: dashboardFixture });
  api.apiAdminExportCsv.mockResolvedValue({ ok: true, blob: new Blob(['a,b\n1,2']) });

  createObjectUrl = vi.fn(() => 'blob:progression-scores');
  revokeObjectUrl = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrl, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectUrl, configurable: true });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  clickSpy.mockRestore();
});

describe('AdminDashboard', () => {
  it('loads and renders summary cards plus recent activity tables', async () => {
    const wrapper = mount(AdminDashboard);
    expect(wrapper.text()).toContain('Loading dashboard');

    await flushPromises();

    expect(api.apiAdminGetDashboard).toHaveBeenCalledWith();
    expect(wrapper.text()).toContain('12');
    expect(wrapper.text()).toContain('Players');
    expect(wrapper.text()).toContain('Top Org: NUS');
    expect(wrapper.text()).toContain('Avg Tasks');
    expect(wrapper.text()).toContain('Recent Sessions');
    expect(wrapper.text()).toContain('Ada');
    expect(wrapper.text()).toContain('Tasks');
    expect(wrapper.text()).toContain('Awards');
    expect(wrapper.text()).toContain('3/9');
    expect(wrapper.text()).toContain('1/8');
    expect(wrapper.text()).toContain('Achievement');
    expect(wrapper.text()).toContain('Award Code');
    expect(wrapper.text()).toContain('Line completed');
    expect(wrapper.text()).toContain('Task 1');
    expect(wrapper.text()).toContain('Weekly award earned');
    expect(wrapper.text()).toContain('Week 1');
    expect(wrapper.text()).toContain('Legacy keyword submission');
    expect(wrapper.text()).toContain('Bonus Award');
    expect(wrapper.text()).not.toContain('line_won');
    expect(wrapper.text()).not.toContain('weekly_won');
    expect(wrapper.text()).not.toContain('legacy_submission');
    expect(wrapper.text()).not.toContain('bonus_award');
    expect(wrapper.text()).not.toContain('Avg Tiles');
    expect(wrapper.text()).not.toContain('Tiles');
    expect(wrapper.text()).not.toContain('Lines');
    expect(wrapper.text()).toContain('CO-APR26-042-R1-TEST');

    const progressbars = wrapper.findAll('[role="progressbar"]');
    expect(progressbars).toHaveLength(2);
    expect(progressbars[0].attributes('aria-label')).toBe('Tasks completed');
    expect(progressbars[0].attributes('aria-valuenow')).toBe('3');
    expect(progressbars[0].attributes('aria-valuemax')).toBe('9');
    expect(progressbars[0].find('.progress-fill').attributes('style')).toContain('33%');
    expect(progressbars[1].attributes('aria-label')).toBe('Awards earned');
    expect(progressbars[1].attributes('aria-valuenow')).toBe('1');
    expect(progressbars[1].attributes('aria-valuemax')).toBe('8');
    expect(progressbars[1].find('.progress-fill').attributes('style')).toContain('13%');
  });

  it('exports dashboard CSV with the expected filename', async () => {
    const wrapper = mount(AdminDashboard);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Export CSV'))
      .trigger('click');
    await flushPromises();

    expect(api.apiAdminExportCsv).toHaveBeenCalledWith();
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:progression-scores');
  });

  it('renders a failure state when the dashboard payload is unavailable', async () => {
    api.apiAdminGetDashboard.mockResolvedValueOnce({ ok: false, data: null });
    const wrapper = mount(AdminDashboard);
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load dashboard');
  });
});
