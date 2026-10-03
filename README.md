# High-Concurrency Entertainment Ticketing & Seat Allocation Engine – CinePass

---

## 1. Rubric 1: Problem Analysis  

### Problem:
During blockbuster movie releases, cinema ticketing systems experience extreme spikes in user traffic where hundreds of users attempt to book the exact same remaining seats simultaneously for a popular showtime.

### Risk:
In traditional naive implementations, two or more concurrent requests read the same `available_seats` count before either writes back. This causes a **race condition** leading to **double booking**, phantom seat allocations, and seat inventory becoming negative (`available_seats < 0`).

### Technical Solution in CinePass:
1. **Atomic Conditional SQL Update**:
   ```sql
   UPDATE shows 
   SET available_seats = available_seats - :seats 
   WHERE show_id = :showId AND available_seats >= :seats;
   ```
2. **Transactional Concurrency Protection**:
   - The database row lock is held only during the atomic update.
   - If `rowsUpdated == 1`, the booking is confirmed (`CONFIRMED`).
   - If `rowsUpdated == 0`, the transaction rejects the request and returns `HTTP 409 CONFLICT` (`{"code": 409, "message": "Insufficient seats available"}`).
   - The available seat count is mathematically guaranteed to never drop below 0.
3. **Independent Microservices & Centralized Routing**:
   - Isolated services for User, Movie, Show, Booking, API Gateway, and Eureka Registry.
   - Independent PostgreSQL databases prevent database-level coupling.

---

## 2. Rubric 2: Requirement Specification  

### 2.1 Functional Requirements
1. **User Registration**: `POST /api/users/signup` (username, email, password with BCrypt hashing).
2. **User Login & JWT Generation**: `POST /api/users/signin` (generates 24-hour JJWT token).
3. **User Profile Retrieval**: `GET /api/users/{id}` and `GET /api/users`.
4. **Movie Creation**: `POST /api/movies` (title, genre, duration).
5. **Movie Viewing**: `GET /api/movies` and `GET /api/movies/{id}`.
6. **Movie Update**: `PUT /api/movies/{id}`.
7. **Movie Deletion**: `DELETE /api/movies/{id}`.
8. **Show Scheduling**: `POST /api/shows` (movieId, showTime, availableSeats).
9. **Show Viewing**: `GET /api/shows`, `GET /api/shows/{id}`, and `GET /api/shows/movie/{movieId}`.
10. **Show Update**: `PUT /api/shows/{id}`.
11. **Show Deletion**: `DELETE /api/shows/{id}`.
12. **Ticket Booking**: `POST /api/bookings` (userId, showId, seatsBooked).
13. **Seat Validation & Concurrency Control**: Rejects overbooking with HTTP 409.
14. **Booking Retrieval**: `GET /api/bookings/{id}`, `GET /api/bookings/user/{userId}`, `GET /api/bookings/show/{showId}`.
15. **Booking Cancellation**: `DELETE /api/bookings/{id}` (atomically refunds seats back to inventory).

### 2.2 Non-Functional & Security Requirements
- **Concurrency Safety**: Atomic queries prevent double-booking.
- **Scalability**: Stateless microservices discoverable through Eureka and load-balanced by Spring Cloud Gateway.
- **Security**: BCrypt password hashing + stateless JWT token verification (`Authorization: Bearer <JWT>`).
- **Reliability & Fault Isolation**: Database per service ensures movie catalog stays available even during booking traffic contention.

---

## 3. Rubric 3: Microservice Identification  

| Microservice | Port | Package | Database | Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Eureka Server** | `8761` | `com.klu.cinepasseureka` | N/A | Central service registry and discovery |
| **API Gateway** | `8080` | `com.klu.cinepassgateway` | N/A | Single entry point, JWT validation filter, and load-balanced routing |
| **User Service** | `8081` | `com.klu.cinepassuser` | `cinepass_user_db` | User signup, signin, BCrypt encryption, and JWT issuance |
| **Movie Service** | `8082` | `com.klu.cinepassmovie` | `cinepass_movie_db` | Movie catalog management (CRUD) |
| **Show Service** | `8083` | `com.klu.cinepassshow` | `cinepass_show_db` | Show scheduling and atomic seat inventory allocation |
| **Booking Service** | `8084` | `com.klu.cinepassbooking` | `cinepass_booking_db` | High-concurrency ticket booking, status tracking, and cancellation |

---

## 4. Rubric 4: System Architecture Design  

```
                    CLIENT
           (Swagger UI / Web Portal)
                       |
                       v
                API GATEWAY
                   :8080
                       |
                       v
                EUREKA SERVER
                   :8761
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
 USER SERVICE     MOVIE SERVICE    SHOW SERVICE
    :8081             :8082           :8083
       |               |               |
       v               v               v
   User DB          Movie DB        Show DB
                       |
                       | (LoadBalanced REST)
                       v
                BOOKING SERVICE
                    :8084
                       |
                       v
                  Booking DB
```

