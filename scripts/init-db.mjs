import sql from 'mssql';
import { readFileSync } from 'fs';

const SA_PASSWORD = process.env.SA_PASSWORD || 'BingoTest123!';
const DB_HOST = process.env.DB_HOST || 'db';
const DB_NAME = process.env.DB_NAME || 'bingo_db';

if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error('DB_NAME may only contain letters, numbers, and underscores');
}

function quoteIdentifier(identifier) {
  return `[${identifier.replace(/]/g, ']]')}]`;
}

const config = {
  user: 'sa',
  password: SA_PASSWORD,
  server: DB_HOST,
  port: 1433,
  options: { encrypt: false, trustServerCertificate: true },
};

async function waitForDb(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const pool = await sql.connect(config);
      await pool.request().query('SELECT 1');
      await pool.close();
      console.log('SQL Server is ready.');
      return;
    } catch {
      console.log(`Waiting for SQL Server... (attempt ${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('SQL Server did not become ready in time');
}

async function run() {
  await waitForDb();

  // Connect to master to create database
  const masterPool = await sql.connect(config);
  const dbCheck = await masterPool
    .request()
    .input('dbName', sql.NVarChar(128), DB_NAME)
    .query('SELECT name FROM sys.databases WHERE name = @dbName');
  if (dbCheck.recordset.length === 0) {
    console.log(`Creating database ${DB_NAME}...`);
    await masterPool.request().batch(`CREATE DATABASE ${quoteIdentifier(DB_NAME)}`);
    // Wait a moment for DB to be ready
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    console.log(`Database ${DB_NAME} already exists.`);
  }
  await masterPool.close();

  // Connect to application database
  const dbConfig = { ...config, database: DB_NAME };
  const pool = await sql.connect(dbConfig);

  async function runBatch(filename) {
    console.log(`Running migration ${filename}...`);
    const sqlText = readFileSync(`./database/${filename}`, 'utf8');
    await pool.request().batch(sqlText);
  }

  async function runStatementsLenient(filename) {
    console.log(`Running migration ${filename}...`);
    const sqlText = readFileSync(`./database/${filename}`, 'utf8');
    const statements = sqlText.split(/;\s*$/m).filter((statement) => statement.trim());
    for (const statement of statements) {
      try {
        await pool.request().batch(statement);
      } catch (err) {
        // Some statements may fail if already applied; keep advancing older dev DBs.
        console.log(`  Warning: ${err.message.slice(0, 100)}`);
      }
    }
  }

  // Check if tables exist already
  const tableCheck = await pool
    .request()
    .query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'organizations'");

  if (tableCheck.recordset.length === 0) {
    await runBatch('001-create-tables.sql');
    await runBatch('002-seed-organizations.sql');
  } else {
    console.log('Base tables already exist, applying latest schema migrations.');
  }

  await runStatementsLenient('003-add-admin-and-campaigns.sql');
  await runBatch('004-add-progression-scores.sql');
  await runBatch('005-pack-assignment-lifecycle.sql');
  await runBatch('006-admin-users.sql');
  await runBatch('007-active-pack-assignment-counts.sql');
  await runBatch('008-player-organization-attribution.sql');
  await runBatch('009-player-owner-token.sql');
  await runBatch('010-player-recovery.sql');

  await pool.close();
  console.log('Database initialization complete!');
  process.exit(0);
}

run().catch((err) => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});
