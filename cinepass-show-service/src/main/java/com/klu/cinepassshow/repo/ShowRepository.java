package com.klu.cinepassshow.repo;

import com.klu.cinepassshow.model.Show;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShowRepository extends JpaRepository<Show, Long> {

    List<Show> findByMovieId(Long movieId);

    /**
     * High-Concurrency Atomic Seat Allocation.
     * Decrements available_seats only if available_seats >= requested seats.
     * Returns affected rows: 1 if successful, 0 if insufficient seats.
     */
    @Modifying
    @Query("UPDATE Show s SET s.availableSeats = s.availableSeats - :seats WHERE s.showId = :showId AND s.availableSeats >= :seats")
    int bookSeats(@Param("showId") Long showId, @Param("seats") int seats);

    /**
     * Atomic Seat Refund for cancellations.
     */
    @Modifying
    @Query("UPDATE Show s SET s.availableSeats = s.availableSeats + :seats WHERE s.showId = :showId")
    int cancelSeats(@Param("showId") Long showId, @Param("seats") int seats);
}

