# Creati CLI Tool

A repo-local development tool for managing the Creati project workflow.

## Installation

The CLI is already built! The binary is located at `tools/creati.exe`.

## Usage

### Start Development Servers

```bash
.\tools\creati.exe start
```

This will start both frontend and backend based on the mode in `creati.yaml`.

#### Options:
- `--worker-only` / `-w`: Start only the backend worker process.

### Queue Management (Redis)

```bash
# Show items in upload_queue
.\tools\creati.exe queue info

# Clear the upload_queue
.\tools\creati.exe queue clear
```

### Database Migrations

```bash
.\tools\creati.exe migrate
```

### Self-Update

```bash
# Rebuild the CLI from source
.\tools\creati.exe self-update
```

### Check Environment Health

```bash
.\tools\creati.exe doctor
```

Checks:
- ✓ Go, Node.js, npm installed
- ✓ Dependencies present
- ✓ Ports available (5173, 8080)
- ✓ .env files exist

### Build for Production

```bash
.\tools\creati.exe build
```

Builds both frontend and backend to:
- `frontend/dist/`
- `bin/creati-server.exe`

### Clear Logs

```bash
.\tools\creati.exe logs clear
```

Removes all `.log` files from `backend/logs/`

### Smart Development Start

```bash
.\tools\creati.exe dev
```

Ensures dependencies are installed before starting services.

## Configuration

Edit `creati.yaml` to customize:

```yaml
mode: dev  # or "prod"

dev:
  frontend_command: npm run dev
  backend_command: air
  frontend_port: 5173
  backend_port: 8080

prod:
  frontend_command: npm run build
  backend_command: go run ./cmd/app
```

## Updating the CLI

After making changes to the CLI code:

```bash
go build -o tools\creati.exe .\cmd\creati
```

## Optional: Add to PATH

For easier access, add to your PATH (in PowerShell):

```powershell
$env:PATH += ";$PWD\tools"
```

Then you can run:

```bash
creati start
creati doctor
creati build
```

## Features

✅ **Colored logs** - Distinguishes [backend] and [frontend] output  
✅ **Graceful shutdown** - Ctrl+C stops both services cleanly  
✅ **Mode-aware** - Dev/prod configuration via YAML  
✅ **Health checks** - Validates environment before running  
✅ **Project validation** - Only runs from project root
