-- =============================================
-- 001-create-tables.sql
-- Copilot Chat Bingo — Azure SQL schema
-- =============================================

-- Organizations (leaderboard entities)
CREATE TABLE organizations (
    id   INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);

-- Email-domain → organization mapping (many-to-one)
CREATE TABLE org_domains (
    id     INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT           NOT NULL REFERENCES organizations(id),
    domain NVARCHAR(255) NOT NULL UNIQUE
);

-- Players (lightweight identity keyed by client sessionId)
CREATE TABLE players (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    session_id  NVARCHAR(50)  NOT NULL UNIQUE,
    player_name NVARCHAR(200) NOT NULL,
    email       NVARCHAR(320) NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Game sessions (one per board start)
CREATE TABLE game_sessions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    player_id       INT           NOT NULL REFERENCES players(id),
    pack_id         INT           NOT NULL,
    campaign_id     NVARCHAR(20)  NOT NULL DEFAULT 'APR26',
    tiles_cleared   INT           NOT NULL DEFAULT 0,
    lines_won       INT           NOT NULL DEFAULT 0,
    keywords_earned INT           NOT NULL DEFAULT 0,
    started_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    last_active_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_player_pack_campaign UNIQUE (player_id, pack_id, campaign_id)
);

-- Tile events (granular engagement tracking)
CREATE TABLE tile_events (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    game_session_id INT           NOT NULL REFERENCES game_sessions(id),
    tile_index      INT           NOT NULL,
    event_type      NVARCHAR(20)  NOT NULL,
    keyword         NVARCHAR(100) NULL,
    line_id         NVARCHAR(20)  NULL,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Keyword submissions (leaderboard source of truth)
CREATE TABLE submissions (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    player_id   INT           NOT NULL REFERENCES players(id),
    org_id      INT           NOT NULL REFERENCES organizations(id),
    keyword     NVARCHAR(100) NOT NULL,
    campaign_id NVARCHAR(20)  NOT NULL DEFAULT 'APR26',
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_player_keyword UNIQUE (player_id, keyword)
);

-- Index for leaderboard aggregation performance
CREATE INDEX IX_submissions_campaign_org
    ON submissions(campaign_id, org_id);
