-- =============================================
-- 007-active-pack-assignment-counts.sql
-- Supports campaign active pack distribution queries
-- =============================================

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_pack_assignments_campaign_status_pack'
      AND object_id = OBJECT_ID('pack_assignments')
)
BEGIN
    CREATE INDEX IX_pack_assignments_campaign_status_pack
        ON pack_assignments (campaign_id, status, pack_id);
END;
