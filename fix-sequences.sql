-- Synchronize all PostgreSQL sequences to avoid duplicate key errors on manual seeds

\c cinepass_movie_db;
SELECT setval(pg_get_serial_sequence('movies', 'movie_id'), COALESCE(MAX(movie_id), 1)) FROM movies;

\c cinepass_show_db;
SELECT setval(pg_get_serial_sequence('shows', 'show_id'), COALESCE(MAX(show_id), 1)) FROM shows;

\c cinepass_user_db;
SELECT setval(pg_get_serial_sequence('users', 'user_id'), COALESCE(MAX(user_id), 1)) FROM users;

\c cinepass_booking_db;
SELECT setval(pg_get_serial_sequence('bookings', 'booking_id'), COALESCE(MAX(booking_id), 1)) FROM bookings;

