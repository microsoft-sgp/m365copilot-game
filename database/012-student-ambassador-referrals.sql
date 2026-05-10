-- =============================================
-- 012-student-ambassador-referrals.sql
-- Student Ambassador referral catalog and
-- player attribution for campaign onboarding.
--
-- Idempotent: safe to re-run. Structures are
-- additive and do not affect scoring records.
-- =============================================

IF OBJECT_ID('student_ambassadors', 'U') IS NULL
BEGIN
    CREATE TABLE student_ambassadors (
        id INT IDENTITY(1,1) PRIMARY KEY,
        campaign_id NVARCHAR(20) NOT NULL,
        display_name NVARCHAR(200) NOT NULL,
        referral_code NVARCHAR(64) NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_student_ambassadors_active DEFAULT 1,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_student_ambassadors_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT FK_student_ambassadors_campaign
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_student_ambassadors_campaign_referral_code'
      AND object_id = OBJECT_ID('student_ambassadors')
)
BEGIN
    CREATE UNIQUE INDEX UX_student_ambassadors_campaign_referral_code
        ON student_ambassadors(campaign_id, referral_code);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_student_ambassadors_active_code'
      AND object_id = OBJECT_ID('student_ambassadors')
)
BEGIN
    EXEC(N'
    CREATE INDEX IX_student_ambassadors_active_code
        ON student_ambassadors(campaign_id, referral_code)
        INCLUDE (id, display_name)
        WHERE active = 1;
    ');
END;

IF OBJECT_ID('player_referrals', 'U') IS NULL
BEGIN
    CREATE TABLE player_referrals (
        id INT IDENTITY(1,1) PRIMARY KEY,
        player_id INT NOT NULL,
        ambassador_id INT NOT NULL,
        campaign_id NVARCHAR(20) NOT NULL,
        referral_code NVARCHAR(64) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_player_referrals_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_player_referrals_player
            FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        CONSTRAINT FK_player_referrals_ambassador
            FOREIGN KEY (ambassador_id) REFERENCES student_ambassadors(id),
        CONSTRAINT FK_player_referrals_campaign
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_player_referrals_player_campaign'
      AND object_id = OBJECT_ID('player_referrals')
)
BEGIN
    CREATE UNIQUE INDEX UX_player_referrals_player_campaign
        ON player_referrals(player_id, campaign_id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_player_referrals_ambassador_campaign'
      AND object_id = OBJECT_ID('player_referrals')
)
BEGIN
    CREATE INDEX IX_player_referrals_ambassador_campaign
        ON player_referrals(ambassador_id, campaign_id, created_at);
END;