-- =============================================
-- 010-player-recovery.sql
-- Player recovery and multi-device token support.
--
-- Idempotent: safe to re-run. Tables are additive so rollback can ignore
-- unused rows while existing players.owner_token credentials remain valid.
-- =============================================

IF OBJECT_ID('player_device_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE player_device_tokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        player_id INT NOT NULL,
        token_hash NVARCHAR(64) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_player_device_tokens_created_at DEFAULT SYSUTCDATETIME(),
        last_seen_at DATETIME2 NULL,
        revoked_at DATETIME2 NULL,
        CONSTRAINT FK_player_device_tokens_player
            FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_player_device_tokens_player_active_hash'
      AND object_id = OBJECT_ID('player_device_tokens')
)
BEGIN
    EXEC(N'
    CREATE INDEX IX_player_device_tokens_player_active_hash
        ON player_device_tokens(player_id, token_hash)
        WHERE revoked_at IS NULL;
    ');
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_player_device_tokens_active_token_hash'
      AND object_id = OBJECT_ID('player_device_tokens')
)
BEGIN
    EXEC(N'
    CREATE UNIQUE INDEX UX_player_device_tokens_active_token_hash
        ON player_device_tokens(token_hash)
        WHERE revoked_at IS NULL;
    ');
END;

IF OBJECT_ID('player_recovery_otps', 'U') IS NULL
BEGIN
    CREATE TABLE player_recovery_otps (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(320) NOT NULL,
        code_hash NVARCHAR(128) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        used BIT NOT NULL CONSTRAINT DF_player_recovery_otps_used DEFAULT 0,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_player_recovery_otps_created_at DEFAULT SYSUTCDATETIME(),
        used_at DATETIME2 NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_player_recovery_otps_email_created'
      AND object_id = OBJECT_ID('player_recovery_otps')
)
BEGIN
    CREATE INDEX IX_player_recovery_otps_email_created
        ON player_recovery_otps(email, created_at DESC);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_player_recovery_otps_unused_lookup'
      AND object_id = OBJECT_ID('player_recovery_otps')
)
BEGIN
    EXEC(N'
    CREATE INDEX IX_player_recovery_otps_unused_lookup
        ON player_recovery_otps(email, code_hash, expires_at)
        WHERE used = 0;
    ');
END;