-- =============================================
-- 002-seed-organizations.sql
-- Seed organizations and domain mappings from orgMap.js
-- =============================================

INSERT INTO organizations (name) VALUES
    ('SMU'),
    ('NTU'),
    ('NIE'),
    ('NUS'),
    ('SIM'),
    ('SIT'),
    ('SUTD'),
    ('SUSS'),
    ('SP'),
    ('RP'),
    ('ITE'),
    ('NP'),
    ('NYP'),
    ('TP'),
    ('MOE');

INSERT INTO org_domains (org_id, domain)
SELECT o.id, d.domain
FROM (VALUES
    ('SMU',  'smu.edu.sg'),
    ('NTU',  'ntu.edu.sg'),
    ('NIE',  'nie.edu.sg'),
    ('NUS',  'nus.edu.sg'),
    ('SIM',  'sim.edu.sg'),
    ('SIT',  'singaporetech.edu.sg'),
    ('SUTD', 'sutd.edu.sg'),
    ('SUSS', 'suss.edu.sg'),
    ('SP',   'sp.edu.sg'),
    ('RP',   'rp.edu.sg'),
    ('ITE',  'ite.edu.sg'),
    ('NP',   'np.edu.sg'),
    ('NYP',  'nyp.edu.sg'),
    ('TP',   'tp.edu.sg'),
    ('MOE',  'schools.gov.sg'),
    ('MOE',  'students.edu.sg')
) AS d(org_name, domain)
JOIN organizations o ON o.name = d.org_name;
