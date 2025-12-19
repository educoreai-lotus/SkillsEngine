-- ============================================================================
-- EXAMPLE: Add common competency aliases
-- ============================================================================
-- Description: Example SQL to add common aliases for popular competencies
--              Run this after migration 004 to populate common aliases
-- ============================================================================

-- Example: Add aliases for "react" competency
-- First, find the competency_id for "react"
-- Then add aliases:

-- For React
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'reactjs'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'reactjs'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'react js'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'reactjs'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'react.js'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'reactjs'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'react'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'reactjs'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;
-- For Node.js
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'nodejs'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'node.js'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'node js'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'node.js'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

-- For JavaScript
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'js'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'javascript'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'ecmascript'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'javascript'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

-- For TypeScript
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'ts'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'typescript'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

-- For Python
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'py'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'python'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

-- For HTML/HTML5 (merge html5 into html, or vice versa)
-- Option 1: If "html" is the canonical name, make "html5" an alias
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'html5'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'html'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

-- Option 2: If "html5" is the canonical name, make "html" an alias
INSERT INTO public.competency_aliases (competency_id, alias_name)
SELECT competency_id, 'html'
FROM public.competencies
WHERE LOWER(TRIM(competency_name)) = 'html5'
ON CONFLICT (LOWER(TRIM(alias_name))) DO NOTHING;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Replace 'react', 'node.js', etc. with your actual competency names
-- 2. The ON CONFLICT clause prevents errors if alias already exists
-- 3. The trigger will automatically normalize alias names (lowercase, trimmed)
-- 4. You can add more aliases by following the same pattern
--
-- ============================================================================

