-- ============================================================================
-- ============================================================================
-- Description:
--   These are required by:
--     - skillRepository.findMGS
--     - skillRepository.getDepth
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_mgs_for_skill(root_skill_id UUID)
RETURNS TABLE (
  skill_id UUID,
  skill_name VARCHAR,
  parent_skill_id UUID,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE,
  source VARCHAR(100)
)
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
    s.created_at,
    s.updated_at,
    s.source
  FROM skills s
  WHERE s.skill_id = root_skill_id

  UNION ALL

  -- Walk down the hierarchy using the skill_subskill junction table
  SELECT
    child.skill_id,
    child.skill_name,
    child.parent_skill_id,
    child.description,
    child.created_at,
    child.updated_at,
    child.source
  FROM skill_subskill ss
  INNER JOIN skills child ON child.skill_id = ss.child_skill_id
  INNER JOIN skill_tree st ON ss.parent_skill_id = st.skill_id
)
SELECT
  st.skill_id,
  st.skill_name,
  st.parent_skill_id,
  st.description,
  st.created_at,
  st.updated_at,
  st.source
FROM skill_tree st
WHERE NOT EXISTS (
  -- A leaf (MGS) is any skill in the tree that has no children
  -- in the skill_subskill junction table.
  SELECT 1
  FROM skill_subskill ss2
  WHERE ss2.parent_skill_id = st.skill_id
);
$$;


-- 2) get_skill_depth
-- Returns the depth of a skill in the hierarchy:
--   1 = root (L1), 2 = child (L2), etc.
CREATE OR REPLACE FUNCTION public.get_skill_depth(skill_id_param UUID)
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


