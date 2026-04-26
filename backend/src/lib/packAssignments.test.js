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

const {
  resolvePackAssignment,
  isPackAssignmentLifecycleEnabled,
} = await import('./packAssignments.js');

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

  it('creates first active assignment when none exists', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.009);
    const context = { log: vi.fn() };

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [{ next_cycle: 1 }] },
      {
        recordset: [
          {
            id: 10,
            player_id: 1,
            campaign_id: 'APR26',
            pack_id: 10,
            cycle_number: 1,
            status: 'active',
            assigned_at: '2026-04-26T00:00:00Z',
            completed_at: null,
          },
        ],
      },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true, context });

    expect(result.assignment.packId).toBe(10);
    expect(result.assignment.cycleNumber).toBe(1);
    expect(result.rotated).toBe(false);
    expect(beginSpy).toHaveBeenCalledWith('SERIALIZABLE');
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(context.log).toHaveBeenCalledWith(
      'pack_assignment_resolved',
      expect.objectContaining({
        playerId: 1,
        campaignId: 'APR26',
        packId: 10,
        assignmentId: 10,
      }),
    );
  });

  it('reuses active assignment when incomplete', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      {
        recordset: [
          {
            id: 20,
            player_id: 1,
            campaign_id: 'APR26',
            pack_id: 50,
            cycle_number: 2,
            status: 'active',
            assigned_at: '2026-04-26T00:00:00Z',
            completed_at: null,
          },
        ],
      },
      { recordset: [{ board_state: JSON.stringify({ challengeProfile: { weeksCompleted: 3 } }) }] },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true });

    expect(result.assignment.packId).toBe(50);
    expect(result.assignment.cycleNumber).toBe(2);
    expect(result.rotated).toBe(false);
  });

  it('rotates assignment when completed', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.099);

    const { pool } = createMockPool([
      { recordset: [{ id: 'APR26', total_packs: 999, total_weeks: 7 }] },
      {
        recordset: [
          {
            id: 30,
            player_id: 1,
            campaign_id: 'APR26',
            pack_id: 70,
            cycle_number: 2,
            status: 'active',
            assigned_at: '2026-04-26T00:00:00Z',
            completed_at: null,
          },
        ],
      },
      { recordset: [{ board_state: JSON.stringify({ challengeProfile: { weeksCompleted: 7 } }) }] },
      { rowsAffected: [1], recordset: [] },
      { recordset: [{ pack_id: 70 }] },
      { recordset: [{ next_cycle: 3 }] },
      {
        recordset: [
          {
            id: 31,
            player_id: 1,
            campaign_id: 'APR26',
            pack_id: 100,
            cycle_number: 3,
            status: 'active',
            assigned_at: '2026-04-26T00:10:00Z',
            completed_at: null,
          },
        ],
      },
    ]);

    const result = await resolvePackAssignment({ pool, playerId: 1, allowRotation: true });

    expect(result.rotated).toBe(true);
    expect(result.completedPackId).toBe(70);
    expect(result.assignment.packId).toBe(100);
    expect(result.assignment.cycleNumber).toBe(3);
  });
});
