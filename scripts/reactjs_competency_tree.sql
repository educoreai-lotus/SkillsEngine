-- ==========================================================
-- full reactjs competency tree (lowercase)
-- ==========================================================

-- 1) create reactjs competency (no parent)
WITH react_competency AS (
    INSERT INTO competencies (competency_id, competency_name, description, parent_competency_id)
    VALUES (
        gen_random_uuid(),
        'reactjs',
        'reactjs framework including jsx, hooks, components, routing, and optimization.',
        NULL
    )
    RETURNING competency_id
),

-- ==========================================================
-- 2) insert top-level reactjs skills
-- ==========================================================
skills AS (
    INSERT INTO skills (skill_id, skill_name, description)
    VALUES
        (gen_random_uuid(), 'react fundamentals', 'core concepts of react including components, props, and rendering.'),
        (gen_random_uuid(), 'jsx & rendering', 'jsx syntax and rendering logic.'),
        (gen_random_uuid(), 'components & props', 'functional components and props passing.'),
        (gen_random_uuid(), 'react hooks', 'using hooks such as usestate, useeffect and custom hooks.'),
        (gen_random_uuid(), 'state & props management', 'managing local and global state.'),
        (gen_random_uuid(), 'react router basics', 'client-side routing using react router.'),
        (gen_random_uuid(), 'performance optimization', 'memoization and optimizing re-renders.')
    RETURNING skill_id, skill_name
),

-- ==========================================================
-- 3) map skills to the reactjs competency
-- ==========================================================
map_competency AS (
    INSERT INTO competency_skill (competency_id, skill_id)
    SELECT (SELECT competency_id FROM react_competency), skill_id
    FROM skills
    RETURNING skill_id
),

-- ==========================================================
-- 4) insert subskills (leaf-level skills)
-- ==========================================================
subskills AS (
    INSERT INTO skills (skill_id, skill_name, description)
    VALUES
        (gen_random_uuid(), 'usestate', 'state management hook.'),
        (gen_random_uuid(), 'useeffect', 'side-effect management hook.'),
        (gen_random_uuid(), 'usememo', 'memoization hook for expensive computations.'),
        (gen_random_uuid(), 'usecallback', 'memoized callback hook.'),
        (gen_random_uuid(), 'react.memo', 'component memoization to prevent re-renders.'),
        (gen_random_uuid(), 'router: navigation & route params', 'navigation between pages and handling params.')
    RETURNING skill_id, skill_name
)

-- ==========================================================
-- 5) build the skill → subskill hierarchy
-- ==========================================================
INSERT INTO skill_subskill (parent_skill_id, child_skill_id)
SELECT
    CASE 
        WHEN s.skill_name = 'usestate' THEN (SELECT skill_id FROM skills WHERE skill_name = 'react hooks')
        WHEN s.skill_name = 'useeffect' THEN (SELECT skill_id FROM skills WHERE skill_name = 'react hooks')
        WHEN s.skill_name = 'usememo' THEN (SELECT skill_id FROM skills WHERE skill_name = 'performance optimization')
        WHEN s.skill_name = 'usecallback' THEN (SELECT skill_id FROM skills WHERE skill_name = 'performance optimization')
        WHEN s.skill_name = 'react.memo' THEN (SELECT skill_id FROM skills WHERE skill_name = 'performance optimization')
        WHEN s.skill_name = 'router: navigation & route params' THEN (SELECT skill_id FROM skills WHERE skill_name = 'react router basics')
    END AS parent_skill_id,
    s.skill_id AS child_skill_id
FROM subskills s;


