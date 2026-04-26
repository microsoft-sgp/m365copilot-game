#!/bin/bash
set -e

echo "Waiting for SQL Server to be ready..."
until /opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -Q "SELECT 1" &>/dev/null; do
  sleep 2
done
echo "SQL Server is ready."

echo "Creating database..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -Q "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'bingodb') CREATE DATABASE bingodb;"

echo "Running migration 001..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d bingodb -i /docker-entrypoint-initdb.d/001-create-tables.sql

echo "Running migration 002..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d bingodb -i /docker-entrypoint-initdb.d/002-seed-organizations.sql

echo "Running migration 003..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d bingodb -i /docker-entrypoint-initdb.d/003-add-admin-and-campaigns.sql

echo "Running migration 004..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d bingodb -i /docker-entrypoint-initdb.d/004-add-progression-scores.sql

echo "Running migration 005..."
/opt/mssql-tools/bin/sqlcmd -S "$DB_HOST" -U sa -P "$SA_PASSWORD" -d bingodb -i /docker-entrypoint-initdb.d/005-pack-assignment-lifecycle.sql

echo "Database initialization complete!"
