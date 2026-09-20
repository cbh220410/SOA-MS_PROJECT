# CinePass Microservices PowerShell Launcher
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "               CinePass Microservices Startup Launcher" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "Databases: PostgreSQL (localhost:5432)" -ForegroundColor Yellow
Write-Host ""

$rootPath = $PSScriptRoot

Write-Host "[1/6] Starting Eureka Service Discovery (Port 8761)..." -ForegroundColor Green
Start-Process java -ArgumentList "-jar `"$rootPath\cinepass-eureka-server\target\cinepass-eureka-server-1.0.0.jar`"" -WindowStyle Normal
Start-Sleep -Seconds 8

Write-Host "[2/6] Starting User Service (Port 8081)..." -ForegroundColor Green
Start-Process java -ArgumentList "-jar `"$rootPath\cinepass-user-service\target\cinepass-user-service-1.0.0.jar`"" -WindowStyle Normal

Write-Host "[3/6] Starting Movie Service (Port 8082)..." -ForegroundColor Green
Start-Process java -ArgumentList "-jar `"$rootPath\cinepass-movie-service\target\cinepass-movie-service-1.0.0.jar`"" -WindowStyle Normal

Write-Host "[4/6] Starting Show Service (Port 8083)..." -ForegroundColor Green
Start-Process java -ArgumentList "-jar `"$rootPath\cinepass-show-service\target\cinepass-show-service-1.0.0.jar`"" -WindowStyle Normal

Write-Host "[5/6] Starting Booking Service (Port 8084)..." -ForegroundColor Green
Start-Process java -ArgumentList "-jar `"$rootPath\cinepass-booking-service\target\cinepass-booking-service-1.0.0.jar`"" -WindowStyle Normal

Write-Host "Waiting 12 seconds for microservices to register with Eureka..." -ForegroundColor Gray
Start-Sleep -Seconds 12

Write-Host "[6/6] Starting API Gateway & Web Portal (Port 8080)..." -ForegroundColor Green
Start-Process java -ArgumentList "-jar `"$rootPath\cinepass-api-gateway\target\cinepass-api-gateway-1.0.0.jar`"" -WindowStyle Normal

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "All 6 CinePass services are running!" -ForegroundColor Green
Write-Host "Web Frontend Portal: http://localhost:8080" -ForegroundColor Yellow
Write-Host "Eureka Registry:     http://localhost:8761" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan

Start-Process "http://localhost:8080"
