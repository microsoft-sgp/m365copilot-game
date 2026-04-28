import sql from 'mssql';
import type { ConnectionPool, Transaction } from 'mssql';

type QueryResult<T> = {
  recordset: T[];
};

type QueryRequest = {
  input(name: string, type: unknown, value: unknown): QueryRequest;
  query<T = Record<string, unknown>>(query: string): Promise<QueryResult<T>>;
};

type QueryableTransaction = Transaction & {
  request(): QueryRequest;
};

type Campaign = {
  id: string;
  totalPacks: number;
  totalWeeks: number;
};

type ActivePackCountRow = {
  pack_id: number;
  active_count: number;
};

type AssignmentRow = {
  id: number;
  campaign_id: string;
  pack_id: number;
  cycle_number: number;
  status: string;
  assigned_at: Date | string;
  completed_at: Date | string | null;
};

type Assignment = {
  assignmentId: number;
  packId: number;
  cycleNumber: number;
  status: string;
  campaignId: string;
  assignedAt: Date | string;
  completedAt: Date | string | null;
};

type LoggerLike = {
  log?: (message: string, details?: Record<string, unknown>) => void;
};

type ResolvePackAssignmentArgs = {
  pool: ConnectionPool;
  playerId: number;
  context?: LoggerLike;
  allowRotation?: boolean;
};

const DEFAULT_CAMPAIGN = {
  id: 'APR26',
  totalPacks: 999,
  totalWeeks: 7,
};

export function isPackAssignmentLifecycleEnabled(): boolean {
  return process.env.ENABLE_PACK_ASSIGNMENT_LIFECYCLE !== 'false';
}

export async function getActiveCampaign(pool: { request(): QueryRequest }): Promise<Campaign> {
  const result = await pool.request().query<{
    id: string;
    total_packs: number;
    total_weeks: number;
  }>(`
      SELECT TOP 1 id, total_packs, total_weeks
      FROM campaigns
      WHERE is_active = 1
      ORDER BY created_at DESC;
    `);

  if (result.recordset.length === 0) {
    return DEFAULT_CAMPAIGN;
  }

  const c = result.recordset[0];
  return {
    id: c.id,
    totalPacks: c.total_packs,
    totalWeeks: c.total_weeks,
  };
}

function getPackCapacity(totalPacks: number): number {
  const n = Number(totalPacks);
  return Math.max(1, Number.isFinite(n) ? Math.floor(n) : DEFAULT_CAMPAIGN.totalPacks);
}

