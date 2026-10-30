package com.klu.cinepassbooking.controller;

import com.klu.cinepassbooking.model.Booking;
import com.klu.cinepassbooking.service.BookingService;
import com.klu.cinepassbooking.util.JwtValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
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

    @Autowired
    JwtValidator jwtValidator;

    private Long resolveUserId(String authHeader, String xUserId) {
        if (xUserId != null && !xUserId.trim().isEmpty()) {
            try {
                return Long.parseLong(xUserId.trim());
            } catch (NumberFormatException ignored) {}
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtValidator.validateToken(token)) {
                return jwtValidator.extractUserId(token);
            }
        }
        return null;
    }

    private boolean isAuthorized(String authHeader, String xUserId) {
        if (xUserId != null && !xUserId.trim().isEmpty()) return true;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return jwtValidator.validateToken(authHeader.substring(7));
        }
        return false;
    }

    @PostMapping
    @Operation(summary = "Book cinema tickets (High-Concurrency Safe)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> createBooking(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @Valid @RequestBody Booking booking) {
        if (!isAuthorized(authHeader, xUserId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        Long tokenUserId = resolveUserId(authHeader, xUserId);
        if (tokenUserId != null && (booking.getUserId() == null || booking.getUserId() == 0)) {
            booking.setUserId(tokenUserId);
        }
        Object result = bookingService.createBooking(booking);
        if (result instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) result;
            int code = map.get("code") instanceof Number ? ((Number) map.get("code")).intValue() : 500;
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
    @Operation(summary = "Get all bookings for a user", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> getBookingsByUserId(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @PathVariable("userId") Long userId) {
        if (!isAuthorized(authHeader, xUserId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        return ResponseEntity.ok(bookingService.getBookingsByUserId(userId));
    }

    @GetMapping("/show/{showId}")
    @Operation(summary = "Get all bookings for a show")
    public ResponseEntity<List<Booking>> getBookingsByShowId(@PathVariable("showId") Long showId) {
        return ResponseEntity.ok(bookingService.getBookingsByShowId(showId));
    }

    @GetMapping("/show/{showId}/seats")
    @Operation(summary = "Get all allocated seat numbers for a show (Public)")
    public ResponseEntity<List<String>> getBookedSeatsByShowId(@PathVariable("showId") Long showId) {
        return ResponseEntity.ok(bookingService.getBookedSeatNumbers(showId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Cancel booking and release seats back to inventory", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> cancelBooking(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @PathVariable("id") Long id) {
        if (!isAuthorized(authHeader, xUserId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        Object result = bookingService.cancelBooking(id);
        if (result instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) result;
            int code = map.get("code") instanceof Number ? ((Number) map.get("code")).intValue() : 500;
            return new ResponseEntity<>(result, HttpStatus.valueOf(code));
        }
        return ResponseEntity.ok(result);
    }
}

