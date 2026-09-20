-- =========================================================================
-- CinePass Microservices Database Initialization Script (MySQL 8+)
-- =========================================================================

-- 1. Create Databases
CREATE DATABASE IF NOT EXISTS cinepass_user_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cinepass_movie_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cinepass_show_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cinepass_booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================================================
-- 2. User Service Database (cinepass_user_db)
-- =========================================================================
USE cinepass_user_db;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER'
) ENGINE=InnoDB;

-- Demo accounts (Password for both is 'password123')
-- BCrypt: $2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890
INSERT INTO users (user_id, username, email, password, role) 
VALUES (1, 'admin', 'admin@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'ADMIN')
ON DUPLICATE KEY UPDATE username=username;

INSERT INTO users (user_id, username, email, password, role) 
VALUES (2, 'john_doe', 'john@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'USER')
ON DUPLICATE KEY UPDATE username=username;

-- =========================================================================
-- 3. Movie Service Database (cinepass_movie_db)
-- =========================================================================
USE cinepass_movie_db;

CREATE TABLE IF NOT EXISTS movies (
    movie_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    duration INT NOT NULL
) ENGINE=InnoDB;

INSERT INTO movies (movie_id, title, genre, duration) VALUES
(1, 'Avengers: Secret Wars', 'Action/Sci-Fi', 180),
(2, 'Interstellar', 'Sci-Fi/Drama', 169),
(3, 'Inception', 'Sci-Fi/Thriller', 148),
(4, 'Avatar: The Way of Water', 'Action/Adventure', 192)
ON DUPLICATE KEY UPDATE title=title;

-- =========================================================================
-- 4. Show Service Database (cinepass_show_db)
-- =========================================================================
USE cinepass_show_db;

CREATE TABLE IF NOT EXISTS shows (
    show_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    movie_id BIGINT NOT NULL,
    show_time DATETIME NOT NULL,
    available_seats INT NOT NULL CHECK (available_seats >= 0)
) ENGINE=InnoDB;

INSERT INTO shows (show_id, movie_id, show_time, available_seats) VALUES
(101, 1, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 DAY), 100),
(102, 2, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 DAY), 50),
(103, 3, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 4 DAY), 10)
ON DUPLICATE KEY UPDATE available_seats=available_seats;

-- =========================================================================
-- 5. Booking Service Database (cinepass_booking_db)
-- =========================================================================
USE cinepass_booking_db;

CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    seats_booked INT NOT NULL,
    booking_status VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO bookings (booking_id, user_id, show_id, seats_booked, booking_status, created_at)
VALUES (5001, 2, 101, 2, 'CONFIRMED', CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE booking_status=booking_status;

