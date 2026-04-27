#!/bin/bash
set -e

echo "Waiting for SQL Server to be ready..."
until /opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -Q "SELECT 1" &>/dev/null; do
  sleep 2
done
echo "SQL Server is ready."

DB_NAME="${DB_NAME:-bingo_db}"
if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "DB_NAME may only contain letters, numbers, and underscores"
  exit 1
fi

echo "Creating database..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -Q "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '$DB_NAME') EXEC('CREATE DATABASE [$DB_NAME]');"

echo "Running migration 001..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d "$DB_NAME" -i /docker-entrypoint-initdb.d/001-create-tables.sql

echo "Running migration 002..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d "$DB_NAME" -i /docker-entrypoint-initdb.d/002-seed-organizations.sql

echo "Running migration 003..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d "$DB_NAME" -i /docker-entrypoint-initdb.d/003-add-admin-and-campaigns.sql

echo "Running migration 004..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d "$DB_NAME" -i /docker-entrypoint-initdb.d/004-add-progression-scores.sql

echo "Running migration 005..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d "$DB_NAME" -i /docker-entrypoint-initdb.d/005-pack-assignment-lifecycle.sql

echo "Running migration 006..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d "$DB_NAME" -i /docker-entrypoint-initdb.d/006-admin-users.sql

echo "Database initialization complete!"
