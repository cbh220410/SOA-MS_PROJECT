-- Sample Seed Bookings for CinePass
INSERT INTO bookings (booking_id, user_id, show_id, seats_booked, booking_status, created_at)
VALUES (5001, 2, 101, 2, 'CONFIRMED', CURRENT_TIMESTAMP)
ON CONFLICT (booking_id) DO UPDATE SET booking_status = EXCLUDED.booking_status;
