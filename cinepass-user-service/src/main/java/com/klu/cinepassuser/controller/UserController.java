package com.klu.cinepassuser.controller;

import com.klu.cinepassuser.model.User;
import com.klu.cinepassuser.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@Tag(name = "User API", description = "User Registration, Login, and Profile APIs")
public class UserController {

    @Autowired
    UserService userService;

    @PostMapping("/signup")
    @Operation(summary = "Register a new user", description = "Creates a user account with BCrypt encrypted password")
    public ResponseEntity<Object> signUp(@Valid @RequestBody User user) {
        Object result = userService.registerUser(user);
        if (result instanceof Map && ((Map<?, ?>) result).containsKey("code")) {
            return new ResponseEntity<>(result, HttpStatus.CONFLICT);
        }
        return new ResponseEntity<>(result, HttpStatus.CREATED);
    }

    @PostMapping("/signin")
    @Operation(summary = "User Login", description = "Authenticates user and generates 24-hour JWT token")
    public ResponseEntity<Map<String, Object>> signIn(@RequestBody User loginRequest) {
        Map<String, Object> response = userService.loginUser(loginRequest);
        int code = (int) response.get("code");
        if (code == 200) {
            return ResponseEntity.ok(response);
        } else {
            return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user details by ID")
    public ResponseEntity<User> getUserById(@PathVariable("id") Long id) {
        User user = userService.getUserById(id);
        if (user != null) {
            user.setPassword("******");
            return ResponseEntity.ok(user);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping
    @Operation(summary = "Get all users list")
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userService.getAllUsers();
        users.forEach(u -> u.setPassword("******"));
        return ResponseEntity.ok(users);
    }
}

