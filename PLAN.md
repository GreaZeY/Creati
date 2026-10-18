# Creati repair plan

Status: CLI portability work is implemented. The broader repair phases below remain planned.

This plan covers the issues identified during the project review. Work proceeds in dependency order, with a working checkpoint after each phase.

## Working approach

- Use the newer content/execution pipeline for publishing.
- Preserve existing records through explicit mappings and migration backfills.
- Keep local storage and S3 as the initially supported storage options.
- Support the CLI on Linux and Windows, using the host shell and native executable names.
- Deliver each phase as a separate, reviewable change with its relevant tests.
- Document upgrade and recovery procedures for database changes.

## 1. Restore the build baseline

Resolve the missing storage-provider references, returning clear errors for unavailable providers. Fix the CLI's `go vet` failure and orchestration defects affecting Linux and Windows.

**Acceptance:** API and worker build; CLI builds and command smoke checks pass on Linux and Windows; existing backend tests pass; frontend production build stays green.

## 2. Reconcile the database and application contracts

Inventory every schema/query mismatch across subscriptions, storage, events, analytics, notifications, and executions. Define consistent content IDs, account IDs, storage keys, and ownership fields. Add version tracking and locking to migrations.

Before changing an existing database, inspect its actual schema and data. Use migrations and backfills that preserve records.

**Acceptance:** A fresh database initializes successfully, existing-data upgrade fixtures pass, and rerunning migrations applies nothing twice.

## 3. Enforce authentication and tenant isolation

Propagate workspace context consistently from the frontend. Verify organization membership and roles for every resource referenced through paths, queries, or request bodies. Treat domain branding separately from authorization.

Replace editable OAuth state with expiring, single-use state tied to the initiating session or intake token. Harden session cookies, token validation, and authentication rate limits. Restrict proxy and website-fetch destinations, including redirects.

**Acceptance:** Tests with two unrelated agencies prove that neither can access the other's accounts, comments, settings, approvals, invoices, or automation targets. Forged/replayed OAuth state and internal-network URLs are rejected.

## 4. Make uploads and storage work consistently

Implement the local upload path using a real writable endpoint. Align local/S3 upload responses, object keys, and streaming behavior. Validate media type, actual size, ownership, object existence, and quota accounting.

Ensure guest uploads use the correct organization/provider. Restrict storage settings to authorized roles and protect stored credentials.

**Acceptance:** Upload, preview, confirmation, and asset-drop flows work locally and against an S3 test bucket; invalid or unauthorized confirmations fail safely.

## 5. Repair publishing and automation creation

Correct SQL bindings, manual execution ownership, and queue payload types. Create content and execution records consistently within transactions. Separate storage keys from public URLs.

Make delivery uniqueness account-specific so one item can reach multiple accounts on the same platform. Connect webhook processing, filters, templates, scheduling, status reporting, and analytics to the same execution records.

**Acceptance:** Immediate posts, uploads, scheduled posts, archive blasts, and webhook-triggered automations reach the intended accounts using controlled platform adapters.

## 6. Make background jobs recoverable

Persist dispatch intent alongside database changes, then enqueue with retries after commit. Add acknowledgement and recovery for interrupted jobs. Define valid transitions for queued, scheduled, running, paused, cancelled, failed, and completed work.

Workers must claim eligible executions atomically and honor cancellation. Add bounded timeouts/concurrency so a stalled platform cannot block the entire upload pipeline. Reconcile ambiguous publishing outcomes before retrying.

**Acceptance:** Worker restarts, duplicate messages, Redis outages, and concurrent workers do not silently lose work. Cancelled jobs remain unpublished.

## 7. Repair drafts, approvals, and client portals

Create drafts without queuing distribution. Return explicit content identifiers instead of converting execution UUIDs into video IDs. Bind approval links to the correct content and enforce expiry, prior use, ownership, and decision transitions.

Fix public portal URLs and intake-token handling. Connect approval to the permitted publishing/scheduling transition.

**Acceptance:** Draft content remains unpublished before approval; rejection prevents dispatch; expired or reused links cannot change decisions.

## 8. Secure billing and align entitlements

Resolve subscription ownership, plan, billing cycle, and period from server-held records and verified Razorpay data. Make verification and webhook handling safe to repeat.

Align frontend/backend entitlements, cancellation-at-period-end behavior, feature-cache invalidation, and usage-limit enforcement. Verify client ownership before invoice creation.

**Acceptance:** Changing request fields cannot upgrade access; replaying payment notifications cannot extend access or duplicate payments; cancellation preserves access only until the verified period ends.

## 9. Align the video editor with rendered output

Define one validated processing-settings format across frontend, API, and worker. Preserve supported settings when reopening an edit. Connect the processing path to those settings and disable controls whose effects are not implemented.

Replace no-op checks with small media fixtures that verify trimming, duration, overlays, and any supported audio/segment operations.

**Acceptance:** Rendered output matches saved settings, and unsupported edits cannot be presented as successfully exported.

## 10. Complete verification, documentation, and feature cleanup

Add regression tests throughout the earlier phases, then enforce backend tests, frontend build, lint, and database migration checks in CI. Run CLI tests, builds, and command smoke checks in Linux and Windows CI jobs. Resolve the existing lint failures.

Update setup/deployment instructions, environment examples, CLI commands, and FFmpeg requirements. Make placeholder AI, email, and evergreen behavior explicit in the product.

**Acceptance:** Documented setup works from a clean checkout, required checks pass, and complete personal-workspace and agency-workspace flows pass smoke tests.

## Deferred work and remaining uncertainties

Deferred: macOS CLI support, new Drive/Dropbox integrations, a full AI agent, real email delivery, and cosmetic redesign.

Existing database contents and live provider behavior remain the main uncertainties to verify during implementation.
