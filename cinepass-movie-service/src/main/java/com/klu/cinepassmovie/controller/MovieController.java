package com.klu.cinepassmovie.controller;

import com.klu.cinepassmovie.model.Movie;
import com.klu.cinepassmovie.service.MovieService;
import com.klu.cinepassmovie.util.JwtValidator;
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
@RequestMapping("/api/movies")
@Tag(name = "Movie API", description = "Movie catalog creation, viewing, updating, and deletion")
public class MovieController {

    @Autowired
    MovieService movieService;

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
    @Operation(summary = "Add a new movie (Admin Only)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> addMovie(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Role", required = false) String xUserRole,
            @Valid @RequestBody Movie movie) {
        String role = resolveRole(authHeader, xUserRole);
        if (role == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        if (!"ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("code", 403, "message", "Access Denied: Only ADMIN role can add movies."));
        }
        Movie created = movieService.addMovie(movie);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all movies list (Public)")
    public ResponseEntity<List<Movie>> getAllMovies() {
        return ResponseEntity.ok(movieService.getAllMovies());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get movie details by ID (Public)")
    public ResponseEntity<Movie> getMovieById(@PathVariable("id") Long id) {
        Movie movie = movieService.getMovieById(id);
        if (movie != null) {
            return ResponseEntity.ok(movie);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update movie details (Admin Only)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> updateMovie(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Role", required = false) String xUserRole,
            @PathVariable("id") Long id,
            @Valid @RequestBody Movie movie) {
        String role = resolveRole(authHeader, xUserRole);
        if (role == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", 401, "message", "Authorization Bearer token required. Please click 'Authorize' in Swagger and provide your JWT token."));
        }
        if (!"ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("code", 403, "message", "Access Denied: Only ADMIN role can update movies."));
        }
        Movie updated = movieService.updateMovie(id, movie);
        if (updated != null) {
            return ResponseEntity.ok(updated);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete movie by ID (Admin Only)", security = @SecurityRequirement(name = "BearerAuth"))
    public ResponseEntity<Object> deleteMovie(
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
                    .body(Map.of("code", 403, "message", "Access Denied: Only ADMIN role can delete movies."));
        }
        boolean deleted = movieService.deleteMovie(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("code", 200, "message", "Movie #" + id + " successfully deleted."));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", 404, "message", "Movie #" + id + " not found."));
    }
}

