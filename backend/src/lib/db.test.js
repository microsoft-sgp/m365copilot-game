import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level state (cached pool) lives across tests; reset modules between
// test cases so connection caching is observable.
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSqlConfig', () => {
  it('returns connection string verbatim when SQL_CONNECTION_STRING is set', async () => {
    vi.stubEnv('SQL_CONNECTION_STRING', 'Server=tcp:test.example,1433;Database=db;');
    const { getSqlConfig } = await import('./db.js');
    expect(getSqlConfig()).toBe('Server=tcp:test.example,1433;Database=db;');
  });

  it('builds an MSI config object from individual env vars', async () => {
    vi.stubEnv('SQL_CONNECTION_STRING', '');
    vi.stubEnv('SQL_SERVER_FQDN', 'srv.database.windows.net');
    vi.stubEnv('SQL_DATABASE_NAME', 'bingo_prod');
    vi.stubEnv('SQL_MANAGED_IDENTITY_CLIENT_ID', 'client-id-123');
    const { getSqlConfig } = await import('./db.js');
    const config = getSqlConfig();
    expect(config).toMatchObject({
      server: 'srv.database.windows.net',
      database: 'bingo_prod',
      authentication: {
        type: 'azure-active-directory-msi-app-service',
        options: { clientId: 'client-id-123' },
      },
      options: { encrypt: true, trustServerCertificate: false },
    });
  });

  it('falls back to defaults when env vars are absent', async () => {
    const { getSqlConfig } = await import('./db.js');
    const config = getSqlConfig();
    expect(config.database).toBe('bingo_db');
    expect(config.authentication.type).toBe('azure-active-directory-msi-app-service');
    expect(config.authentication.options).toBeUndefined();
  });

  it('honours SQL_AUTHENTICATION override', async () => {
    vi.stubEnv('SQL_AUTHENTICATION', 'azure-active-directory-default');
    const { getSqlConfig } = await import('./db.js');
    expect(getSqlConfig().authentication.type).toBe('azure-active-directory-default');
  });
});

describe('getPool', () => {
  it('caches the connection across calls', async () => {
    vi.doMock('mssql', () => ({
      default: { connect: vi.fn().mockResolvedValue({ poolId: 'pool-1' }) },
    }));
    const sql = (await import('mssql')).default;
    const { getPool } = await import('./db.js');

    const a = await getPool();
    const b = await getPool();
    expect(a).toBe(b);
    expect(sql.connect).toHaveBeenCalledTimes(1);
    vi.doUnmock('mssql');
  });
});
