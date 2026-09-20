package com.klu.cinepassbooking.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @NotNull(message = "Show ID is required")
    @Column(name = "show_id", nullable = false)
    private Long showId;

    @NotNull(message = "Seats count is required")
    @Min(value = 1, message = "Must book at least 1 seat")
    @Column(name = "seats_booked", nullable = false)
    private Integer seatsBooked;

    @Column(name = "booking_status", nullable = false)
    private String bookingStatus; // "CONFIRMED", "CANCELLED", "FAILED"

    public Booking() {
    }

    public Booking(Long bookingId, Long userId, Long showId, Integer seatsBooked, String bookingStatus) {
        this.bookingId = bookingId;
        this.userId = userId;
        this.showId = showId;
        this.seatsBooked = seatsBooked;
        this.bookingStatus = bookingStatus;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getShowId() {
        return showId;
    }

    public void setShowId(Long showId) {
        this.showId = showId;
    }

    public Integer getSeatsBooked() {
        return seatsBooked;
    }

    public void setSeatsBooked(Integer seatsBooked) {
        this.seatsBooked = seatsBooked;
    }

    public String getBookingStatus() {
        return bookingStatus;
    }

    public void setBookingStatus(String bookingStatus) {
        this.bookingStatus = bookingStatus;
    }
}

