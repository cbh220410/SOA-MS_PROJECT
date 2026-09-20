package com.klu.cinepassbooking.controller;

import com.klu.cinepassbooking.model.Booking;
import com.klu.cinepassbooking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@Tag(name = "Booking API", description = "Ticket booking, seat allocation, concurrency control, and cancellation APIs")
public class BookingController {

    @Autowired
    BookingService bookingService;

    @PostMapping
    @Operation(summary = "Book cinema tickets (High-Concurrency Safe)")
    public ResponseEntity<Object> createBooking(
            @Valid @RequestBody Booking booking,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {
        if (booking.getUserId() == null && headerUserId != null && !headerUserId.trim().isEmpty()) {
            try {
                booking.setUserId(Long.parseLong(headerUserId));
            } catch (NumberFormatException ignored) {}
        }
        if (booking.getUserId() == null) {
            booking.setUserId(1L); // Default fallback demo user
        }
        Object result = bookingService.createBooking(booking);
        if (result instanceof Map<?, ?> map) {
            Object codeObj = map.get("code");
            int code = (codeObj instanceof Number) ? ((Number) codeObj).intValue() : 500;
            return new ResponseEntity<>(result, HttpStatus.valueOf(code));
        }
        return new ResponseEntity<>(result, HttpStatus.CREATED);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get booking status by ID")
    public ResponseEntity<Booking> getBookingById(@PathVariable("id") Long id) {
        Booking booking = bookingService.getBookingById(id);
        if (booking != null) {
            return ResponseEntity.ok(booking);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get all bookings for a user")
    public ResponseEntity<List<Booking>> getBookingsByUserId(@PathVariable("userId") Long userId) {
        return ResponseEntity.ok(bookingService.getBookingsByUserId(userId));
    }

    @GetMapping("/show/{showId}")
    @Operation(summary = "Get all bookings for a show")
    public ResponseEntity<List<Booking>> getBookingsByShowId(@PathVariable("showId") Long showId) {
        return ResponseEntity.ok(bookingService.getBookingsByShowId(showId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Cancel booking and release seats back to inventory")
    public ResponseEntity<Object> cancelBooking(@PathVariable("id") Long id) {
        Object result = bookingService.cancelBooking(id);
        if (result instanceof Map<?, ?> map) {
            Object codeObj = map.get("code");
            int code = (codeObj instanceof Number) ? ((Number) codeObj).intValue() : 500;
            return new ResponseEntity<>(result, HttpStatus.valueOf(code));
        }
        return ResponseEntity.ok(result);
    }
}
