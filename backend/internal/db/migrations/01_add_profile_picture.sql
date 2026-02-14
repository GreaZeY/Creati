-- Add profile_picture column to platform_accounts
-- Migration: 2026-02-14

ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_picture TEXT;
