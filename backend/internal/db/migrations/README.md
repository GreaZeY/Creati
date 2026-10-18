# Database Migrations

## Overview

This directory contains the database schema initialization file for the Creati application.

## Current Structure

- **`init_schema.sql`** - Consolidated initialization file that sets up the entire database from scratch
- **`archive/`** - Historical migration files (33 files) preserved for reference

## Schema Initialization

`16_youtube_live_preferences.sql` adds per-user/workspace YouTube Live defaults
with separate unique indexes for personal and workspace settings. It is additive
and repeatable. Fresh initialization includes this table as well.

`15_youtube_live.sql` adds scoped YouTube Live drafts and expiring OAuth state.
It is additive and repeatable; existing users, subscriptions, and content are not
modified. Fresh initialization also includes these tables in `00_init_schema.sql`.

Subscription compatibility: `14_subscription_schema.sql` upgrades the legacy
`plan_name` column to `plan`, preserving values, and adds `billing_cycle`,
`razorpay_subscription_id`, and `updated_at` for the current authentication and
billing handlers. It is safe to reapply. Fresh installs receive these fields
from `00_init_schema.sql`.

The registration integration test uses disposable schemas in PostgreSQL. Run it
with an explicitly configured test database (credentials stay in the environment):

```bash
CREATI_TEST_DATABASE_URL="$DATABASE_URL" go test ./internal/api -run TestRegistrationSubscriptionSchema
```

Run from `backend/`; the selected database user must be able to create schemas.

To initialize a fresh database:

```bash
psql -U postgres -d creati -f init_schema.sql
```

## Migration History

The `archive/` directory contains all 33 historical migration files that were used during development. These files have been consolidated into `init_schema.sql` for cleaner deployments.

**Archive Contents:**

- `001_init.sql` through `033_add_updated_at_to_executions.sql`

## Schema Overview

The consolidated schema includes:

### Core Tables

- `users` - User accounts with AI credits
- `creator_preferences` - User content preferences

### Agency & Organization

- `organizations` - Agency/team organizations
- `clients` - Workspaces within organizations
- `team_members` - User roles and permissions

### Platform Integration

- `platform_accounts` - Connected social media accounts (YouTube, Discord, etc.)
- `videos` - Legacy video storage
- `video_analytics` - Platform-specific analytics
- `video_platform_jobs` - Legacy upload job tracking

### V2 Content System (Cycle-Proof)

- `contents` - Canonical content identity (single source of truth)
- `platform_contents` - Platform-specific content references
- `automation_executions` - Distribution tracking with duplicate prevention
- `automation_rules` - Cross-platform automation rules
- `automation_logs` - Activity history

### Events & Webhooks

- `platform_events` - Real-time event stream
- `webhook_subscriptions` - Platform webhook registrations
- `polling_state` - Polling cursor state for non-webhook platforms

### Payments

- `subscriptions` - Stripe subscriptions
- `payments` - Payment records

### AI Features

- `ai_credit_logs` - AI credit usage tracking

## Key Features

### Cycle Prevention

The V2 content system uses `UNIQUE` constraints to prevent infinite distribution loops:

- `platform_contents(content_id, platform)` - Content can only appear once per platform
- `automation_executions(content_id, target_platform)` - Execution can only target each platform once

### Real-time Updates

PostgreSQL triggers and `pg_notify` enable real-time status updates via Server-Sent Events (SSE).

### Scalability

- Comprehensive indexing for all query paths
- JSONB columns for flexible metadata storage
- UUID-based primary keys for distributed systems

## Notes

- All tokens are encrypted in `platform_accounts`
- The schema uses PostgreSQL-specific features (UUID, JSONB, Triggers)
- Migration history is preserved in `archive/` for auditing purposes
