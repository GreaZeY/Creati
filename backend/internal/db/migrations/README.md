# Database Migrations

## Overview

This directory contains the database schema initialization file for the Creati application.

## Current Structure

- **`init_schema.sql`** - Consolidated initialization file that sets up the entire database from scratch
- **`archive/`** - Historical migration files (33 files) preserved for reference

## Schema Initialization

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
