# Creati CLI Tool

A repo-local development tool for managing Creati on Linux and Windows. Run commands from the project root or any subdirectory, including `backend/` and `frontend/`. The CLI finds the nearest `creati.yaml` in the current directory or its parents and runs commands from that project root.

## Installation

Install Go matching the root `go.mod` requirement, Node.js/npm, and Docker with either the Compose plugin (`docker compose`) or standalone `docker-compose`. Development mode also uses Air for backend reloads; install it or change `dev.backend_command` in `creati.yaml`.

Install Air before running `creati start` in development mode:

```sh
go install github.com/air-verse/air@latest
```

Ensure your Go bin directory (`go env GOPATH` plus `/bin`, or `GOBIN` if set) is on your PATH, then check `air -v`. A missing startup command causes exit status 127 on Linux.

### Linux

```bash
mkdir -p tools
go build -o tools/creati ./cmd/creati
./tools/creati doctor
```

Optionally add the project tools directory to your current shell's PATH:

```bash
export PATH="$PWD/tools:$PATH"
```

### Windows (PowerShell)

```powershell
New-Item -ItemType Directory -Force tools | Out-Null
go build -o tools\creati.exe ./cmd/creati
.\tools\creati.exe doctor
```

Optionally add the project tools directory to your current shell's PATH:

```powershell
$env:PATH += ";$PWD\tools"
```

The examples below use `creati` from PATH. Without that PATH entry, use `./tools/creati` on Linux or `.\tools\creati.exe` on Windows.

## Usage

### Start Development Servers

```text
creati start
```

This starts the configured frontend and backend commands. In development mode, the CLI starts the Docker Compose sidecars and stops them when the session ends. Ctrl+C stops child process trees. A service failure stops the other service and returns a nonzero exit code.

#### Options:
- `--worker-only` / `-w`: Start only the backend worker process.

### Queue Management (Redis)

```text
# Show pipeline and dead-letter queue lengths
creati queue info

# Clear those queues
creati queue clear
```

The Redis connection comes from `REDIS_QUEUE_URL` in the configured backend's `.env`, defaulting to `localhost:6380`.

### Infrastructure Services

```text
creati services up
creati services down
```

Uses `docker compose` when available, with a fallback to `docker-compose`. `creati queue up` and `creati queue down` manage the same Compose stack.

### Database Migrations

```text
creati migrate
```

Runs `cmd/migrate/main.go` from the configured backend directory.

### Self-Update

```text
# Rebuild the CLI from source
creati self-update
```

Rebuilds the repo-local CLI at `tools/creati` on Linux or `tools/creati.exe` on Windows. Other installed copies are not replaced.

### Check Environment Health

```text
creati doctor
```

Checks:
- ✓ Go, Node.js, npm installed
- ✓ Dependencies present
- ✓ Ports available (5173, 8080)
- ✓ .env files exist

Directory checks use the configured project paths. Port availability is checked with a TCP bind on both supported operating systems.

### Build for Production

```text
creati build
```

Runs the configured production frontend command, then builds the backend from its own Go module. Default outputs are:

- Frontend: `frontend/dist/`.
- Linux backend: `bin/creati-server`.
- Windows backend: `bin/creati-server.exe`.

### Clear Logs

```text
creati logs clear
creati logs clear --force
```

Removes `.log` files from the configured backend's `logs` directory. `--force` attempts to truncate files that cannot be removed.

### Smart Development Start

```text
creati dev
```

Downloads backend dependencies, installs missing frontend dependencies, and starts the configured services.

## Configuration

Edit `creati.yaml` to customize:

```yaml
mode: dev  # or "prod"
frontend_path: frontend
backend_path: backend

dev:
  frontend_command: npm run dev
  backend_command: air
  frontend_port: 5173
  backend_port: 8080

prod:
  frontend_command: npm run build
  backend_command: go run ./cmd/app
  frontend_dist: frontend/dist
  backend_bin: bin/creati-server
```

Commands run through `sh -c` on Linux and `cmd /C` on Windows, using the configured directory as the working directory. Paths containing spaces are supported. Custom command strings must use syntax supported by the host shell.

In production mode, `start` runs the configured production commands. The default frontend command builds static files and exits; serve `frontend/dist` through your web server or static host.

## Features

✅ **Colored logs** - Distinguishes [backend] and [frontend] output  
✅ **Graceful shutdown** - Ctrl+C stops both services cleanly  
✅ **Mode-aware** - Dev/prod configuration via YAML  
✅ **Health checks** - Validates environment before running  
✅ **Project discovery** - Finds the project root from nested directories
