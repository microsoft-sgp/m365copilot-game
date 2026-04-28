import sql from 'mssql';
import type { ConnectionPool, config as SqlConfig } from 'mssql';

type ManagedIdentitySqlConfig = {
  server: string;
  database: string;
  authentication: {
    type: string;
    options?: {
      clientId: string;
    };
  };
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
};

let pool: ConnectionPool | undefined;

export function getSqlConfig(): string | ManagedIdentitySqlConfig {
  if (process.env.SQL_CONNECTION_STRING) return process.env.SQL_CONNECTION_STRING;

  const authenticationType =
    process.env.SQL_AUTHENTICATION || 'azure-active-directory-msi-app-service';
  const authentication: ManagedIdentitySqlConfig['authentication'] = { type: authenticationType };
  if (process.env.SQL_MANAGED_IDENTITY_CLIENT_ID) {
    authentication.options = { clientId: process.env.SQL_MANAGED_IDENTITY_CLIENT_ID };
  }

  return {
    server: process.env.SQL_SERVER_FQDN || process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE_NAME || process.env.SQL_DATABASE || 'bingo_db',
    authentication,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  };
}

export async function getPool(): Promise<ConnectionPool> {
  if (pool) return pool;
  pool = await sql.connect(getSqlConfig() as string | SqlConfig);
  return pool;
}
