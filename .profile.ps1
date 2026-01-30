# Creati Project Profile
# Adds CLI to PATH when terminal opens in project directory

if (Test-Path "$PSScriptRoot\tools\creati.exe") {
    $env:PATH = "$PSScriptRoot\tools;$env:PATH"
    Write-Host "✅ Creati CLI loaded (type 'creati -h' to start)" -ForegroundColor Green
}
