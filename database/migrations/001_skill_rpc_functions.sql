-- ============================================================================
-- Skills Engine - Skill RPC Functions
-- ============================================================================
-- Description:
--   Helper SQL functions used by Supabase RPC:
--     - public.get_mgs_for_skill(root_skill_id)
--     - public.get_skill_depth(skill_id_param)
--   These are required by:
--     - skillRepository.findMGS
--     - skillRepository.getDepth
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_mgs_for_skill(root_skill_id VARCHAR)
RETURNS SETOF skills
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE skill_tree AS (
  -- Start from the root skill
  SELECT
    s.skill_id,
    s.skill_name,
    s.parent_skill_id,
    s.description,
    s.source,
    s.created_at,
    s.updated_at
  FROM skills s
  WHERE s.skill_id = root_skill_id

  UNION ALL

  -- Walk down the hierarchy using the skill_subSkill junction table
  SELECT
    child.skill_id,
    child.skill_name,
    child.parent_skill_id,
    child.description,
    child.source,
    child.created_at,
    child.updated_at
  FROM skill_subSkill ss
  INNER JOIN skills child ON child.skill_id = ss.child_skill_id
  INNER JOIN skill_tree st ON ss.parent_skill_id = st.skill_id
)
-- Leaf nodes = skills in the tree that have no children in skill_subSkill
SELECT st.*
FROM skill_tree st
LEFT JOIN skill_subSkill ss2 ON ss2.parent_skill_id = st.skill_id
WHERE ss2.child_skill_id IS NULL;
$$;


-- 2) get_skill_depth
-- Returns the depth of a skill in the hierarchy:
--   1 = root (L1), 2 = child (L2), etc.
CREATE OR REPLACE FUNCTION public.get_skill_depth(skill_id_param VARCHAR)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE ancestors AS (
  -- Start from the skill itself
  SELECT
    s.skill_id,
    s.parent_skill_id,
    1 AS depth
  FROM skills s
  WHERE s.skill_id = skill_id_param

  UNION ALL

  -- Walk up the hierarchy following parent_skill_id
  SELECT
    p.skill_id,
    p.parent_skill_id,
    a.depth + 1 AS depth
  FROM skills p
  INNER JOIN ancestors a ON a.parent_skill_id = p.skill_id
)
SELECT MAX(depth) FROM ancestors;
$$;

-- ============================================================================
-- End of Skill RPC Functions
-- ============================================================================


