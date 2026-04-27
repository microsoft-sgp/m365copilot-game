import sql from 'mssql';

let pool;

export function getSqlConfig() {
  if (process.env.SQL_CONNECTION_STRING) return process.env.SQL_CONNECTION_STRING;

  const authenticationType = process.env.SQL_AUTHENTICATION || 'azure-active-directory-msi-app-service';
  const authentication = { type: authenticationType };
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

export async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(getSqlConfig());
  return pool;
}
