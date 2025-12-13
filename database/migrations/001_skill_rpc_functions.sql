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
WITH RECURSIVE
-- 1) Traverse from the root skill down through BOTH hierarchy mechanisms
skill_tree AS (
  -- base: start at the root skill
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

  -- recursive: children via either parent_skill_id or skill_subskill
  SELECT
    c.skill_id,
    c.skill_name,
    c.parent_skill_id,
    c.description,
    c.created_at,
    c.updated_at,
    c.source
  FROM skill_tree st
  JOIN (
    -- children via legacy parent_skill_id
    SELECT
      s2.skill_id,
      s2.skill_name,
      s2.parent_skill_id,
      s2.description,
      s2.created_at,
      s2.updated_at,
      s2.source,
      s2.parent_skill_id AS parent_link
    FROM skills s2
    WHERE s2.parent_skill_id IS NOT NULL

    UNION ALL

    -- children via skill_subskill junction
    SELECT
      c2.skill_id,
      c2.skill_name,
      c2.parent_skill_id,
      c2.description,
      c2.created_at,
      c2.updated_at,
      c2.source,
      ss.parent_skill_id AS parent_link
    FROM skill_subskill ss
    JOIN skills c2
      ON c2.skill_id = ss.child_skill_id
  ) c
    ON c.parent_link = st.skill_id
),

-- 2) All edges (parents → children) from both mechanisms
edges AS (
  SELECT
    parent_skill_id,
    skill_id AS child_skill_id
  FROM skills
  WHERE parent_skill_id IS NOT NULL

  UNION ALL

  SELECT
    parent_skill_id,
    child_skill_id
  FROM skill_subskill
)

-- 3) Leaf (MGS) skills:
--    - must have at least one parent (appear as child in edges)
--    - must have no children (no outgoing edge in edges)
SELECT DISTINCT
  st.skill_id,
  st.skill_name,
  st.parent_skill_id,
  st.description,
  st.created_at,
  st.updated_at,
  st.source
FROM skill_tree st
LEFT JOIN edges e_child
  ON e_child.parent_skill_id = st.skill_id
LEFT JOIN edges e_parent
  ON e_parent.child_skill_id = st.skill_id
WHERE e_child.child_skill_id IS NULL
  AND e_parent.parent_skill_id IS NOT NULL;
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
  SELECT
    s.skill_id,
    s.parent_skill_id,
    1 AS depth
  FROM skills s
  WHERE s.skill_id = skill_id_param

  UNION ALL

  SELECT
    p.skill_id,
    p.parent_skill_id,
    a.depth + 1
  FROM skills p
  JOIN ancestors a
    ON a.parent_skill_id = p.skill_id
)
SELECT MAX(depth) FROM ancestors;
$$;

-- ============================================================================
-- End of Skill RPC Functions
-- ============================================================================


