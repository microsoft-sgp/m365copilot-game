import sql from 'mssql';

const DEFAULT_CAMPAIGN = {
  id: 'APR26',
  totalPacks: 999,
  totalWeeks: 7,
};

export function isPackAssignmentLifecycleEnabled() {
  return process.env.ENABLE_PACK_ASSIGNMENT_LIFECYCLE !== 'false';
}

export async function getActiveCampaign(pool) {
  const result = await pool
    .request()
    .query(`
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

function clampPack(packId, totalPacks) {
  const n = Number(packId);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), Math.max(1, totalPacks));
}

function choosePack(totalPacks, usedPackIds = []) {
  const max = Math.max(1, Number(totalPacks) || DEFAULT_CAMPAIGN.totalPacks);
  const used = new Set(usedPackIds.filter((n) => Number.isInteger(n) && n >= 1 && n <= max));
  if (used.size >= max) {
    return Math.floor(Math.random() * max) + 1;
  }

  let candidate;
  do {
    candidate = Math.floor(Math.random() * max) + 1;
  } while (used.has(candidate));

  return candidate;
}

function getWeeksCompleted(boardStateJson) {
  if (!boardStateJson) return 0;
  try {
    const parsed = typeof boardStateJson === 'string' ? JSON.parse(boardStateJson) : boardStateJson;
    const weeks = Number(parsed?.challengeProfile?.weeksCompleted);
    return Number.isFinite(weeks) ? Math.max(0, Math.floor(weeks)) : 0;
  } catch {
    return 0;
  }
}

function normalizeAssignment(row) {
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
}) {
  const campaign = await getActiveCampaign(pool);

  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const assignmentResult = await tx
      .request()
      .input('playerId', sql.Int, playerId)
      .input('campaignId', sql.NVarChar(20), campaign.id)
      .query(`
        SELECT TOP 1 *
        FROM pack_assignments WITH (UPDLOCK, HOLDLOCK)
        WHERE player_id = @playerId
          AND campaign_id = @campaignId
          AND status = 'active'
        ORDER BY assigned_at DESC, id DESC;
      `);

    let assignmentRow = assignmentResult.recordset[0] || null;
    let rotated = false;
    let completedPackId = null;

    if (assignmentRow && allowRotation) {
      const latestSession = await tx
        .request()
        .input('playerId', sql.Int, playerId)
        .input('campaignId', sql.NVarChar(20), campaign.id)
        .input('packId', sql.Int, assignmentRow.pack_id)
        .query(`
          SELECT TOP 1 board_state
          FROM game_sessions
          WHERE player_id = @playerId
            AND campaign_id = @campaignId
            AND pack_id = @packId
          ORDER BY last_active_at DESC, id DESC;
        `);

      const weeksCompleted = getWeeksCompleted(latestSession.recordset[0]?.board_state);
      if (weeksCompleted >= campaign.totalWeeks) {
        await tx
          .request()
          .input('assignmentId', sql.Int, assignmentRow.id)
          .query(`
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
      const usedPackRows = await tx
        .request()
        .input('playerId', sql.Int, playerId)
        .input('campaignId', sql.NVarChar(20), campaign.id)
        .query(`
          SELECT DISTINCT pack_id
          FROM game_sessions
          WHERE player_id = @playerId
            AND campaign_id = @campaignId;
        `);

      const usedPacks = usedPackRows.recordset.map((r) => r.pack_id);
      const nextPackId = clampPack(choosePack(campaign.totalPacks, usedPacks), campaign.totalPacks);

      const cycleResult = await tx
        .request()
        .input('playerId', sql.Int, playerId)
        .input('campaignId', sql.NVarChar(20), campaign.id)
        .query(`
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
        .input('cycleNumber', sql.Int, nextCycle)
        .query(`
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
