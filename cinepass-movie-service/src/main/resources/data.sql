-- Sample Seed Movies for CinePass
INSERT INTO movies (movie_id, title, genre, duration) 
VALUES (1, 'Avengers: Secret Wars', 'Action/Sci-Fi', 180)
ON CONFLICT (movie_id) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO movies (movie_id, title, genre, duration) 
VALUES (2, 'Interstellar', 'Sci-Fi/Drama', 169)
ON CONFLICT (movie_id) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO movies (movie_id, title, genre, duration) 
VALUES (3, 'Inception', 'Sci-Fi/Thriller', 148)
ON CONFLICT (movie_id) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO movies (movie_id, title, genre, duration) 
VALUES (4, 'Avatar: The Way of Water', 'Action/Adventure', 192)
ON CONFLICT (movie_id) DO UPDATE SET title = EXCLUDED.title;
