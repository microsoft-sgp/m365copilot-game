import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool } from '../test-helpers/mockPool.js';

const beginSpy = vi.fn();
const commitSpy = vi.fn();
const rollbackSpy = vi.fn();

vi.mock('mssql', async () => {
  class Transaction {
    constructor(pool) {
      this.pool = pool;
    }

    async begin(level) {
      beginSpy(level);
    }

    request() {
      return this.pool.request();
    }

    async commit() {
      commitSpy();
    }

    async rollback() {
      rollbackSpy();
    }
  }

  return {
    default: {
      Int: 'Int',
      NVarChar: () => 'NVarChar',
      ISOLATION_LEVEL: { SERIALIZABLE: 'SERIALIZABLE' },
      Transaction,
    },
  };
});

const { resolvePackAssignment, rerollPackAssignment, isPackAssignmentLifecycleEnabled } =
  await import('./packAssignments.js');

function assignmentRow(overrides = {}) {
  return {
    id: 10,
    player_id: 1,
    campaign_id: 'APR26',
    pack_id: 10,
    cycle_number: 1,
    status: 'active',
    assigned_at: '2026-04-26T00:00:00Z',
    completed_at: null,
    abandoned_at: null,
    ...overrides,
  };
}

describe('packAssignments', () => {
  beforeEach(() => {
    beginSpy.mockReset();
    commitSpy.mockReset();
    rollbackSpy.mockReset();
    delete process.env.ENABLE_PACK_ASSIGNMENT_LIFECYCLE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults lifecycle flag to enabled', () => {
    expect(isPackAssignmentLifecycleEnabled()).toBe(true);
    process.env.ENABLE_PACK_ASSIGNMENT_LIFECYCLE = 'false';
    expect(isPackAssignmentLifecycleEnabled()).toBe(false);
  });

  it('creates first active assignment from unused campaign packs when none exists', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5);
    const context = { log: vi.fn() };

    const { pool, calls } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 5, total_weeks: 7 }] },
      { recordset: [] },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      {
        recordset: [
          { pack_id: 1, active_count: 1 },
          { pack_id: 3, active_count: 1 },
        ],
      },
      { recordset: [{ next_cycle: 1 }] },
      {
        recordset: [assignmentRow({ pack_id: 4 })],
      },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true, context });

    expect(result.assignment.packId).toBe(4);
    expect(result.assignment.cycleNumber).toBe(1);
    expect(result.rotated).toBe(false);
    expect(beginSpy).toHaveBeenCalledWith('SERIALIZABLE');
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(calls[2].inputs.lockResource).toBe('pack-assignment:APR26');
    expect(calls[4].inputs.totalPacks).toBe(5);
    expect(calls[4].query).toContain('COUNT(*) AS active_count');
    expect(context.log).toHaveBeenCalledWith(
      'pack_assignment_resolved',
      expect.objectContaining({
        playerId: 1,
        campaignId: 'APR26',
        packId: 4,
        assignmentId: 10,
      }),
    );
  });

  it('reuses active assignment when incomplete', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      {
        recordset: [assignmentRow({ id: 20, pack_id: 50, cycle_number: 2 })],
      },
      { recordset: [{ board_state: JSON.stringify({ challengeProfile: { weeksCompleted: 3 } }) }] },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true });

    expect(result.assignment.packId).toBe(50);
    expect(result.assignment.cycleNumber).toBe(2);
    expect(result.rotated).toBe(false);
    expect(calls.map((call) => call.query).join('\n')).not.toContain('sp_getapplock');
    expect(calls.map((call) => call.query).join('\n')).not.toContain('COUNT(*) AS active_count');
  });

  it('rotates assignment when completed', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.0991);

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      {
        recordset: [assignmentRow({ id: 30, pack_id: 70, cycle_number: 2 })],
      },
      { recordset: [{ board_state: JSON.stringify({ challengeProfile: { weeksCompleted: 7 } }) }] },
      { rowsAffected: [1], recordset: [] },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [{ next_cycle: 3 }] },
      {
        recordset: [
          assignmentRow({
            id: 31,
            pack_id: 100,
            cycle_number: 3,
            assigned_at: '2026-04-26T00:10:00Z',
          }),
        ],
      },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true });

    expect(result.rotated).toBe(true);
    expect(result.completedPackId).toBe(70);
    expect(result.assignment.packId).toBe(100);
    expect(result.assignment.cycleNumber).toBe(3);
  });

  it('allows duplicate assignment after every campaign pack is active', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.4);

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 3, total_weeks: 7 }] },
      { recordset: [] },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      {
        recordset: [
          { pack_id: 1, active_count: 1 },
          { pack_id: 2, active_count: 1 },
          { pack_id: 3, active_count: 1 },
        ],
      },
      { recordset: [{ next_cycle: 1 }] },
      { recordset: [assignmentRow({ pack_id: 2 })] },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true });

    expect(result.assignment.packId).toBe(2);
    expect(result.assignment.cycleNumber).toBe(1);
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('uses least-used active packs for duplicate overflow', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99);

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 3, total_weeks: 7 }] },
      { recordset: [] },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      {
        recordset: [
          { pack_id: 1, active_count: 2 },
          { pack_id: 2, active_count: 1 },
          { pack_id: 3, active_count: 3 },
        ],
      },
      { recordset: [{ next_cycle: 1 }] },
      { recordset: [assignmentRow({ pack_id: 2 })] },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true });

    expect(result.assignment.packId).toBe(2);
    expect(result.assignment.cycleNumber).toBe(1);
  });

  it('rolls back when the campaign assignment lock cannot be acquired', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      { recordset: [] },
      { recordset: [{ lock_result: -1 }] },
    ]);

    await expect(resolvePackAssignment({ pool, playerId: 1, allowRotation: true })).rejects.toThrow(
      'Could not acquire pack assignment lock for campaign APR26',
    );

    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('rerolls by abandoning the active assignment and creating a replacement pack', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5);
    const context = { log: vi.fn() };

    const { pool, calls } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 3, total_weeks: 7 }] },
      { recordset: [assignmentRow({ id: 40, pack_id: 2 })] },
      {
        recordset: [
          assignmentRow({
            id: 40,
            pack_id: 2,
            status: 'abandoned',
            abandoned_at: '2026-05-03T00:00:00Z',
          }),
        ],
      },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [{ next_cycle: 2 }] },
      { recordset: [assignmentRow({ id: 41, pack_id: 3, cycle_number: 2 })] },
    ]);

    const result = await rerollPackAssignment({
      pool,
      playerId: 1,
      expectedAssignmentId: 40,
      context,
    });

    expect(result.rerolled).toBe(true);
    expect(result.abandonedAssignment.status).toBe('abandoned');
    expect(result.abandonedAssignment.packId).toBe(2);
    expect(result.assignment.packId).toBe(3);
    expect(result.assignment.cycleNumber).toBe(2);
    expect(calls[2].query).toContain("status = 'abandoned'");
    expect(calls[7].inputs.packId).toBe(3);
    expect(context.log).toHaveBeenCalledWith(
      'pack_assignment_rerolled',
      expect.objectContaining({
        playerId: 1,
        previousPackId: 2,
        packId: 3,
        rerolled: true,
      }),
    );
  });

  it('does not permanently blacklist an abandoned pack when it is the only unused option', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5);

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 3, total_weeks: 7 }] },
      { recordset: [assignmentRow({ id: 50, pack_id: 2 })] },
      {
        recordset: [
          assignmentRow({
            id: 50,
            pack_id: 2,
            status: 'abandoned',
            abandoned_at: '2026-05-03T00:00:00Z',
          }),
        ],
      },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      {
        recordset: [
          { pack_id: 1, active_count: 1 },
          { pack_id: 3, active_count: 1 },
        ],
      },
      { recordset: [{ next_cycle: 2 }] },
      { recordset: [assignmentRow({ id: 51, pack_id: 2, cycle_number: 2 })] },
    ]);

    const result = await rerollPackAssignment({ pool, playerId: 1, expectedAssignmentId: 50 });

    expect(result.assignment.packId).toBe(2);
    expect(result.abandonedAssignment.packId).toBe(2);
  });

  it('can reuse the same pack on reroll when the campaign has no alternative', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.75);

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 1, total_weeks: 7 }] },
      { recordset: [assignmentRow({ id: 60, pack_id: 1 })] },
      {
        recordset: [
          assignmentRow({
            id: 60,
            pack_id: 1,
            status: 'abandoned',
            abandoned_at: '2026-05-03T00:00:00Z',
          }),
        ],
      },
      { recordset: [{ lock_result: 0 }] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [{ next_cycle: 2 }] },
      { recordset: [assignmentRow({ id: 61, pack_id: 1, cycle_number: 2 })] },
    ]);

    const result = await rerollPackAssignment({ pool, playerId: 1, expectedAssignmentId: 60 });

    expect(result.assignment.packId).toBe(1);
    expect(result.rerolled).toBe(true);
  });

  it('returns the current active assignment without rerolling when expected assignment is stale', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      { recordset: [assignmentRow({ id: 71, pack_id: 88, cycle_number: 2 })] },
    ]);

    const result = await rerollPackAssignment({ pool, playerId: 1, expectedAssignmentId: 70 });

    expect(result.rerolled).toBe(false);
    expect(result.assignment.assignmentId).toBe(71);
    expect(result.assignment.packId).toBe(88);
    expect(result.abandonedAssignment).toBeNull();
    expect(calls).toHaveLength(2);
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });
});
