package com.klu.cinepassgateway.filter;

import com.klu.cinepassgateway.service.JWTService;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    @Autowired
    private JWTService jwtService;

    private static final List<String> PUBLIC_ENDPOINTS = List.of(
            "/api/users/signup",
            "/api/users/signin",
            "/swagger-ui",
            "/v3/api-docs",
            "/actuator"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Allow public paths & swagger & static assets
        if (isPublic(path)) {
            return chain.filter(exchange);
        }

        // Allow GET requests for movie/show viewing if public
        if (request.getMethod().name().equals("GET") && (path.startsWith("/api/movies") || path.startsWith("/api/shows"))) {
            return chain.filter(exchange);
        }

        // Check Authorization header
        if (!request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "Missing Authorization Header");
        }

        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "Invalid Authorization Header. Format: Bearer <token>");
        }

        String token = authHeader.substring(7);

        try {
            if (!jwtService.validateJWT(token)) {
                return onError(exchange, HttpStatus.UNAUTHORIZED, "Invalid or expired JWT Token");
            }

            Claims claims = jwtService.getClaims(token);
            String username = claims.getSubject();
            Object userId = claims.get("userId");
            String role = (String) claims.get("role");

            ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", userId != null ? String.valueOf(userId) : "")
                    .header("X-User-Name", username)
                    .header("X-User-Role", role)
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (Exception e) {
            return onError(exchange, HttpStatus.UNAUTHORIZED, "JWT validation failed: " + e.getMessage());
        }
    }

    private boolean isPublic(String path) {
        if (path.equals("/") || path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".png") || path.endsWith(".ico") || path.endsWith(".svg")) {
            return true;
        }
        if (path.equals("/api/users/signup") || path.equals("/api/users/signin")) {
            return true;
        }
        if (path.startsWith("/swagger-ui") || path.startsWith("/v3/api-docs") || path.startsWith("/actuator")) {
            return true;
        }
        return false;
    }

    private Mono<Void> onError(ServerWebExchange exchange, HttpStatus status, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String json = String.format("{\"code\":%d,\"message\":\"%s\"}", status.value(), message);
        DataBuffer buffer = response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -1; // Highest filter priority
    }
}

