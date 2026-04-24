import sql from 'mssql';
import { readFileSync } from 'fs';

const SA_PASSWORD = process.env.SA_PASSWORD || 'BingoTest123!';
const DB_HOST = process.env.DB_HOST || 'db';

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
  const dbCheck = await masterPool.request().query(
    "SELECT name FROM sys.databases WHERE name = 'bingodb'"
  );
  if (dbCheck.recordset.length === 0) {
    console.log('Creating database bingodb...');
    await masterPool.request().batch('CREATE DATABASE bingodb');
    // Wait a moment for DB to be ready
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    console.log('Database bingodb already exists.');
  }
  await masterPool.close();

  // Connect to bingodb
  const dbConfig = { ...config, database: 'bingodb' };
  const pool = await sql.connect(dbConfig);

  // Check if tables exist already
  const tableCheck = await pool.request().query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'organizations'"
  );

  if (tableCheck.recordset.length === 0) {
    console.log('Running migration 001-create-tables.sql...');
    const sql1 = readFileSync('./database/001-create-tables.sql', 'utf8');
    await pool.request().batch(sql1);

    console.log('Running migration 002-seed-organizations.sql...');
    const sql2 = readFileSync('./database/002-seed-organizations.sql', 'utf8');
    await pool.request().batch(sql2);

    console.log('Running migration 003-add-admin-and-campaigns.sql...');
    const sql3 = readFileSync('./database/003-add-admin-and-campaigns.sql', 'utf8');
    // Split on GO-like statements; run ALTER TABLE statements separately
    const statements = sql3.split(/;\s*$/m).filter((s) => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await pool.request().batch(stmt);
        } catch (err) {
          // Some statements may fail if already applied (idempotent)
          console.log(`  Warning: ${err.message.slice(0, 100)}`);
        }
      }
    }
  } else {
    console.log('Tables already exist, skipping migrations.');
  }

  await pool.close();
  console.log('Database initialization complete!');
  process.exit(0);
}

run().catch((err) => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});
