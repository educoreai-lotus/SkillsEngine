-- ============================================================================
-- MIGRATION: Add root_career_path_competency_id to user_career_path table
-- ============================================================================
-- Description: Adds the root_career_path_competency_id column to link
--              core-competencies to their root career path for efficient queries
-- ============================================================================

-- Add the new column
ALTER TABLE public.user_career_path
ADD COLUMN IF NOT EXISTS root_career_path_competency_id UUID NULL;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'user_career_path_root_fkey'
    ) THEN
        ALTER TABLE public.user_career_path
        ADD CONSTRAINT user_career_path_root_fkey 
            FOREIGN KEY (root_career_path_competency_id) 
            REFERENCES competencies (competency_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_career_path_root 
    ON public.user_career_path (root_career_path_competency_id);

-- Add hash index on user_id for fast equality lookups
CREATE INDEX IF NOT EXISTS idx_user_career_path_user_hash 
    ON public.user_career_path USING HASH (user_id);

-- Add hash index on root_career_path_competency_id for fast equality lookups (only non-null)
CREATE INDEX IF NOT EXISTS idx_user_career_path_root_hash 
    ON public.user_career_path USING HASH (root_career_path_competency_id)
    WHERE root_career_path_competency_id IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- This migration adds the root_career_path_competency_id column to the
-- user_career_path table. This column will be populated automatically by
-- the backend when HR adds core-competencies to a user's career path.
--
-- ============================================================================

