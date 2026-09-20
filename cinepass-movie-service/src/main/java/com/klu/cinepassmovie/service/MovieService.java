package com.klu.cinepassmovie.service;

import com.klu.cinepassmovie.model.Movie;
import com.klu.cinepassmovie.repo.MovieRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MovieService {

    @Autowired
    MovieRepository movieRepository;

    public Movie addMovie(Movie movie) {
        return movieRepository.save(movie);
    }

    public List<Movie> getAllMovies() {
        return movieRepository.findAll();
    }

    public Movie getMovieById(Long id) {
        Optional<Movie> opt = movieRepository.findById(id);
        return opt.orElse(null);
    }

    public Movie updateMovie(Long id, Movie updatedData) {
        Optional<Movie> opt = movieRepository.findById(id);
        if (opt.isPresent()) {
            Movie movie = opt.get();
            movie.setTitle(updatedData.getTitle());
            movie.setGenre(updatedData.getGenre());
            movie.setDuration(updatedData.getDuration());
            return movieRepository.save(movie);
        }
        return null;
    }

    public boolean deleteMovie(Long id) {
        if (movieRepository.existsById(id)) {
            movieRepository.deleteById(id);
            return true;
        }
        return false;
    }
}

