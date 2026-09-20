@echo off
title CinePass Microservices Orchestrator
echo =========================================================================
echo               CinePass Microservices Startup Launcher
echo =========================================================================
echo.
echo Database: PostgreSQL (localhost:5432)
echo Password: cbh220410
echo.
echo Launching pre-compiled JARs in designated order...
echo.

echo [1/6] Starting Eureka Service Discovery (:8761)...
start "CinePass [1/6] - Eureka Server (:8761)" java -jar "%~dp0cinepass-eureka-server\target\cinepass-eureka-server-1.0.0.jar"
timeout /t 8 /nobreak >nul

echo [2/6] Starting User Service (:8081)...
start "CinePass [2/6] - User Service (:8081)" java -jar "%~dp0cinepass-user-service\target\cinepass-user-service-1.0.0.jar"

echo [3/6] Starting Movie Service (:8082)...
start "CinePass [3/6] - Movie Service (:8082)" java -jar "%~dp0cinepass-movie-service\target\cinepass-movie-service-1.0.0.jar"

echo [4/6] Starting Show Service (:8083)...
start "CinePass [4/6] - Show Service (:8083)" java -jar "%~dp0cinepass-show-service\target\cinepass-show-service-1.0.0.jar"

echo [5/6] Starting Booking Service (:8084)...
start "CinePass [5/6] - Booking Service (:8084)" java -jar "%~dp0cinepass-booking-service\target\cinepass-booking-service-1.0.0.jar"

echo Waiting 12 seconds for microservices to register with Eureka...
timeout /t 12 /nobreak >nul

echo [6/6] Starting API Gateway & Web Portal (:8080)...
start "CinePass [6/6] - API Gateway (:8080)" java -jar "%~dp0cinepass-api-gateway\target\cinepass-api-gateway-1.0.0.jar"

timeout /t 4 /nobreak >nul

echo.
echo =========================================================================
echo All 6 CinePass microservices are running!
echo.
echo  - Web Frontend Portal: http://localhost:8080
echo  - Eureka Dashboard:   http://localhost:8761
echo =========================================================================
echo.
echo Opening CinePass portal in your default browser...
start http://localhost:8080
pause
