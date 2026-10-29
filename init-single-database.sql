-- =========================================================================
-- CinePass Single Unified Database Initialization Script (cinepass_db)
-- Connects all microservices (User, Movie, Show, Booking) to one database
-- =========================================================================

-- 1. Create Tables with Foreign Key Relationships / Joins
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER'
);

CREATE TABLE IF NOT EXISTS movies (
    movie_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    duration INT NOT NULL
);

CREATE TABLE IF NOT EXISTS shows (
    show_id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT NOT NULL,
    show_time TIMESTAMP NOT NULL,
    available_seats INT NOT NULL CHECK (available_seats >= 0),
    CONSTRAINT fk_shows_movie FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    seats_booked INT NOT NULL,
    seat_numbers VARCHAR(255),
    booking_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_show FOREIGN KEY (show_id) REFERENCES shows(show_id) ON DELETE CASCADE
);

-- 2. Clear All Booked Tickets
TRUNCATE TABLE bookings;

-- 3. Seed Clean Core Data
-- Users
INSERT INTO users (user_id, username, email, password, role) 
VALUES 
(1, 'admin', 'admin@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'ADMIN'),
(2, 'john_doe', 'john@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'USER')
ON CONFLICT (username) DO NOTHING;

-- Movies
INSERT INTO movies (movie_id, title, genre, duration) VALUES
(1, 'Avengers: Secret Wars', 'Action/Sci-Fi', 180),
(2, 'Interstellar', 'Sci-Fi/Drama', 169),
(3, 'Inception', 'Sci-Fi/Thriller', 148),
(4, 'Avatar: The Way of Water', 'Action/Adventure', 192)
ON CONFLICT (movie_id) DO UPDATE SET title = EXCLUDED.title, genre = EXCLUDED.genre, duration = EXCLUDED.duration;

-- Shows (All seats restored to full fresh capacity)
INSERT INTO shows (show_id, movie_id, show_time, available_seats) VALUES
(101, 1, CURRENT_TIMESTAMP + INTERVAL '2 days', 100),
(102, 2, CURRENT_TIMESTAMP + INTERVAL '3 days', 50),
(103, 3, CURRENT_TIMESTAMP + INTERVAL '4 days', 25)
ON CONFLICT (show_id) DO UPDATE SET available_seats = EXCLUDED.available_seats, show_time = EXCLUDED.show_time;

-- 4. Reset & Synchronize Sequences
SELECT setval('users_user_id_seq', (SELECT COALESCE(MAX(user_id), 1) FROM users));
SELECT setval('movies_movie_id_seq', (SELECT COALESCE(MAX(movie_id), 1) FROM movies));
SELECT setval('shows_show_id_seq', (SELECT COALESCE(MAX(show_id), 1) FROM shows));
SELECT setval('bookings_booking_id_seq', (SELECT COALESCE(MAX(booking_id), 5000) FROM bookings));

