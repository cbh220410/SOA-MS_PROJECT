package com.klu.cinepassshow.controller;

import com.klu.cinepassshow.model.Show;
import com.klu.cinepassshow.service.ShowService;
import io.swagger.v3.oas.annotations.Operation;
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

    @PostMapping
    @Operation(summary = "Schedule a new show")
    public ResponseEntity<Show> addShow(@Valid @RequestBody Show show) {
        Show created = showService.addShow(show);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all scheduled shows")
    public ResponseEntity<List<Show>> getAllShows() {
        return ResponseEntity.ok(showService.getAllShows());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get show details by ID")
    public ResponseEntity<Show> getShowById(@PathVariable("id") Long id) {
        Show show = showService.getShowById(id);
        if (show != null) {
            return ResponseEntity.ok(show);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/movie/{movieId}")
    @Operation(summary = "Get all shows for a given movie")
    public ResponseEntity<List<Show>> getShowsByMovieId(@PathVariable("movieId") Long movieId) {
        return ResponseEntity.ok(showService.getShowsByMovieId(movieId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update show details")
    public ResponseEntity<Show> updateShow(@PathVariable("id") Long id, @Valid @RequestBody Show show) {
        Show updated = showService.updateShow(id, show);
        if (updated != null) {
            return ResponseEntity.ok(updated);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete show by ID")
    public ResponseEntity<Void> deleteShow(@PathVariable("id") Long id) {
        boolean deleted = showService.deleteShow(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
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

