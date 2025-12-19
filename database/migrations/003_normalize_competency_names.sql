-- ============================================================================
-- MIGRATION: Normalize competency names and add unique constraint
-- ============================================================================
-- Description: Normalizes all existing competency names to lowercase and trimmed,
--              then adds a case-insensitive unique constraint to prevent duplicates
-- ============================================================================

-- Step 1: Normalize all existing competency names (lowercase + trim)
UPDATE public.competencies
SET competency_name = LOWER(TRIM(competency_name))
WHERE competency_name != LOWER(TRIM(competency_name));

-- Step 2: Handle duplicates by keeping the oldest one and merging references
-- First, identify duplicates
DO $$
DECLARE
    dup_record RECORD;
    keep_id UUID;
    merge_ids UUID[];
BEGIN
    -- Find all duplicate groups (same normalized name)
    FOR dup_record IN
        SELECT LOWER(TRIM(competency_name)) AS normalized_name,
               ARRAY_AGG(competency_id ORDER BY created_at) AS ids,
               COUNT(*) AS cnt
        FROM public.competencies
        GROUP BY LOWER(TRIM(competency_name))
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the first (oldest) one
        keep_id := dup_record.ids[1];
        merge_ids := dup_record.ids[2:array_length(dup_record.ids, 1)];
        
        -- Update all references in competency_subcompetency to point to the kept one
        UPDATE public.competency_subcompetency
        SET parent_competency_id = keep_id
        WHERE parent_competency_id = ANY(merge_ids);
        
        UPDATE public.competency_subcompetency
        SET child_competency_id = keep_id
        WHERE child_competency_id = ANY(merge_ids);
        
        -- Update all references in competency_skill to point to the kept one
        UPDATE public.competency_skill
        SET competency_id = keep_id
        WHERE competency_id = ANY(merge_ids);
        
        -- Update all references in user_competency to point to the kept one
        UPDATE public.user_competency
        SET competency_id = keep_id
        WHERE competency_id = ANY(merge_ids);
        
        -- Update all references in user_career_path to point to the kept one
        UPDATE public.user_career_path
        SET competency_id = keep_id
        WHERE competency_id = ANY(merge_ids);
        
        UPDATE public.user_career_path
        SET root_career_path_competency_id = keep_id
        WHERE root_career_path_competency_id = ANY(merge_ids);
        
        -- Update parent_competency_id references
        UPDATE public.competencies
        SET parent_competency_id = keep_id
        WHERE parent_competency_id = ANY(merge_ids);
        
        -- Delete duplicate competencies
        DELETE FROM public.competencies
        WHERE competency_id = ANY(merge_ids);
        
        RAISE NOTICE 'Merged % duplicate competencies into %', array_length(merge_ids, 1), keep_id;
    END LOOP;
END $$;

-- Step 3: Normalize again after merge (in case any were missed)
UPDATE public.competencies
SET competency_name = LOWER(TRIM(competency_name))
WHERE competency_name != LOWER(TRIM(competency_name));

-- Step 4: Add unique constraint on normalized competency_name
-- Using a unique index on LOWER(TRIM(competency_name)) for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_competencies_name_unique_lower 
    ON public.competencies (LOWER(TRIM(competency_name)));

-- Step 5: Add a trigger to automatically normalize competency_name on insert/update
CREATE OR REPLACE FUNCTION normalize_competency_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.competency_name := LOWER(TRIM(NEW.competency_name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_competency_name ON public.competencies;
CREATE TRIGGER trigger_normalize_competency_name
    BEFORE INSERT OR UPDATE ON public.competencies
    FOR EACH ROW
    EXECUTE FUNCTION normalize_competency_name();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- This migration:
-- 1. Normalizes all existing competency names to lowercase and trimmed
-- 2. Merges duplicate competencies (keeps oldest, updates all references)
-- 3. Adds a unique constraint on normalized competency_name
-- 4. Adds a trigger to auto-normalize on insert/update
--
-- After this migration, all competency names will be consistent and duplicates
-- will be prevented at the database level.
--
-- ============================================================================

