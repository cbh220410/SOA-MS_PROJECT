package com.klu.cinepassshow.controller;

import com.klu.cinepassshow.model.Show;
import com.klu.cinepassshow.service.ShowService;
import com.klu.cinepassshow.util.JwtValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shows")
@Tag(name = "Show API", description = "Showtime scheduling, seat inventory, and atomic reservation APIs")
public class ShowController {

    @Autowired
    ShowService showService;

    @Autowired
    JwtValidator jwtValidator;

    private String resolveRole(String authHeader, String xUserRole) {
        if (xUserRole != null && !xUserRole.trim().isEmpty()) {
            return xUserRole.trim();
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtValidator.validateToken(token)) {
                return jwtValidator.extractRole(token);
            }
        }
        return null;
    }

    @PostMapping
    @Operation(summary = "Schedule a new show (Admin Only)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> addShow(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Role", required = false) String xUserRole,
            @Valid @RequestBody Show show) {
        String role = resolveRole(authHeader, xUserRole);
        if (role == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        if (!"ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("code", 403, "message", "Access Denied: Only ADMIN role can schedule shows."));
        }
        Show created = showService.addShow(show);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all scheduled shows (Public)")
    public ResponseEntity<List<Show>> getAllShows() {
        return ResponseEntity.ok(showService.getAllShows());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get show details by ID (Public)")
    public ResponseEntity<Show> getShowById(@PathVariable("id") Long id) {
        Show show = showService.getShowById(id);
        if (show != null) {
            return ResponseEntity.ok(show);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/movie/{movieId}")
    @Operation(summary = "Get all shows for a given movie (Public)")
    public ResponseEntity<List<Show>> getShowsByMovieId(@PathVariable("movieId") Long movieId) {
        return ResponseEntity.ok(showService.getShowsByMovieId(movieId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update show details (Admin Only)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> updateShow(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Role", required = false) String xUserRole,
            @PathVariable("id") Long id,
            @Valid @RequestBody Show show) {
        String role = resolveRole(authHeader, xUserRole);
        if (role == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        if (!"ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("code", 403, "message", "Access Denied: Only ADMIN role can update shows."));
        }
        Show updated = showService.updateShow(id, show);
        if (updated != null) {
            return ResponseEntity.ok(updated);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete show by ID (Admin Only)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> deleteShow(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Role", required = false) String xUserRole,
            @PathVariable("id") Long id) {
        String role = resolveRole(authHeader, xUserRole);
        if (role == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        if (!"ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("code", 403, "message", "Access Denied: Only ADMIN role can delete shows."));
        }
        boolean deleted = showService.deleteShow(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("code", 200, "message", "Show #" + id + " successfully deleted."));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", 404, "message", "Show #" + id + " not found."));
    }

    @PostMapping("/{id}/book")
    @Operation(summary = "Atomically reserve seats for a show (High-Concurrency Safe)")
    public ResponseEntity<Map<String, Object>> bookSeats(
            @PathVariable("id") Long id,
            @RequestParam("seats") int seats) {
        Map<String, Object> response = new HashMap<>();
        if (seats <= 0) {
            response.put("code", 400);
            response.put("message", "Seats must be greater than zero");
            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }
        boolean success = showService.reserveSeats(id, seats);
        if (success) {
            response.put("code", 200);
            response.put("message", "Seats reserved successfully");
            return ResponseEntity.ok(response);
        } else {
            response.put("code", 409);
            response.put("message", "Insufficient seats available");
            return new ResponseEntity<>(response, HttpStatus.CONFLICT);
        }
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Atomically refund seats on booking cancellation")
    public ResponseEntity<Map<String, Object>> cancelSeats(
            @PathVariable("id") Long id,
            @RequestParam("seats") int seats) {
        Map<String, Object> response = new HashMap<>();
        if (seats <= 0) {
            response.put("code", 400);
            response.put("message", "Seats must be greater than zero");
            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }
        boolean success = showService.releaseSeats(id, seats);
        if (!success) {
            response.put("code", 404);
            response.put("message", "Show not found");
            return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
        }
        response.put("code", 200);
        response.put("message", "Seats refunded successfully");
        return ResponseEntity.ok(response);
    }
}

