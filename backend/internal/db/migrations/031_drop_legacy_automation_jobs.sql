-- Migration 031: Drop legacy automation_jobs table
-- Superseded by V2 content normalization and automation_executions

DROP TABLE IF EXISTS automation_jobs CASCADE;
