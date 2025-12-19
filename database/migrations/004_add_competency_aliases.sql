-- ============================================================================
-- MIGRATION: Add competency aliases table for synonym handling
-- ============================================================================
-- Description: Creates a table to store alternative names/aliases for competencies
--              to handle semantic duplicates like "react", "reactjs", "react js"
-- ============================================================================

-- Create competency_aliases table
CREATE TABLE IF NOT EXISTS public.competency_aliases (
    alias_id UUID NOT NULL DEFAULT gen_random_uuid(),
    competency_id UUID NOT NULL,
    alias_name VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT competency_aliases_pkey PRIMARY KEY (alias_id),
    CONSTRAINT competency_aliases_competency_id_fkey 
        FOREIGN KEY (competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE
);

-- Unique constraint: one alias name can only map to one competency
CREATE UNIQUE INDEX IF NOT EXISTS idx_competency_aliases_name_unique 
    ON public.competency_aliases (LOWER(TRIM(alias_name)));

-- Index for fast lookup by alias name
CREATE INDEX IF NOT EXISTS idx_competency_aliases_alias_name 
    ON public.competency_aliases (LOWER(TRIM(alias_name)));

-- Index for fast lookup by competency_id
CREATE INDEX IF NOT EXISTS idx_competency_aliases_competency_id 
    ON public.competency_aliases (competency_id);

-- Trigger to normalize alias names on insert/update
CREATE OR REPLACE FUNCTION normalize_alias_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.alias_name := LOWER(TRIM(NEW.alias_name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_alias_name ON public.competency_aliases;
CREATE TRIGGER trigger_normalize_alias_name
    BEFORE INSERT OR UPDATE ON public.competency_aliases
    FOR EACH ROW
    EXECUTE FUNCTION normalize_alias_name();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- This migration creates a competency_aliases table to store alternative
-- names for competencies. This allows the system to recognize that:
-- - "react", "reactjs", "react js", "React.js" all refer to the same competency
--
-- Usage:
-- INSERT INTO competency_aliases (competency_id, alias_name) 
-- VALUES ('<react-competency-id>', 'reactjs');
-- VALUES ('<react-competency-id>', 'react js');
--
-- ============================================================================

