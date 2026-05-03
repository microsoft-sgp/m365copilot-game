import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'database');

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
      expect(sql, `${file} has no DDL/DML`).toMatch(/\b(CREATE|ALTER|INSERT|MERGE|UPDATE|DROP)\b/i);
    }
  });

  it('first migration creates the core tables referenced by handlers', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '001-create-tables.sql'), 'utf8');
    for (const table of [
      'organizations',
      'players',
      'submissions',
      'game_sessions',
      'tile_events',
    ]) {
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

  it('player recovery migration creates device-token and recovery OTP structures', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '010-player-recovery.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE\s+(?:dbo\.)?player_device_tokens\b/i);
    expect(sql).toMatch(/FOREIGN KEY\s*\(player_id\)\s+REFERENCES\s+players\s*\(id\)/i);
    expect(sql).toMatch(/IX_player_device_tokens_player_active_hash/i);
    expect(sql).toMatch(/UX_player_device_tokens_active_token_hash/i);
    expect(sql).toMatch(/WHERE\s+revoked_at\s+IS\s+NULL/i);

    expect(sql).toMatch(/CREATE TABLE\s+(?:dbo\.)?player_recovery_otps\b/i);
    for (const column of ['email', 'code_hash', 'expires_at', 'used', 'created_at', 'used_at']) {
      expect(sql, `player_recovery_otps missing ${column}`).toMatch(
        new RegExp(`\\b${column}\\b`, 'i'),
      );
    }
    expect(sql).toMatch(/IX_player_recovery_otps_email_created/i);
    expect(sql).toMatch(/IX_player_recovery_otps_unused_lookup/i);
    expect(sql).toMatch(/WHERE\s+used\s*=\s*0/i);
  });

  it('pack assignment abandonment migration extends lifecycle status without blacklist tables', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '011-pack-assignment-abandonment.sql'), 'utf8');
    expect(sql).toMatch(/\babandoned_at\b/i);
    expect(sql).toMatch(/status\s+IN\s*\([^)]*'active'[^)]*'completed'[^)]*'abandoned'[^)]*\)/i);
    expect(sql).toMatch(/CK_pack_assignments_abandoned_at/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+(?:dbo\.)?(?:player_)?pack_.*blacklist/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+(?:dbo\.)?blacklist/i);
  });

  it('migration runners include the latest migration file', () => {
    const files = listMigrations();
    const latestMigration = files[files.length - 1];
    for (const runner of ['scripts/init-db.mjs', 'backend/scripts/run-migrations.mjs']) {
      const source = readFileSync(join(REPO_ROOT, runner), 'utf8');
      expect(source, `${runner} does not run ${latestMigration}`).toContain(latestMigration);
    }
  });

  it('migrations do not contain placeholder secrets', () => {
    for (const file of listMigrations()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      expect(sql, `${file} contains AccountKey=`).not.toMatch(/AccountKey=/i);
      expect(sql, `${file} contains password=`).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
    }
  });
});
