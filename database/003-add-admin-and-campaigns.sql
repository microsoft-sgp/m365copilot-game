-- =============================================
-- 003-add-admin-and-campaigns.sql
-- Adds campaigns table, admin OTP table, and
-- board_state column for cross-device sync.
-- =============================================

-- Campaign configuration (replaces hardcoded constants)
CREATE TABLE campaigns (
    id            NVARCHAR(20)  PRIMARY KEY,
    display_name  NVARCHAR(100) NOT NULL,
    total_packs   INT           NOT NULL DEFAULT 999,
    total_weeks   INT           NOT NULL DEFAULT 7,
    copilot_url   NVARCHAR(500) NOT NULL DEFAULT 'https://m365.cloud.microsoft/chat',
    is_active     BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Seed the current campaign so existing FK values remain valid
INSERT INTO campaigns (id, display_name, total_packs, total_weeks, copilot_url, is_active)
VALUES ('APR26', 'April 2026', 999, 7, 'https://m365.cloud.microsoft/chat', 1);

-- Admin OTP codes for email + OTP authentication
CREATE TABLE admin_otps (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    email      NVARCHAR(320) NOT NULL,
    code_hash  NVARCHAR(128) NOT NULL,
    expires_at DATETIME2     NOT NULL,
    used       BIT           NOT NULL DEFAULT 0,
    created_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Index for OTP lookups by email
CREATE INDEX IX_admin_otps_email ON admin_otps(email, used, expires_at);

-- Add board_state column to game_sessions for cross-device sync
ALTER TABLE game_sessions
    ADD board_state NVARCHAR(MAX) NULL;

-- Add foreign key from game_sessions.campaign_id to campaigns.id
ALTER TABLE game_sessions
    ADD CONSTRAINT FK_game_sessions_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id);

-- Add foreign key from submissions.campaign_id to campaigns.id
ALTER TABLE submissions
    ADD CONSTRAINT FK_submissions_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id);

-- Add index on players.email for email-based lookups
CREATE INDEX IX_players_email ON players(email)
    WHERE email IS NOT NULL;
