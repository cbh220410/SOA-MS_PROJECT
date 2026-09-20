package com.klu.cinepassmovie.controller;

import com.klu.cinepassmovie.model.Movie;
import com.klu.cinepassmovie.service.MovieService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/movies")
@Tag(name = "Movie API", description = "Movie catalog creation, viewing, updating, and deletion")
public class MovieController {

    @Autowired
    MovieService movieService;

    @PostMapping
    @Operation(summary = "Add a new movie")
    public ResponseEntity<Movie> addMovie(@Valid @RequestBody Movie movie) {
        Movie created = movieService.addMovie(movie);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all movies list")
    public ResponseEntity<List<Movie>> getAllMovies() {
        return ResponseEntity.ok(movieService.getAllMovies());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get movie details by ID")
    public ResponseEntity<Movie> getMovieById(@PathVariable("id") Long id) {
        Movie movie = movieService.getMovieById(id);
        if (movie != null) {
            return ResponseEntity.ok(movie);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update movie details")
    public ResponseEntity<Movie> updateMovie(@PathVariable("id") Long id, @Valid @RequestBody Movie movie) {
        Movie updated = movieService.updateMovie(id, movie);
        if (updated != null) {
            return ResponseEntity.ok(updated);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete movie by ID")
    public ResponseEntity<Void> deleteMovie(@PathVariable("id") Long id) {
        boolean deleted = movieService.deleteMovie(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}

