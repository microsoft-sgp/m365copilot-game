import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

function quoteIdentifier(identifier) {
  return `[${identifier.replace(/]/g, ']]')}]`;
}

function sqlString(value) {
  return `N'${value.replace(/'/g, "''")}'`;
}

function getSqlConfig() {
  if (process.env.SQL_CONNECTION_STRING) return process.env.SQL_CONNECTION_STRING;

  const server = process.env.SQL_SERVER_FQDN || process.env.SQL_SERVER;
  if (!server) throw new Error('SQL_SERVER_FQDN or SQL_CONNECTION_STRING is required');

  return {
    server,
    database: process.env.SQL_DATABASE_NAME || process.env.SQL_DATABASE || 'bingo_db',
    authentication: {
      type: process.env.SQL_AUTHENTICATION || 'azure-active-directory-default',
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  };
}

function migrationPath(filename) {
  return fileURLToPath(new URL(`../../database/${filename}`, import.meta.url));
}

async function runBatch(pool, filename) {
  console.log(`Running migration ${filename}...`);
  const sqlText = readFileSync(migrationPath(filename), 'utf8');
  await pool.request().batch(sqlText);
}

async function runStatementsLenient(pool, filename) {
  console.log(`Running migration ${filename}...`);
  const sqlText = readFileSync(migrationPath(filename), 'utf8');
  const statements = sqlText.split(/;\s*$/m).filter((statement) => statement.trim());

  for (const statement of statements) {
    try {
      await pool.request().batch(statement);
    } catch (err) {
      console.log(`  Warning: ${err.message.slice(0, 120)}`);
    }
  }
}

async function grantAppIdentity(pool) {
  const identityName = process.env.SQL_APP_IDENTITY_NAME;
  if (!identityName) return;

  console.log(`Granting database access to ${identityName}...`);
  const quotedName = quoteIdentifier(identityName);
  const literalName = sqlString(identityName);
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ${literalName})
    BEGIN
      CREATE USER ${quotedName} FROM EXTERNAL PROVIDER;
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.database_role_members rm
      JOIN sys.database_principals role_principal ON role_principal.principal_id = rm.role_principal_id
      JOIN sys.database_principals member_principal ON member_principal.principal_id = rm.member_principal_id
      WHERE role_principal.name = N'db_datareader'
        AND member_principal.name = ${literalName}
    )
    BEGIN
      ALTER ROLE db_datareader ADD MEMBER ${quotedName};
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.database_role_members rm
      JOIN sys.database_principals role_principal ON role_principal.principal_id = rm.role_principal_id
      JOIN sys.database_principals member_principal ON member_principal.principal_id = rm.member_principal_id
      WHERE role_principal.name = N'db_datawriter'
        AND member_principal.name = ${literalName}
    )
    BEGIN
      ALTER ROLE db_datawriter ADD MEMBER ${quotedName};
    END;
  `);
}

async function run() {
  const pool = await sql.connect(getSqlConfig());

  const tableCheck = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'organizations';
  `);

  if (tableCheck.recordset.length === 0) {
    await runBatch(pool, '001-create-tables.sql');
    await runBatch(pool, '002-seed-organizations.sql');
  } else {
    console.log('Base tables already exist, applying latest schema migrations.');
  }

  await runStatementsLenient(pool, '003-add-admin-and-campaigns.sql');
  await runBatch(pool, '004-add-progression-scores.sql');
  await runBatch(pool, '005-pack-assignment-lifecycle.sql');
  await runBatch(pool, '006-admin-users.sql');
  await runBatch(pool, '007-active-pack-assignment-counts.sql');
  await runBatch(pool, '008-player-organization-attribution.sql');
  await runBatch(pool, '009-player-owner-token.sql');
  await runBatch(pool, '010-player-recovery.sql');
  await runBatch(pool, '011-pack-assignment-abandonment.sql');
  await grantAppIdentity(pool);

  await pool.close();
  console.log('Database migrations complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
