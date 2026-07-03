-- ============================================================
-- Migration: Add Token Tracking to Messages Table
-- ============================================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER DEFAULT 0;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS completion_tokens INTEGER DEFAULT 0;
