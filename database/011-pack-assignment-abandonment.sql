-- =============================================
-- 011-pack-assignment-abandonment.sql
-- User-initiated pack assignment rerolls
-- =============================================

IF COL_LENGTH('pack_assignments', 'abandoned_at') IS NULL
BEGIN
    ALTER TABLE pack_assignments
        ADD abandoned_at DATETIME2 NULL;
END;

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_pack_assignments_status'
      AND parent_object_id = OBJECT_ID('pack_assignments')
)
BEGIN
    ALTER TABLE pack_assignments DROP CONSTRAINT CK_pack_assignments_status;
END;

ALTER TABLE pack_assignments
    ADD CONSTRAINT CK_pack_assignments_status
        CHECK (status IN ('active', 'completed', 'abandoned'));

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_pack_assignments_abandoned_at'
      AND parent_object_id = OBJECT_ID('pack_assignments')
)
BEGIN
    ALTER TABLE pack_assignments
        ADD CONSTRAINT CK_pack_assignments_abandoned_at
            CHECK (status <> 'abandoned' OR abandoned_at IS NOT NULL);
END;
