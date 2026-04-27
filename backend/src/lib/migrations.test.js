import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', '..', 'database');

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

describe('SQL migration files', () => {
  it('exist and follow numeric NNN- prefix ordering', () => {
    const files = listMigrations();
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f) => {
      expect(f).toMatch(/^\d{3}-[a-z0-9-]+\.sql$/);
    });
    // Numeric prefixes must be unique and contiguous-ish (no duplicates).
    const prefixes = files.map((f) => f.slice(0, 3));
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('every migration is non-empty and contains at least one DDL statement', () => {
    for (const file of listMigrations()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      expect(sql.trim().length, `${file} is empty`).toBeGreaterThan(0);
      expect(sql, `${file} has no DDL/DML`).toMatch(
        /\b(CREATE|ALTER|INSERT|MERGE|UPDATE|DROP)\b/i,
      );
    }
  });

  it('first migration creates the core tables referenced by handlers', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '001-create-tables.sql'), 'utf8');
    for (const table of ['organizations', 'players', 'submissions', 'game_sessions', 'tile_events']) {
      expect(sql, `001-create-tables.sql missing table: ${table}`).toMatch(
        new RegExp(`CREATE TABLE\\s+(?:dbo\\.)?${table}\\b`, 'i'),
      );
    }
  });

  it('admin_users migration creates admin_users; admin_otps comes from earlier migration', () => {
    const adminUsers = readFileSync(join(MIGRATIONS_DIR, '006-admin-users.sql'), 'utf8');
    expect(adminUsers).toMatch(/CREATE TABLE\s+(?:dbo\.)?admin_users\b/i);
    const otps = readFileSync(join(MIGRATIONS_DIR, '003-add-admin-and-campaigns.sql'), 'utf8');
    expect(otps).toMatch(/CREATE TABLE\s+(?:dbo\.)?admin_otps\b/i);
  });

  it('migrations do not contain placeholder secrets', () => {
    for (const file of listMigrations()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      expect(sql, `${file} contains AccountKey=`).not.toMatch(/AccountKey=/i);
      expect(sql, `${file} contains password=`).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
    }
  });
});
