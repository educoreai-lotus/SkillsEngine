-- ==========================================
-- Insert initial official source: source_001
-- Usage:
--   psql "$DATABASE_URL" -f scripts/insert_official_source.sql
--   or run this content in Supabase SQL editor
-- ==========================================

INSERT INTO public.official_sources (
    source_id,
    source_name,
    reference_index_url,
    reference_type,
    access_method,
    hierarchy_support,
    provides,
    topics_covered,
    skill_focus,
    notes,
    is_extracted,
    last_checked
)
VALUES (
    'source_001',
    'World Skills Standard',
    'https://example.com/world-skills',
    'skills-framework',
    'API',
    true,
    'Provides detailed skill descriptions and levels',
    'Technology, IT, Software Development',
    'Frontend Development',
    'Initial import',
    false,
    '2025-01-01 10:00:00'
)
ON CONFLICT (source_id) DO NOTHING;