function chooseRandomPack(candidates: number[]): number {
  if (candidates.length === 0) return 1;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function choosePack(totalPacks: number, activePackRows: ActivePackCountRow[] = []): number {
  const max = getPackCapacity(totalPacks);
  const countsByPack = new Map<number, number>();

  for (const row of activePackRows) {
    const packId = Number(row.pack_id);
    const count = Number(row.active_count);
    if (
      Number.isInteger(packId) &&
      packId >= 1 &&
      packId <= max &&
      Number.isFinite(count) &&
      count > 0
    ) {
      countsByPack.set(packId, (countsByPack.get(packId) || 0) + Math.floor(count));
    }
  }

  const unusedPacks: number[] = [];
  for (let packId = 1; packId <= max; packId += 1) {
    if (!countsByPack.has(packId)) unusedPacks.push(packId);
  }

  if (unusedPacks.length > 0) {
    return chooseRandomPack(unusedPacks);
  }

  let minCount = Infinity;
  let leastUsedPacks: number[] = [];
  for (let packId = 1; packId <= max; packId += 1) {
    const count = countsByPack.get(packId) || 0;
    if (count < minCount) {
      minCount = count;
      leastUsedPacks = [packId];
    } else if (count === minCount) {
      leastUsedPacks.push(packId);
    }
  }

  return chooseRandomPack(leastUsedPacks);
}

async function getActiveAssignment(
  tx: QueryableTransaction,
  playerId: number,
  campaignId: string,
): Promise<AssignmentRow | null> {
  const result = await tx
    .request()
    .input('playerId', sql.Int, playerId)
    .input('campaignId', sql.NVarChar(20), campaignId).query<AssignmentRow>(`
      SELECT TOP 1 *
      FROM pack_assignments WITH (UPDLOCK, HOLDLOCK)
      WHERE player_id = @playerId
        AND campaign_id = @campaignId
        AND status = 'active'
      ORDER BY assigned_at DESC, id DESC;
    `);

  return result.recordset[0] || null;
}

async function acquireCampaignAssignmentLock(
  tx: QueryableTransaction,
  campaignId: string,
): Promise<void> {
  const result = await tx
    .request()
    .input('lockResource', sql.NVarChar(255), `pack-assignment:${campaignId}`).query<{
    lock_result: number;
  }>(`
      DECLARE @lockResult INT;

      EXEC @lockResult = sp_getapplock
        @Resource = @lockResource,
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 10000;

      SELECT @lockResult AS lock_result;
    `);

  const lockResult = Number(result.recordset[0]?.lock_result);
  if (!Number.isFinite(lockResult) || lockResult < 0) {
    throw new Error(`Could not acquire pack assignment lock for campaign ${campaignId}`);
  }
}

async function getActivePackCounts(
  tx: QueryableTransaction,
  campaignId: string,
  totalPacks: number,
): Promise<ActivePackCountRow[]> {
  const result = await tx
    .request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .input('totalPacks', sql.Int, totalPacks).query<ActivePackCountRow>(`
      SELECT pack_id, COUNT(*) AS active_count
      FROM pack_assignments WITH (UPDLOCK, HOLDLOCK)
      WHERE campaign_id = @campaignId
        AND status = 'active'
        AND pack_id BETWEEN 1 AND @totalPacks
      GROUP BY pack_id;
    `);

  return result.recordset;
}

function getWeeksCompleted(
  boardStateJson: string | Record<string, unknown> | null | undefined,
): number {
  if (!boardStateJson) return 0;
  try {
    const parsed = typeof boardStateJson === 'string' ? JSON.parse(boardStateJson) : boardStateJson;
    const weeks = Number(parsed?.challengeProfile?.weeksCompleted);
    return Number.isFinite(weeks) ? Math.max(0, Math.floor(weeks)) : 0;
  } catch {
    return 0;
  }
}

function normalizeAssignment(row: AssignmentRow | null): Assignment | null {
  if (!row) return null;
  return {
    assignmentId: row.id,
    packId: row.pack_id,
    cycleNumber: row.cycle_number,
    status: row.status,
    campaignId: row.campaign_id,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
  };
}

export async function resolvePackAssignment({
  pool,
  playerId,
  context,
  allowRotation = true,
}: ResolvePackAssignmentArgs): Promise<{
  campaign: Campaign;
  assignment: Assignment | null;
  rotated: boolean;
  completedPackId: number | null;
}> {
  const campaign = await getActiveCampaign(pool);
  const totalPacks = getPackCapacity(campaign.totalPacks);

  const tx = new sql.Transaction(pool) as QueryableTransaction;
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    let assignmentRow = await getActiveAssignment(tx, playerId, campaign.id);
    let rotated = false;
    let completedPackId: number | null = null;

    if (assignmentRow && allowRotation) {
      const latestSession = await tx
        .request()
        .input('playerId', sql.Int, playerId)
        .input('campaignId', sql.NVarChar(20), campaign.id)
        .input('packId', sql.Int, assignmentRow.pack_id).query<{ board_state: string | null }>(`
          SELECT TOP 1 board_state
          FROM game_sessions
          WHERE player_id = @playerId
            AND campaign_id = @campaignId
            AND pack_id = @packId
          ORDER BY last_active_at DESC, id DESC;
        `);

      const weeksCompleted = getWeeksCompleted(latestSession.recordset[0]?.board_state);
      if (weeksCompleted >= campaign.totalWeeks) {
        await tx.request().input('assignmentId', sql.Int, assignmentRow.id).query(`
            UPDATE pack_assignments
            SET status = 'completed',
                completed_at = SYSUTCDATETIME()
            WHERE id = @assignmentId;
          `);

        completedPackId = assignmentRow.pack_id;
        assignmentRow = null;
        rotated = true;
      }
    }

    if (!assignmentRow) {
      await acquireCampaignAssignmentLock(tx, campaign.id);
      assignmentRow = await getActiveAssignment(tx, playerId, campaign.id);
    }

    if (!assignmentRow) {
      const activePackCounts = await getActivePackCounts(tx, campaign.id, totalPacks);
      const nextPackId = choosePack(totalPacks, activePackCounts);

      const cycleResult = await tx
        .request()
        .input('playerId', sql.Int, playerId)
        .input('campaignId', sql.NVarChar(20), campaign.id).query<{ next_cycle: number }>(`
          SELECT ISNULL(MAX(cycle_number), 0) + 1 AS next_cycle
          FROM pack_assignments WITH (UPDLOCK, HOLDLOCK)
          WHERE player_id = @playerId
            AND campaign_id = @campaignId;
        `);

      const nextCycle = cycleResult.recordset[0].next_cycle;

      const insertResult = await tx
        .request()
        .input('playerId', sql.Int, playerId)
        .input('campaignId', sql.NVarChar(20), campaign.id)
        .input('packId', sql.Int, nextPackId)
        .input('cycleNumber', sql.Int, nextCycle).query<AssignmentRow>(`
          INSERT INTO pack_assignments (player_id, campaign_id, pack_id, cycle_number, status)
          OUTPUT inserted.*
          VALUES (@playerId, @campaignId, @packId, @cycleNumber, 'active');
        `);

      assignmentRow = insertResult.recordset[0];
    }

    await tx.commit();

    const assignment = normalizeAssignment(assignmentRow);

    if (context && typeof context.log === 'function') {
      context.log('pack_assignment_resolved', {
        playerId,
        campaignId: campaign.id,
        packId: assignment?.packId,
        assignmentId: assignment?.assignmentId,
        cycleNumber: assignment?.cycleNumber,
        rotated,
        completedPackId,
      });
    }

    return {
      campaign,
      assignment,
      rotated,
      completedPackId,
    };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // no-op
    }
    throw err;
  }
}
