-- Sample Seed Shows for CinePass (Referencing Movies 1, 2, 3)
INSERT INTO shows (show_id, movie_id, show_time, available_seats) 
VALUES (101, 1, CURRENT_TIMESTAMP + INTERVAL '2 days', 100)
ON CONFLICT (show_id) DO UPDATE SET available_seats = EXCLUDED.available_seats;

INSERT INTO shows (show_id, movie_id, show_time, available_seats) 
VALUES (102, 2, CURRENT_TIMESTAMP + INTERVAL '3 days', 50)
ON CONFLICT (show_id) DO UPDATE SET available_seats = EXCLUDED.available_seats;

INSERT INTO shows (show_id, movie_id, show_time, available_seats) 
VALUES (103, 3, CURRENT_TIMESTAMP + INTERVAL '4 days', 10)
ON CONFLICT (show_id) DO UPDATE SET available_seats = EXCLUDED.available_seats;
