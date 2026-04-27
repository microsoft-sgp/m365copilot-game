-- =============================================
-- 008-player-organization-attribution.sql
-- Store resolved organization context on players
-- =============================================

IF COL_LENGTH('players', 'org_id') IS NULL
BEGIN
    ALTER TABLE players
        ADD org_id INT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_players_organization'
)
BEGIN
    EXEC(N'
    ALTER TABLE players
        ADD CONSTRAINT FK_players_organization
            FOREIGN KEY (org_id) REFERENCES organizations(id);
    ');
END;

EXEC(N'
UPDATE p
SET p.org_id = od.org_id
FROM players p
JOIN org_domains od
    ON od.domain = LOWER(
        CASE
            WHEN CHARINDEX(''@'', p.email) > 0
            THEN SUBSTRING(p.email, CHARINDEX(''@'', p.email) + 1, LEN(p.email))
            ELSE ''''
        END
    )
WHERE p.org_id IS NULL
  AND p.email IS NOT NULL;
');