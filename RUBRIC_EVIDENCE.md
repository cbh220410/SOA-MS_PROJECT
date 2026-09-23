# CinePass Rubric Evidence

## 1. Problem Analysis and Requirement Specification

CinePass addresses concurrent ticket booking for popular shows. The Booking Service reserves seats through an atomic operation in the Show Service. Requests that exceed the remaining inventory return `409 CONFLICT`, while cancellation releases the seats back to inventory.

Evidence:

- [README.md](README.md): problem statement, functional requirements, security, and concurrency requirements.
- [BookingService.java](cinepass-booking-service/src/main/java/com/klu/cinepassbooking/service/BookingService.java): booking workflow and seat validation.
- [ShowService.java](cinepass-show-service/src/main/java/com/klu/cinepassshow/service/ShowService.java): atomic seat reservation and release.

## 2. Microservice Identification and Service Discovery

The system contains six independently deployable applications:

| Application | Port | Responsibility |
| --- | ---: | --- |
| Eureka Server | 8761 | Service registry |
| API Gateway | 8080 | Single entry point and JWT enforcement |
| User Service | 8081 | Registration, login, and user profiles |
| Movie Service | 8082 | Movie catalog CRUD |
| Show Service | 8083 | Show scheduling and seat inventory |
| Booking Service | 8084 | Booking, cancellation, and booking history |

Each business service registers with Eureka. The gateway uses `lb://` routes, so multiple instances can be selected by Spring Cloud LoadBalancer instead of hard-coded ports.

Evidence:

- [pom.xml](pom.xml): all six modules.
- [application.properties](cinepass-eureka-server/src/main/resources/application.properties): Eureka registry configuration.
- [application.properties](cinepass-api-gateway/src/main/resources/application.properties): Eureka load-balanced routes.

## 3. JWT Authentication

User login issues a JWT after BCrypt password verification. The gateway validates bearer tokens before forwarding protected requests and passes the authenticated user ID, name, and role as request headers.

Evidence:

- [UserService.java](cinepass-user-service/src/main/java/com/klu/cinepassuser/service/UserService.java): login and token issuance.
- [JWTService.java](cinepass-user-service/src/main/java/com/klu/cinepassuser/service/JWTService.java): token creation.
- [JwtAuthFilter.java](cinepass-api-gateway/src/main/java/com/klu/cinepassgateway/filter/JwtAuthFilter.java): bearer-token validation and identity forwarding.

## 4. API Gateway Configuration

The gateway exposes one public entry point on port 8080 and routes user, movie, show, and booking APIs through Eureka service IDs. Public signup, signin, read-only catalog requests, Swagger, and static frontend assets remain accessible without a token.

Evidence:

- [application.properties](cinepass-api-gateway/src/main/resources/application.properties): route and CORS configuration.
- [JwtAuthFilter.java](cinepass-api-gateway/src/main/java/com/klu/cinepassgateway/filter/JwtAuthFilter.java): authorization policy.
- [Application.java](cinepass-api-gateway/src/main/java/com/klu/cinepassgateway/Application.java): discovery-client activation.

## 5. LinkedIn Article with DTI Concepts and Review

### Publication Draft

**Title:** Designing CinePass: Reliable Microservices for High-Concurrency Cinema Booking

CinePass applies distributed technology and innovation (DTI) concepts to a real ticketing problem. Independent services isolate user identity, movie data, show inventory, and bookings so each capability can evolve and scale separately. Eureka provides service discovery, while the API Gateway provides a stable client-facing boundary and centralized JWT enforcement.

The key reliability decision is atomic seat allocation. The Show Service updates inventory only when enough seats remain. This prevents negative inventory and double booking when many users submit requests at the same time. The Booking Service remains stateless and delegates inventory ownership to the Show Service, preserving a clear data ownership boundary.

The design also supports horizontal scaling. Multiple Booking Service instances can register under the same Eureka service ID, and the gateway can distribute requests through Spring Cloud LoadBalancer. Separate PostgreSQL databases reduce coupling and limit failures to the affected business capability.

### Review Notes

- **Strength:** clear service boundaries and a focused concurrency-control strategy.
- **Strength:** JWT validation at the gateway provides a consistent security boundary.
- **Improvement:** production deployments should move credentials and JWT secrets to environment variables or a secret manager.
- **Improvement:** production deployments should add distributed tracing, health checks, retries with limits, and an externalized configuration service.
- **Conclusion:** the architecture demonstrates modularity, service discovery, secure routing, and a defensible solution to concurrent seat allocation.

The draft is ready to publish on LinkedIn with screenshots of the Eureka dashboard, gateway routes, Swagger APIs, and the concurrency test results attached.
