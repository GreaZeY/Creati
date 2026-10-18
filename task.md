# CLI support for Linux and Windows

## YouTube Live producer implementation

### Database preferences and stream reuse

- Persist per-user/workspace channel, category, language, visibility, audience, and time zone in PostgreSQL; autofill new streams across browsers and remember edits automatically.
- Reuse both Creati broadcasts and existing broadcasts from the connected YouTube channel. Copy editable metadata, relevant settings, and available thumbnails into a new draft; clear schedule, approval, and broadcast/stream IDs.
- Preserve original broadcasts and source research dates; copied material must not be presented as newly researched. Use existing repository/API layers and shared UI controls.
- Add an additive migration, validate ownership and settings, test persistence/isolation/reuse, and verify the frontend and mocked browser flows. Apply only the new migration after validation.

Completed: PostgreSQL stores workspace-scoped defaults and the UI autosaves preference edits, reports save failures, and retries. New briefs retain saved settings and clear their schedule. Reuse supports Creati broadcasts and paginated YouTube history, imports editable details and available thumbnails, and creates an independent draft. Source events and research dates remain intact.

Verification: backend race tests, build, and targeted vet passed; isolated PostgreSQL repository/HTTP tests passed for preferences, upserts, user/workspace isolation, reuse ownership, original-event preservation, and independent draft IDs. Frontend production build and focused lint passed. Mocked browser checks covered autofill after clearing browser storage, autosave/retry, both reuse sources, history pagination, thumbnail preview, a fresh schedule, approval with edited details, and mobile layout. Applied only migration 16 atomically to the configured database. Real YouTube account/history and thumbnail-server calls were not executed.

### YouTube connection status follow-up

- Use the existing workspace-scoped platform query to show the connected channel instead of an unconditional Connect button.
- Distinguish loading, failed checks, disconnected accounts, and accounts requiring reconnection; retain connection management through the Platforms page.
- Refresh cached platform accounts and counts after a successful OAuth exchange. Verify the production build, focused lint, and browser assertions for connection states.

Completed: connected channels show their name and a Manage channels link; only disconnected accounts show Connect, and the selected account's `action_required` status shows Reconnect. Loading and failed checks do not prompt a new connection. Successful OAuth exchanges invalidate cached accounts and counts.

Verification: production build and YouTube Live page lint passed. Mocked browser assertions passed for loading, connected, disconnected, reconnect-required, multiple-channel selection, and failed-check retry states. Combined lint still reports the pre-existing `react-hooks/set-state-in-effect` error in `PlatformCallback.tsx`, confirmed against its staged baseline. Real OAuth exchange was not performed.

### UI consistency follow-up

- Replace the oversized promotional header with the existing `PageHeader`.
- Reuse shared cards, buttons, inputs, textareas, labels, dropdowns, and sliders across the producer and optional thumbnail composer.
- Use the app's theme tokens and standard page spacing; remove duplicated page-specific control styles and decorative copy.
- Replace the tags textarea with removable chips: add with Enter/comma, paste multiple tags, prevent duplicates, and enforce the existing 20-tag/400-character limits.
- Preserve generation, draft persistence, thumbnail export, review, and approval behavior. Verify build, focused lint, and the rendered page at desktop/mobile sizes.

Completed: the producer uses the existing compact `PageHeader`, `LensedCard`, form controls, dropdowns, sliders, switches, and chips. Removed the duplicate page stylesheet and separated the package editor from the page. Tags support Enter/comma, pasted lists, removal with the mouse or keyboard, duplicate prevention, limits, and committing pending input before saving.

Verification: frontend production build and focused ESLint passed. Browser assertions covered tag editing, rejection without data loss, persistence, thumbnail adjustments/upload, and submitting edited tags through broadcast approval using mocked APIs. Desktop, light/dark themes, and 320–390px mobile layouts were checked. Real AI and YouTube calls were not made.

Approved scope: implement `YOUTUBE_LIVE_PLAN.md` within the existing Go/Fiber and React application.

User clarification: the primary experience is a short stream idea → mandatory real research → AI-prepared title, actual thumbnail image, description, and tags → minor edits → approval creates the broadcast for OBS. Move manual composition and detailed settings behind optional controls. Remember explicit channel/privacy/audience preferences, and never market an unresearched fallback as researched. Add an independently configured image-capable route; text-only Anthropic routing is insufficient for image output.

- [x] Draft contracts, scoped PostgreSQL persistence, and migration.
- [x] Anthropic-compatible package generation, required cited research, and manual prompt export.
- [x] Producer UI, editable package, actual AI thumbnail generation, and optional local composition.
- [x] Session-bound Live OAuth and channel authorization.
- [x] Reviewed, resumable event creation and thumbnail upload, with auto-start disabled.
- [x] Backend/provider/database tests, frontend build/lint, browser verification, and setup documentation.

Verification: full backend race tests passed; PostgreSQL integration tests passed in disposable schemas for workspace/draft isolation, roles, one-time session-bound OAuth state, stale edit conflicts, idempotent creation, and the complete researched-package/image/approval flow. The additive migration was applied to the configured database. Frontend build and focused lint passed. Browser checks covered the simplified automatic workflow, minor edits, generated image display, approval, exports, research failure, light/dark themes, and desktop/narrow layouts. The running backend requires authentication for the feature endpoint.

Remaining setup: provider variables are present in `backend/.env`; the user will supply text/research and image route settings and keys. Real model/search/image calls and creator-approved YouTube/OBS execution were not performed.

Design: the existing app components, theme colors, compact page header, and spacing, with an editable brief on the left and the broadcast package/preview on the right. Generation and scheduling use explicit request states; the initial feature uses no background workers. Model usage is billed by the configured server route; this feature does not deduct Creati credits until a pricing policy exists.

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