### Horizontal Scalability:
Multiple instances of **Booking Service** (e.g., on ports `8084`, `8085`, `8086`) can register with Eureka under the application name `CINEPASS-BOOKING-SERVICE`. The API Gateway automatically load-balances requests across all live instances using `lb://CINEPASS-BOOKING-SERVICE`.

---

## 5. Rubric 5: API Design & Swagger OpenAPI  

### Swagger UI Links:
- **API Gateway Portal**: [http://localhost:8080/](http://localhost:8080/)
- **User Service Swagger**: [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html)
- **Movie Service Swagger**: [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html)
- **Show Service Swagger**: [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html)
- **Booking Service Swagger**: [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html)

### REST Endpoints Summary:
- **User Service**:
  - `POST /api/users/signup` -> Register User
  - `POST /api/users/signin` -> Login & Get JWT Token
  - `GET /api/users/{id}` -> Get User details
  - `GET /api/users` -> Get all users
- **Movie Service**:
  - `POST /api/movies` -> Add Movie
  - `GET /api/movies` -> List Movies
  - `GET /api/movies/{id}` -> Get Movie by ID
  - `PUT /api/movies/{id}` -> Update Movie
  - `DELETE /api/movies/{id}` -> Delete Movie
- **Show Service**:
  - `POST /api/shows` -> Schedule Show
  - `GET /api/shows` -> List Shows
  - `GET /api/shows/{id}` -> Get Show by ID
  - `GET /api/shows/movie/{movieId}` -> Shows for Movie
  - `POST /api/shows/{id}/book?seats={seats}` -> Atomic seat reservation
  - `POST /api/shows/{id}/cancel?seats={seats}` -> Atomic seat release
- **Booking Service**:
  - `POST /api/bookings` -> Book seats
  - `GET /api/bookings/{id}` -> Get Booking status
  - `GET /api/bookings/user/{userId}` -> User's bookings
  - `GET /api/bookings/show/{showId}` -> Show's bookings
  - `DELETE /api/bookings/{id}` -> Cancel booking and release seats

---

## 6. How to Run in Spring Tool Suite (STS)

### 1. Database Configuration (PostgreSQL):
- Host: `localhost:5432`
- User: `postgres`
- Password: `cbh220410`
- Databases: `cinepass_user_db`, `cinepass_movie_db`, `cinepass_show_db`, `cinepass_booking_db` (already created via `schema-init-postgres.sql`).

### 2. Import into Spring Tool Suite (STS):
1. Open **STS**.
2. Go to **File -> Import... -> Maven -> Existing Maven Projects**.
3. Select `soaproject` folder as root and click **Finish**.

### 3. Launch Services in Sequence:
Run each Application class as **Spring Boot App**:
1. `MsEurekaServerApplication.java` (`cinepass-eureka-server` on `:8761`)
2. `Application.java` (`cinepass-user-service` on `:8081`)
3. `Application.java` (`cinepass-movie-service` on `:8082`)
4. `Application.java` (`cinepass-show-service` on `:8083`)
5. `Application.java` (`cinepass-booking-service` on `:8084`)
6. `Application.java` (`cinepass-api-gateway` on `:8080`)

*(Or simply double-click `run-all-services.bat` to launch all pre-packaged JARs with 1 click).*

---

## 7. 10-Minute Demonstration Scenario

1. Open **Eureka Dashboard**: [http://localhost:8761](http://localhost:8761) -> Verify all services are registered and `UP`.
2. Open **User Service Swagger**: [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html)
   - `POST /api/users/signup` -> Register `revanth` / `123456`
   - `POST /api/users/signin` -> Sign in and copy the generated JWT token
3. Open **Movie Service Swagger**: [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html)
   - `POST /api/movies` -> Create `Avengers: Secret Wars` (180 mins)
   - `GET /api/movies` -> Retrieve the created movie
4. Open **Show Service Swagger**: [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html)
   - `POST /api/shows` -> Schedule a show for Movie ID 1 with 10 available seats
5. Open **Booking Service Swagger**: [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html)
   - `POST /api/bookings` -> Book 2 seats -> Response: `201 Created` (`bookingStatus = "CONFIRMED"`)
   - `GET /api/bookings/1` -> Check confirmed booking
   - `POST /api/bookings` -> Try booking 15 seats (exceeding available 8) -> Response: **`409 CONFLICT`** (`"Insufficient seats available"`)
6. Open **CinePass Web Portal & Concurrency Simulator**: [http://localhost:8080/](http://localhost:8080/)
   - Go to **⚡ Concurrency Simulator** tab.
   - Run simultaneous rush (15 users x 2 seats against 10 seats).
   - See live proof of atomic seat reservation with **zero double-booking**!

---

