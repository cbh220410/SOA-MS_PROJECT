-- Sample Seed Users for CinePass (Password is 'password123')
INSERT INTO users (user_id, username, email, password, role) 
VALUES (1, 'admin', 'admin@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (user_id, username, email, password, role) 
VALUES (2, 'john_doe', 'john@cinepass.com', '$2a$10$wN16lqF120jYfXp0P5O5w.ZkZkJkLpQ0rP8sTuVwXyZ1234567890', 'USER')
ON CONFLICT (username) DO NOTHING;
