package com.klu.cinepassbooking.service;

import com.klu.cinepassbooking.model.Booking;
import com.klu.cinepassbooking.repo.BookingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class BookingService {

    @Autowired
    BookingRepository bookingRepository;

    @Autowired
    RestTemplate restTemplate;

    private final String SHOW_SERVICE_URL = "http://localhost:8083/api/shows";

    // Anti-Bot in-flight concurrency lock per user
    private final java.util.concurrent.ConcurrentHashMap<Long, Long> activeUserBookings = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * High-Concurrency Ticket Booking & Rush-Time Fair Allocation Engine.
     * 
     * Algorithm Rules:
     * 1. Fair Anti-Hoarding Quota: Maximum 6 seats per transaction during high demand.
     * 2. Anti-Bot Concurrency Throttling: Prevents parallel automated script spamming per user.
     * 3. Database Atomic Reservation: Conditional row-level lock decrement on PostgreSQL.
     */
    @Transactional
    public Object createBooking(Booking booking) {
        if (booking.getSeatsBooked() == null || booking.getSeatsBooked() <= 0) {
            Map<String, Object> error = new HashMap<>();
            error.put("code", 400);
            error.put("message", "Seats booked must be at least 1");
            return error;
        }

        // Rule 1: Anti-Scalping & Fair Rush-Hour Quota (Max 6 seats per transaction)
        if (booking.getSeatsBooked() > 6) {
            Map<String, Object> error = new HashMap<>();
            error.put("code", 400);
            error.put("message", "Fair Booking Policy: Maximum 6 tickets allowed per transaction during high demand.");
            return error;
        }

        // Rule 2: Anti-Bot In-Flight User Lock (Rate limit spam from same user ID)
        Long userId = booking.getUserId() != null ? booking.getUserId() : 1L;
        Long lastRequestTime = activeUserBookings.get(userId);
        long now = System.currentTimeMillis();
        if (lastRequestTime != null && (now - lastRequestTime) < 400) {
            Map<String, Object> rateLimit = new HashMap<>();
            rateLimit.put("code", 429);
            rateLimit.put("message", "Rush throttle: Parallel rapid requests detected. Please wait a moment.");
            return rateLimit;
        }
        activeUserBookings.put(userId, now);

        try {
            // Call Show Service to reserve seats atomically
            String url = SHOW_SERVICE_URL + "/" + booking.getShowId() + "/book?seats=" + booking.getSeatsBooked();
            ResponseEntity<Map> response = restTemplate.postForEntity(url, null, Map.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                booking.setBookingStatus("CONFIRMED");
                return bookingRepository.save(booking);
            } else {
                Map<String, Object> conflict = new HashMap<>();
                conflict.put("code", 409);
                conflict.put("message", "Insufficient seats available");
                return conflict;
            }
        } catch (HttpClientErrorException.Conflict ex) {
            Map<String, Object> conflict = new HashMap<>();
            conflict.put("code", 409);
            conflict.put("message", "Insufficient seats available for Show #" + booking.getShowId());
            return conflict;
        } catch (Exception ex) {
            Map<String, Object> err = new HashMap<>();
            err.put("code", 500);
            err.put("message", "Show Service communication error: " + ex.getMessage());
            return err;
        } finally {
            // Clean up old entries from activeUserBookings map periodically
            if (activeUserBookings.size() > 500) {
                activeUserBookings.entrySet().removeIf(e -> (now - e.getValue()) > 5000);
            }
        }
    }

    public Booking getBookingById(Long id) {
        return bookingRepository.findById(id).orElse(null);
    }

    public List<Booking> getBookingsByUserId(Long userId) {
        return bookingRepository.findByUserId(userId);
    }

    public List<Booking> getBookingsByShowId(Long showId) {
        return bookingRepository.findByShowId(showId);
    }

    @Transactional
    public Object cancelBooking(Long id) {
        Optional<Booking> opt = bookingRepository.findById(id);
        if (opt.isEmpty()) {
            Map<String, Object> err = new HashMap<>();
            err.put("code", 404);
            err.put("message", "Booking not found");
            return err;
        }

        Booking booking = opt.get();
        if ("CANCELLED".equals(booking.getBookingStatus())) {
            Map<String, Object> err = new HashMap<>();
            err.put("code", 400);
            err.put("message", "Booking is already cancelled");
            return err;
        }

        // Refund seats to Show Service
        try {
            String url = SHOW_SERVICE_URL + "/" + booking.getShowId() + "/cancel?seats=" + booking.getSeatsBooked();
            restTemplate.postForEntity(url, null, Map.class);
        } catch (Exception e) {
            // Log warning
        }

        booking.setBookingStatus("CANCELLED");
        return bookingRepository.save(booking);
    }
}

