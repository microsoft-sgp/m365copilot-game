import sql from 'mssql';

let pool;

export async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
  return pool;
}
