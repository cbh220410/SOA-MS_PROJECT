@echo off
set PGPASSWORD=cbh220410
echo Synchronizing all sequences in single database: cinepass_db
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d cinepass_db -c "SELECT setval('users_user_id_seq', (SELECT COALESCE(MAX(user_id), 1) FROM users));"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d cinepass_db -c "SELECT setval('movies_movie_id_seq', (SELECT COALESCE(MAX(movie_id), 1) FROM movies));"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d cinepass_db -c "SELECT setval('shows_show_id_seq', (SELECT COALESCE(MAX(show_id), 1) FROM shows));"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d cinepass_db -c "SELECT setval('bookings_booking_id_seq', (SELECT COALESCE(MAX(booking_id), 5000) FROM bookings));"
