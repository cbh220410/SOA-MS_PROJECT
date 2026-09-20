package com.klu.cinepassbooking;

import com.klu.cinepassbooking.model.Booking;
import com.klu.cinepassbooking.repo.BookingRepository;
import com.klu.cinepassbooking.service.BookingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ConcurrentBookingTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private BookingService bookingService;

    @Test
    @DisplayName("High Concurrency Test: 20 Simultaneous Users Contending for 10 Seats")
    void testConcurrentBooking_PreventsDoubleBooking_And_NegativeSeats() throws InterruptedException {
        final int INITIAL_SEATS = 10;
        final int SEATS_PER_REQUEST = 2;
        final int TOTAL_CONCURRENT_REQUESTS = 20; // 20 requests x 2 seats = 40 requested seats
        final Long SHOW_ID = 1L;

        // Atomic inventory simulating the Show Service database condition
        AtomicInteger showAvailableSeats = new AtomicInteger(INITIAL_SEATS);
        AtomicInteger confirmedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);

        // Mock atomic seat booking call to Show Service
        when(restTemplate.postForEntity(contains("/book?seats="), isNull(), eq(Map.class)))
                .thenAnswer(invocation -> {
                    while (true) {
                        int current = showAvailableSeats.get();
                        if (current < SEATS_PER_REQUEST) {
                            throw HttpClientErrorException.create(
                                    HttpStatus.CONFLICT,
                                    "Conflict",
                                    null,
                                    null,
                                    null
                            );
                        }
                        if (showAvailableSeats.compareAndSet(current, current - SEATS_PER_REQUEST)) {
                            Map<String, Object> body = new HashMap<>();
                            body.put("code", 200);
                            body.put("message", "Seats reserved");
                            return new ResponseEntity<>(body, HttpStatus.OK);
                        }
                    }
                });

        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking b = invocation.getArgument(0);
            b.setBookingId((long) ThreadLocalRandom.current().nextInt(100, 999));
            return b;
        });

        // Concurrency synchronization primitives
        ExecutorService executor = Executors.newFixedThreadPool(TOTAL_CONCURRENT_REQUESTS);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(TOTAL_CONCURRENT_REQUESTS);

        for (int i = 1; i <= TOTAL_CONCURRENT_REQUESTS; i++) {
            final long userId = i;
            executor.submit(() -> {
                try {
                    startGate.await(); // Synchronize all threads to fire at the exact same millisecond
                    Booking request = new Booking(null, userId, SHOW_ID, SEATS_PER_REQUEST, null);
                    Object result = bookingService.createBooking(request);

                    if (result instanceof Booking && "CONFIRMED".equals(((Booking) result).getBookingStatus())) {
                        confirmedCount.incrementAndGet();
                    } else if (result instanceof Map && Integer.valueOf(409).equals(((Map<?, ?>) result).get("code"))) {
                        rejectedCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    // Ignore
                } finally {
                    endGate.countDown();
                }
            });
        }

        // Fire all threads simultaneously
        startGate.countDown();
        boolean completed = endGate.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "All concurrent requests should finish within timeout");

        // Exactly 5 requests must succeed (10 seats / 2 per request = 5 confirmed bookings)
        assertEquals(5, confirmedCount.get(), "Exactly 5 bookings must succeed");

        // Exactly 15 requests must be rejected with 409 Conflict
        assertEquals(15, rejectedCount.get(), "Exactly 15 requests must be rejected due to inventory exhaustion");

        // Remaining inventory must reach exactly 0, never negative
        assertEquals(0, showAvailableSeats.get(), "Remaining seats must be exactly 0, never negative");
    }
}

