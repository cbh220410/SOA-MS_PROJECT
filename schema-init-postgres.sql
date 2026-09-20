-- =========================================================================
-- CinePass Microservices Database Initialization Script for PostgreSQL 14+
-- Default PostgreSQL User: postgres
-- Default Password: cbh220410
-- =========================================================================

-- 1. Create Individual Microservice Databases
-- Run these database creation statements in psql or pgAdmin connected to postgres server:

CREATE DATABASE cinepass_user_db;
CREATE DATABASE cinepass_movie_db;
CREATE DATABASE cinepass_show_db;
CREATE DATABASE cinepass_booking_db;

-- =========================================================================
-- 2. User Service Database (cinepass_user_db)
-- =========================================================================
\c cinepass_user_db;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER'
);

-- Demo accounts (Password for both is 'password123')
-- BCrypt: $2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890
INSERT INTO users (user_id, username, email, password, role) 
VALUES (1, 'admin', 'admin@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (user_id, username, email, password, role) 
VALUES (2, 'john_doe', 'john@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'USER')
ON CONFLICT (username) DO NOTHING;

-- =========================================================================
-- 3. Movie Service Database (cinepass_movie_db)
-- =========================================================================
\c cinepass_movie_db;

CREATE TABLE IF NOT EXISTS movies (
    movie_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    duration INT NOT NULL
);

INSERT INTO movies (movie_id, title, genre, duration) VALUES
(1, 'Avengers: Secret Wars', 'Action/Sci-Fi', 180),
(2, 'Interstellar', 'Sci-Fi/Drama', 169),
(3, 'Inception', 'Sci-Fi/Thriller', 148),
(4, 'Avatar: The Way of Water', 'Action/Adventure', 192)
ON CONFLICT (movie_id) DO UPDATE SET title = EXCLUDED.title;

-- =========================================================================
-- 4. Show Service Database (cinepass_show_db)
-- =========================================================================
\c cinepass_show_db;

CREATE TABLE IF NOT EXISTS shows (
    show_id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT NOT NULL,
    show_time TIMESTAMP NOT NULL,
    available_seats INT NOT NULL CHECK (available_seats >= 0)
);

INSERT INTO shows (show_id, movie_id, show_time, available_seats) VALUES
(101, 1, CURRENT_TIMESTAMP + INTERVAL '2 days', 100),
(102, 2, CURRENT_TIMESTAMP + INTERVAL '3 days', 50),
(103, 3, CURRENT_TIMESTAMP + INTERVAL '4 days', 10)
ON CONFLICT (show_id) DO UPDATE SET available_seats = EXCLUDED.available_seats;

-- =========================================================================
-- 5. Booking Service Database (cinepass_booking_db)
-- =========================================================================
\c cinepass_booking_db;

CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    seats_booked INT NOT NULL,
    booking_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO bookings (booking_id, user_id, show_id, seats_booked, booking_status, created_at)
VALUES (5001, 2, 101, 2, 'CONFIRMED', CURRENT_TIMESTAMP)
ON CONFLICT (booking_id) DO UPDATE SET booking_status = EXCLUDED.booking_status;

