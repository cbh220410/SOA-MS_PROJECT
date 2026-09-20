package com.klu.cinepassuser;

import com.klu.cinepassuser.model.User;
import com.klu.cinepassuser.repo.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication
@EnableDiscoveryClient
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    public CommandLineRunner initUsers(UserRepository userRepository) {
        return args -> {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
            
            // Ensure admin user exists with valid BCrypt password
            userRepository.findByUsername("admin").ifPresentOrElse(admin -> {
                admin.setPassword(encoder.encode("password123"));
                userRepository.save(admin);
            }, () -> {
                User admin = new User();
                admin.setUsername("admin");
                admin.setEmail("admin@cinepass.com");
                admin.setPassword(encoder.encode("password123"));
                admin.setRole("ADMIN");
                userRepository.save(admin);
            });

            // Ensure john_doe user exists with valid BCrypt password
            userRepository.findByUsername("john_doe").ifPresentOrElse(john -> {
                john.setPassword(encoder.encode("password123"));
                userRepository.save(john);
            }, () -> {
                User john = new User();
                john.setUsername("john_doe");
                john.setEmail("john@cinepass.com");
                john.setPassword(encoder.encode("password123"));
                john.setRole("USER");
                userRepository.save(john);
            });
        };
    }
}

