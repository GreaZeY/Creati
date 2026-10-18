# CLI support for Linux and Windows

Status: CLI portability and project-root discovery fixes are complete.

## Scope

- Run configured commands with the host shell and explicit working directories.
- Preserve worker-only mode through the child process environment.
- Stop child process trees when interrupted or when a sibling process fails.
- Build the backend from its own Go module and use native executable names.
- Support Docker Compose v2 and the standalone Compose command.
- Check ports using Go networking and honor configured project paths.
- Update CLI documentation and the project plan.

## Verification

- Passed CLI regression tests with the race detector on Linux: command directories, worker environment, module-aware builds, failure propagation, process cleanup, ports, and Compose selection.
- Passed CLI `go vet` on Linux.
- Built the Linux CLI at `tools/creati` and cross-compiled the Windows CLI and its test binary.
- Passed Linux binary smoke checks for help output, worker-only startup, SIGINT handling, nonzero service-failure exit codes, and self-update.
- Windows execution was not tested on a Windows host. Live application startup, database migrations, and queue mutations were not run.

The broader backend repair plan remains planned. Existing backend dependency edits are outside this task.

## Follow-up: account subscription initialization

- Confirmed the configured database uses legacy `subscriptions.plan_name`; signup expects `plan` and `billing_cycle`.
- Add a focused, repeatable migration preserving existing plan values and adding the subscription fields used by current handlers; align the initial schema.
- Verify legacy upgrades and fresh schema registration in isolated PostgreSQL schemas, including transaction rollback when subscription creation fails.
- Apply only this focused migration to the configured database, without rerunning unrelated migrations or changing existing accounts.

Verification: PostgreSQL integration tests with the race detector passed for fresh and legacy schemas, migration reapplication, preservation of a paid plan and Stripe ID, registration/login, and rollback on subscription failure. Applied only migration 14 atomically to the configured database and confirmed the required columns exist. The full backend race test suite passed. Browser signup and payment-provider operations were not exercised.

## Follow-up: backend storage compilation failure

- Only local and S3 adapters exist; Google Drive and Dropbox constructors are undefined.
- Return an explicit not-implemented error for those organization storage choices instead of referencing nonexistent adapters or routing uploads to another destination.
- Configure Air to stop on build failures and test provider resolution, then build the backend.

Verification: backend `go build ./cmd/app` passed. Provider resolution tests passed for Google Drive, Dropbox, the existing S3 selection behavior, and no custom configuration. An isolated Air fixture confirmed that failed compilation no longer launches a binary. Full application startup was not run.

The full backend test suite passed with the race detector (`go test -race ./...`).

## Follow-up: startup exits with status 127

- Confirmed the configured backend command `air` is missing; npm is available.
- Install Air in the user's existing PATH without changing project dependencies, and document setup.
- Verify Air runs and check backend compilation separately before claiming full startup works.

Verification: installed Air v1.67.4 at `~/.local/bin/air`; `air -v` passed. Backend build remains blocked by pre-existing undefined `storage.NewGoogleDriveProvider` and `storage.NewDropboxProvider` references in `backend/internal/services/storage.go`. Full application startup is not working yet; these backend repairs remain in the broader plan.

## Follow-up: Redis cache port conflict

- Move Creati's cache host port to the available port 6381, preserving the service already using 6379.
- Keep Compose, the backend cache fallback, and documented environment settings aligned. Queue Redis remains on 6380.
- Validate Compose configuration and check the port mapping; live Docker verification requires access to the user's Docker socket.

Verification: Compose configuration passed; `creati services up` succeeded using the user's existing Docker group membership. Both cache and queue containers returned `PONG`. Removed the obsolete Compose version field. Full application startup was not verified; `backend/.env` is still absent.

## Follow-up: commands from project subdirectories

- Resolve the nearest `creati.yaml` by searching the working directory and its parents.
- Load configuration and run commands from that project root so paths, Compose, and self-update behave consistently.
- Return configuration errors through Cobra instead of terminating from the loader.
- Cover root/nested directory discovery, nearest-config selection, and missing/invalid configuration.
- Rebuild the installed CLI target and smoke-test startup from a nested fixture and configuration loading from the real backend directory.

Verification: Linux race tests and vet passed; Windows cross-compilation passed. The installed `creati start` passed a nested-directory startup fixture. Running the installed `creati doctor` from the real `backend/` directory loaded the parent configuration successfully and passed 7/8 checks; `backend/.env` is missing.
