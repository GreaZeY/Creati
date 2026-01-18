# Backend Setup Script
# Run this to set up the development environment

Write-Host "Setting up Multi-Platform Creator Backend..." -ForegroundColor Cyan

# Copy environment file
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env - Please update with your credentials" -ForegroundColor Green
} else {
    Write-Host "✓ .env already exists" -ForegroundColor Green
}

# Check if Go is installed
if (!(Get-Command "go" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Go is not installed. Please install Go 1.21+ from https://golang.org/dl/" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Go is installed: $(go version)" -ForegroundColor Green

# Download dependencies
Write-Host "`nDownloading Go dependencies..." -ForegroundColor Yellow
go mod tidy
go mod download

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies downloaded successfully" -ForegroundColor Green
} else {
    Write-Host " ❌ Failed to download dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Backend Setup Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "`nNext steps:"
Write-Host "1. Update .env with your credentials"
Write-Host "2. Setup PostgreSQL and run migrations:"
Write-Host "   psql -U your_user -d creati -f internal/db/migrations/001_init.sql"
Write-Host "3. Setup Redis (docker run -d -p 6379:6379 redis)"
Write-Host "4. Run server:"
Write-Host "   go run cmd/server/main.go"
Write-Host ""
