package com.klu.cinepassshow.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Entity
@Table(name = "shows")
public class Show {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "show_id")
    private Long showId;

    @NotNull(message = "Movie ID is required")
    @Column(name = "movie_id", nullable = false)
    private Long movieId;

    @NotNull(message = "Show time is required")
    @Column(name = "show_time", nullable = false)
    private LocalDateTime showTime;

    @NotNull(message = "Available seats count is required")
    @Min(value = 0, message = "Available seats cannot be negative")
    @Column(name = "available_seats", nullable = false)
    private Integer availableSeats;

    public Show() {
    }

    public Show(Long showId, Long movieId, LocalDateTime showTime, Integer availableSeats) {
        this.showId = showId;
        this.movieId = movieId;
        this.showTime = showTime;
        this.availableSeats = availableSeats;
    }

    public Long getShowId() {
        return showId;
    }

    public void setShowId(Long showId) {
        this.showId = showId;
    }

    public Long getMovieId() {
        return movieId;
    }

    public void setMovieId(Long movieId) {
        this.movieId = movieId;
    }

    public LocalDateTime getShowTime() {
        return showTime;
    }

    public void setShowTime(LocalDateTime showTime) {
        this.showTime = showTime;
    }

    public Integer getAvailableSeats() {
        return availableSeats;
    }

    public void setAvailableSeats(Integer availableSeats) {
        this.availableSeats = availableSeats;
    }
}

