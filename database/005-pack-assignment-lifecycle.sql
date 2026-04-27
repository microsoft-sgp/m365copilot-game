-- =============================================
-- 005-pack-assignment-lifecycle.sql
-- Server-authoritative pack assignment lifecycle
-- =============================================

-- Assignment lifecycle per player + campaign.
IF OBJECT_ID('pack_assignments', 'U') IS NULL
BEGIN
    CREATE TABLE pack_assignments (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        player_id     INT          NOT NULL REFERENCES players(id),
        campaign_id   NVARCHAR(20) NOT NULL REFERENCES campaigns(id),
        pack_id       INT          NOT NULL,
        cycle_number  INT          NOT NULL,
        status        NVARCHAR(20) NOT NULL DEFAULT 'active',
        assigned_at   DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
        completed_at  DATETIME2    NULL,

        CONSTRAINT CK_pack_assignments_status
            CHECK (status IN ('active', 'completed')),
        CONSTRAINT UQ_pack_assignments_cycle
            UNIQUE (player_id, campaign_id, cycle_number)
    );
END;

-- Exactly one active assignment per player + campaign.
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_pack_assignments_active'
      AND object_id = OBJECT_ID('pack_assignments')
)
BEGIN
    CREATE UNIQUE INDEX UX_pack_assignments_active
        ON pack_assignments (player_id, campaign_id)
        WHERE status = 'active';
END;

-- Track which assignment a game session belongs to.
IF COL_LENGTH('game_sessions', 'assignment_id') IS NULL
BEGIN
    ALTER TABLE game_sessions
        ADD assignment_id INT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_game_sessions_assignment'
)
BEGIN
    EXEC(N'
    ALTER TABLE game_sessions
        ADD CONSTRAINT FK_game_sessions_assignment
            FOREIGN KEY (assignment_id) REFERENCES pack_assignments(id);
    ');
END;

-- One game session per assignment lifecycle.
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_game_sessions_assignment'
      AND object_id = OBJECT_ID('game_sessions')
)
BEGIN
    EXEC(N'
    CREATE UNIQUE INDEX UX_game_sessions_assignment
        ON game_sessions (assignment_id)
        WHERE assignment_id IS NOT NULL;
    ');
END;

-- Legacy uniqueness blocks future pack reuse across cycles; remove it.
IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = 'UQ_player_pack_campaign'
      AND parent_object_id = OBJECT_ID('game_sessions')
)
BEGIN
    ALTER TABLE game_sessions DROP CONSTRAINT UQ_player_pack_campaign;
END;

-- Backfill one active assignment per player + campaign from latest session.
;WITH latest AS (
    SELECT
        gs.player_id,
        gs.campaign_id,
        gs.pack_id,
        gs.id AS game_session_id,
        ROW_NUMBER() OVER (
            PARTITION BY gs.player_id, gs.campaign_id
            ORDER BY gs.last_active_at DESC, gs.id DESC
        ) AS rn
    FROM game_sessions gs
)
INSERT INTO pack_assignments (player_id, campaign_id, pack_id, cycle_number, status)
SELECT
    l.player_id,
    l.campaign_id,
    l.pack_id,
    1,
    'active'
FROM latest l
WHERE l.rn = 1
  AND NOT EXISTS (
      SELECT 1
      FROM pack_assignments pa
      WHERE pa.player_id = l.player_id
        AND pa.campaign_id = l.campaign_id
  );

-- Backfill game_sessions.assignment_id from active assignment.
EXEC(N'
UPDATE gs
SET gs.assignment_id = pa.id
FROM game_sessions gs
JOIN pack_assignments pa
    ON pa.player_id = gs.player_id
 AND pa.campaign_id = gs.campaign_id
 AND pa.pack_id = gs.pack_id
 AND pa.status = ''active''
WHERE gs.assignment_id IS NULL;
');
