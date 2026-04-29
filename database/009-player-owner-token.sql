-- =============================================
-- 009-player-owner-token.sql
-- Player session token hash so the API can
-- verify that callers presenting a token are
-- the original owner of the player record.
--
-- Idempotent: safe to re-run against existing
-- databases. Legacy rows remain valid with a
-- null token; the API populates it on the next
-- authenticated POST /api/sessions for that
-- email.
-- =============================================

IF COL_LENGTH('players', 'owner_token') IS NULL
BEGIN
    ALTER TABLE players
        ADD owner_token NVARCHAR(64) NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_players_owner_token'
      AND object_id = OBJECT_ID('players')
)
BEGIN
    -- Filtered index keeps the structure tiny and only covers populated rows
    -- so legacy null tokens don't bloat the lookup.
    EXEC(N'
    CREATE INDEX IX_players_owner_token
        ON players(owner_token)
        WHERE owner_token IS NOT NULL;
    ');
END;
