package com.klu.cinepassshow.service;

import com.klu.cinepassshow.model.Show;
import com.klu.cinepassshow.repo.ShowRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ShowService {

    @Autowired
    ShowRepository showRepository;

    public Show addShow(Show show) {
        return showRepository.save(show);
    }

    public List<Show> getAllShows() {
        return showRepository.findAll();
    }

    public Show getShowById(Long id) {
        Optional<Show> opt = showRepository.findById(id);
        return opt.orElse(null);
    }

    public List<Show> getShowsByMovieId(Long movieId) {
        return showRepository.findByMovieId(movieId);
    }

    public Show updateShow(Long id, Show updatedData) {
        Optional<Show> opt = showRepository.findById(id);
        if (opt.isPresent()) {
            Show show = opt.get();
            show.setMovieId(updatedData.getMovieId());
            show.setShowTime(updatedData.getShowTime());
            show.setAvailableSeats(updatedData.getAvailableSeats());
            return showRepository.save(show);
        }
        return null;
    }

    public boolean deleteShow(Long id) {
        if (showRepository.existsById(id)) {
            showRepository.deleteById(id);
            return true;
        }
        return false;
    }

    /**
     * High-concurrency atomic seat reservation.
     * Returns true (1 row updated) or false (0 rows updated = insufficient seats).
     */
    @Transactional
    public boolean reserveSeats(Long showId, int seats) {
        int rows = showRepository.bookSeats(showId, seats);
        return rows > 0;
    }

    /**
     * Atomic seat refund on booking cancellation.
     */
    @Transactional
    public boolean releaseSeats(Long showId, int seats) {
        int rows = showRepository.cancelSeats(showId, seats);
        return rows > 0;
    }
}

