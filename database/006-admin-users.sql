-- =============================================
-- 006-admin-users.sql
-- Portal-managed admin email allow-list.
-- =============================================

IF OBJECT_ID('admin_users', 'U') IS NULL
BEGIN
    CREATE TABLE admin_users (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        email       NVARCHAR(320) NOT NULL,
        is_active   BIT           NOT NULL DEFAULT 1,
        created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        created_by  NVARCHAR(320) NOT NULL,
        disabled_at DATETIME2     NULL,
        disabled_by NVARCHAR(320) NULL
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_admin_users_email'
      AND object_id = OBJECT_ID('admin_users')
)
BEGIN
    CREATE UNIQUE INDEX UX_admin_users_email
        ON admin_users(email);
END;