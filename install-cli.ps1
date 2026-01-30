# install-cli.ps1
# Run this script to install creati CLI
$installDir = "$env:USERPROFILE\bin"
if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir }

# Build binary
Write-Host "[*] Building creati CLI..." -ForegroundColor Yellow
go build -o "$installDir\creati.exe" .\cmd\creati\main.go
Write-Host "[OK] Built successfully." -ForegroundColor Green

# Add to PATH permanently (user scope)
$existingPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
if (-not ($existingPath -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ -eq $installDir })) {
    [Environment]::SetEnvironmentVariable("PATH", "$installDir;$existingPath", [EnvironmentVariableTarget]::User)
    Write-Host "[OK] Added $installDir to PATH. You may need to restart your terminal." -ForegroundColor Green
}
else {
    Write-Host "[OK] $installDir already in PATH." -ForegroundColor Green
}

Write-Host "[OK] Creati CLI installed successfully!" -ForegroundColor Green
