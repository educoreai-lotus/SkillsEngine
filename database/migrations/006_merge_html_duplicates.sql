-- ============================================================================
-- MIGRATION: Merge HTML and HTML5 duplicates
-- ============================================================================
-- Description: Merges HTML and HTML5 competencies if both exist,
--              keeping one as canonical and the other as alias
-- ============================================================================

DO $$
DECLARE
    html_id UUID;
    html5_id UUID;
    keep_id UUID;
    merge_id UUID;
BEGIN
    -- Find both competencies
    SELECT competency_id INTO html_id
    FROM public.competencies
    WHERE LOWER(TRIM(competency_name)) = 'html'
    LIMIT 1;

    SELECT competency_id INTO html5_id
    FROM public.competencies
    WHERE LOWER(TRIM(competency_name)) = 'html5'
    LIMIT 1;

    -- If both exist, merge them
    IF html_id IS NOT NULL AND html5_id IS NOT NULL THEN
        -- Keep html5 as canonical (more specific), merge html into it
        keep_id := html5_id;
        merge_id := html_id;

        -- Add "html" as alias for "html5"
        INSERT INTO public.competency_aliases (competency_id, alias_name)
        VALUES (keep_id, 'html')
        ON CONFLICT DO NOTHING;

        -- Update all references to point to html5
        -- Update competency_subcompetency
        UPDATE public.competency_subcompetency
        SET parent_competency_id = keep_id
        WHERE parent_competency_id = merge_id;

        UPDATE public.competency_subcompetency
        SET child_competency_id = keep_id
        WHERE child_competency_id = merge_id;

        -- Update competency_skill
        UPDATE public.competency_skill
        SET competency_id = keep_id
        WHERE competency_id = merge_id;

        -- Update user_competency
        UPDATE public.user_competency
        SET competency_id = keep_id
        WHERE competency_id = merge_id;

        -- Update user_career_path
        UPDATE public.user_career_path
        SET competency_id = keep_id
        WHERE competency_id = merge_id;

        UPDATE public.user_career_path
        SET root_career_path_competency_id = keep_id
        WHERE root_career_path_competency_id = merge_id;

        -- Update parent_competency_id references
        UPDATE public.competencies
        SET parent_competency_id = keep_id
        WHERE parent_competency_id = merge_id;

        -- Delete the duplicate
        DELETE FROM public.competencies
        WHERE competency_id = merge_id;

        RAISE NOTICE 'Merged HTML (%) into HTML5 (%)', merge_id, keep_id;
    ELSIF html_id IS NOT NULL THEN
        -- Only html exists, add html5 as alias
        INSERT INTO public.competency_aliases (competency_id, alias_name)
        VALUES (html_id, 'html5')
        ON CONFLICT DO NOTHING;
        RAISE NOTICE 'Added html5 as alias for html (%)', html_id;
    ELSIF html5_id IS NOT NULL THEN
        -- Only html5 exists, add html as alias
        INSERT INTO public.competency_aliases (competency_id, alias_name)
        VALUES (html5_id, 'html')
        ON CONFLICT DO NOTHING;
        RAISE NOTICE 'Added html as alias for html5 (%)', html5_id;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- This migration:
-- 1. Finds both "html" and "html5" competencies if they exist
-- 2. Keeps "html5" as the canonical name (more specific)
-- 3. Merges "html" into "html5" by:
--    - Adding "html" as an alias for "html5"
--    - Updating all references to point to "html5"
--    - Deleting the duplicate "html" competency
--
-- After this, searching for either "html" or "html5" will find the same
-- competency (html5).
--
-- ============================================================================

