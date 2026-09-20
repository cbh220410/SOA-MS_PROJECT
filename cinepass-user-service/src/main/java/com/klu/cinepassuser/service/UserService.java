package com.klu.cinepassuser.service;

import com.klu.cinepassuser.model.User;
import com.klu.cinepassuser.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    UserRepository userRepository;

    @Autowired
    JWTService jwtService;

    private BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public Object registerUser(User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            Map<String, Object> response = new HashMap<>();
            response.put("code", 409);
            response.put("message", "Username already exists");
            return response;
        }

        if (userRepository.existsByEmail(user.getEmail())) {
            Map<String, Object> response = new HashMap<>();
            response.put("code", 409);
            response.put("message", "Email already registered");
            return response;
        }

        // Security Algorithm: All public signups are assigned USER role internally.
        // Prevents privilege escalation and role abuse.
        user.setRole("USER");

        // BCrypt Password Encryption
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        User savedUser = userRepository.save(user);
        savedUser.setPassword("******"); // mask password in response
        return savedUser;
    }

    public Map<String, Object> loginUser(User loginRequest) {
        Map<String, Object> response = new HashMap<>();

        String identifier = loginRequest.getUsername();
        if (identifier == null || identifier.trim().isEmpty()) {
            identifier = loginRequest.getEmail();
        }

        if (identifier == null || identifier.trim().isEmpty()) {
            response.put("code", 401);
            response.put("message", "Username or email is required");
            return response;
        }

        Optional<User> userOpt = userRepository.findByUsername(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(identifier);
        }

        if (userOpt.isEmpty()) {
            response.put("code", 401);
            response.put("message", "Invalid username or password");
            return response;
        }

        User user = userOpt.get();
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            response.put("code", 401);
            response.put("message", "Invalid username or password");
            return response;
        }

        String token = jwtService.generateJWT(user.getUsername(), user.getRole(), user.getId());

        response.put("code", 200);
        response.put("message", "success");
        response.put("jwt", token);
        response.put("userId", user.getId());
        response.put("username", user.getUsername());
        response.put("role", user.getRole());
        return response;
    }

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
}

