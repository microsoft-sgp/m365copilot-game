-- =============================================
-- 004-add-progression-scores.sql
-- Progression-based scoring source for leaderboard/activity
-- =============================================

CREATE TABLE progression_scores (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    game_session_id INT           NOT NULL REFERENCES game_sessions(id),
    player_id       INT           NOT NULL REFERENCES players(id),
    org_id          INT           NULL REFERENCES organizations(id),
    campaign_id     NVARCHAR(20)  NOT NULL,
    event_type      NVARCHAR(20)  NOT NULL,
    event_key       NVARCHAR(64)  NOT NULL,
    keyword         NVARCHAR(100) NULL,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_progression_score UNIQUE (campaign_id, player_id, event_type, event_key)
);

CREATE INDEX IX_progression_scores_campaign_org
    ON progression_scores(campaign_id, org_id, created_at);

CREATE INDEX IX_progression_scores_player
    ON progression_scores(player_id, created_at);
