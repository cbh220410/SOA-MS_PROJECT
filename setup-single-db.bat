@echo off
set PGPASSWORD=cbh220410
echo ========================================================
echo Setting up single unified CinePass database: cinepass_db
echo ========================================================

"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d postgres -f create-db.sql

echo Initializing tables with foreign keys and clearing booked tickets...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d cinepass_db -f init-single-database.sql

echo ========================================================
echo Verifying tables in cinepass_db:
echo ========================================================
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d cinepass_db -c "\dt"

echo ========================================================
echo Database setup complete.
echo ========================================================
