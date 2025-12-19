-- ============================================================================
-- MIGRATION: Convert varchar IDs to UUID with Polynomial Hash Indexing
-- ============================================================================
-- Description: Drops all existing tables and recreates them with UUID 
--              primary keys and polynomial hash indexes
-- ============================================================================


-- ============================================================================
-- STEP 1: CREATE FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Polynomial Rolling Hash Function
-- ----------------------------------------------------------------------------
-- Formula: h(s) = (s[0]*p^0 + s[1]*p^1 + ... + s[n-1]*p^(n-1)) mod M
-- Parameters: p = 31, M = 1,000,000,009
-- Normalization: LOWER(TRIM()) applied before hashing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION polynomial_hash(input_text TEXT)
RETURNS BIGINT AS $$
DECLARE
    -- Use NUMERIC internally to avoid BIGINT overflow, then cast back after modulo
    hash_value NUMERIC := 0;
    prime NUMERIC := 31;
    modulus NUMERIC := 1000000009;
    normalized_text TEXT;
    i INTEGER;
    char_code INTEGER;
BEGIN
    -- Normalize input: trim and lowercase
    normalized_text := LOWER(TRIM(input_text));
    
    -- Handle NULL or empty strings
    IF normalized_text IS NULL OR normalized_text = '' THEN
        RETURN 0;
    END IF;
    
    -- Calculate polynomial rolling hash
    FOR i IN 1..LENGTH(normalized_text) LOOP
        char_code := ASCII(SUBSTRING(normalized_text FROM i FOR 1));
        -- Keep computation in NUMERIC and reduce with MOD to stay within range
        hash_value := MOD(hash_value + char_code * POWER(prime, i - 1), modulus);
    END LOOP;
    
    -- Safe cast: value is always in [0, modulus) which fits into BIGINT
    RETURN hash_value::BIGINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ----------------------------------------------------------------------------
-- Updated At Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- STEP 3: CREATE TABLES
-- ============================================================================


-- ----------------------------------------------------------------------------
-- OFFICIAL_SOURCES
-- ----------------------------------------------------------------------------
CREATE TABLE public.official_sources (
    source_id VARCHAR(255) NOT NULL,
    source_name VARCHAR(500) NOT NULL,
    reference_index_url VARCHAR(1000) NOT NULL,
    reference_type VARCHAR(100) NULL,
    access_method VARCHAR(100) NULL,
    hierarchy_support BOOLEAN NULL DEFAULT FALSE,
    provides TEXT NULL,
    coveredtopic TEXT NULL,
    skill_focus TEXT NULL,
    notes TEXT NULL,
    is_extracted BOOLEAN NOT NULL DEFAULT FALSE,
    last_checked TIMESTAMP WITHOUT TIME ZONE NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT official_sources_pkey PRIMARY KEY (source_id)
);

-- Indexes
CREATE INDEX idx_official_sources_source_id ON public.official_sources (source_id);
CREATE INDEX idx_official_sources_reference_type ON public.official_sources (reference_type);
CREATE INDEX idx_official_sources_last_checked ON public.official_sources (last_checked);

-- Trigger
CREATE TRIGGER update_official_sources_updated_at 
    BEFORE UPDATE ON official_sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- COMPETENCIES
-- ----------------------------------------------------------------------------
CREATE TABLE public.competencies (
    competency_id UUID NOT NULL DEFAULT gen_random_uuid(),
    competency_name VARCHAR(500) NOT NULL,
    description TEXT NULL,
    parent_competency_id UUID NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(100) NULL DEFAULT 'soc',
    CONSTRAINT competencies_pkey PRIMARY KEY (competency_id),
    CONSTRAINT competencies_parent_competency_id_fkey 
        FOREIGN KEY (parent_competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_competencies_competency_id ON public.competencies (competency_id);
CREATE INDEX idx_competencies_competency_name ON public.competencies (competency_name);
CREATE INDEX idx_competencies_parent_competency_id ON public.competencies (parent_competency_id);

-- Hash Indexes
CREATE INDEX idx_competency_id_hash ON public.competencies (polynomial_hash(competency_id::TEXT));
CREATE INDEX idx_competency_name_hash ON public.competencies (polynomial_hash(competency_name));

-- Trigger
CREATE TRIGGER update_competencies_updated_at 
    BEFORE UPDATE ON competencies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- SKILLS
-- ----------------------------------------------------------------------------
CREATE TABLE public.skills (
    skill_id UUID NOT NULL DEFAULT gen_random_uuid(),
    skill_name VARCHAR(500) NOT NULL,
    parent_skill_id UUID NULL,
    description TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(100) NULL DEFAULT 'temp',
    CONSTRAINT skills_pkey PRIMARY KEY (skill_id),
    CONSTRAINT unique_skill_name UNIQUE (skill_name),
    CONSTRAINT skills_parent_skill_id_fkey 
        FOREIGN KEY (parent_skill_id) 
        REFERENCES skills (skill_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_skills_skill_id ON public.skills (skill_id);
CREATE INDEX idx_skills_skill_name ON public.skills (skill_name);
CREATE INDEX idx_skills_parent_skill_id ON public.skills (parent_skill_id);

-- Hash Indexes
CREATE INDEX idx_skill_id_hash ON public.skills (polynomial_hash(skill_id::TEXT));
CREATE INDEX idx_skill_name_hash ON public.skills (polynomial_hash(skill_name));

-- Trigger
CREATE TRIGGER update_skills_updated_at 
    BEFORE UPDATE ON skills 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
CREATE TABLE public.users (
    user_id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_name VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL,
    employee_type VARCHAR(100) NULL,
    path_career VARCHAR(500) NULL,
    raw_data TEXT NULL,
    relevance_score NUMERIC(5, 2) NULL DEFAULT 0.00,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    company_name VARCHAR(255) NULL,
    preferred_language character varying NULL DEFAULT 'en'::character varying,
    CONSTRAINT users_pkey PRIMARY KEY (user_id)
);

-- Standard Indexes
CREATE INDEX idx_users_user_id ON public.users (user_id);
CREATE INDEX idx_users_company_id ON public.users (company_id);
CREATE INDEX idx_users_employee_type ON public.users (employee_type);

-- Hash Indexes
CREATE INDEX idx_user_id_hash ON public.users (polynomial_hash(user_id::TEXT));

-- Trigger
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- COMPETENCY_SKILL (Junction Table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.competency_skill (
    competency_id UUID NOT NULL,
    skill_id UUID NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT competency_skill_pkey PRIMARY KEY (competency_id, skill_id),
    CONSTRAINT competency_skill_competency_id_fkey 
        FOREIGN KEY (competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE,
    CONSTRAINT competency_skill_skill_id_fkey 
        FOREIGN KEY (skill_id) 
        REFERENCES skills (skill_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_competency_skill_competency_id ON public.competency_skill (competency_id);
CREATE INDEX idx_competency_skill_skill_id ON public.competency_skill (skill_id);

-- Hash Indexes
CREATE INDEX idx_competency_skill_competency_hash ON public.competency_skill (polynomial_hash(competency_id::TEXT));
CREATE INDEX idx_competency_skill_skill_hash ON public.competency_skill (polynomial_hash(skill_id::TEXT));


-- ----------------------------------------------------------------------------
-- COMPETENCY_SUBCOMPETENCY (Junction Table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.competency_subcompetency (
    parent_competency_id UUID NOT NULL,
    child_competency_id UUID NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT competency_subcompetency_pkey PRIMARY KEY (parent_competency_id, child_competency_id),
    CONSTRAINT competency_subcompetency_parent_fkey 
        FOREIGN KEY (parent_competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE,
    CONSTRAINT competency_subcompetency_child_fkey 
        FOREIGN KEY (child_competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_competency_subcomp_parent ON public.competency_subcompetency (parent_competency_id);
CREATE INDEX idx_competency_subcomp_child ON public.competency_subcompetency (child_competency_id);

-- Hash Indexes
CREATE INDEX idx_competency_subcomp_parent_hash ON public.competency_subcompetency (polynomial_hash(parent_competency_id::TEXT));
CREATE INDEX idx_competency_subcomp_child_hash ON public.competency_subcompetency (polynomial_hash(child_competency_id::TEXT));


-- ----------------------------------------------------------------------------
-- SKILL_SUBSKILL (Junction Table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.skill_subskill (
    parent_skill_id UUID NOT NULL,
    child_skill_id UUID NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skill_subskill_pkey PRIMARY KEY (parent_skill_id, child_skill_id),
    CONSTRAINT skill_subskill_parent_fkey 
        FOREIGN KEY (parent_skill_id) 
        REFERENCES skills (skill_id) ON DELETE CASCADE,
    CONSTRAINT skill_subskill_child_fkey 
        FOREIGN KEY (child_skill_id) 
        REFERENCES skills (skill_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_skill_subskill_parent ON public.skill_subskill (parent_skill_id);
CREATE INDEX idx_skill_subskill_child ON public.skill_subskill (child_skill_id);

-- Hash Indexes
CREATE INDEX idx_skill_subskill_parent_hash ON public.skill_subskill (polynomial_hash(parent_skill_id::TEXT));
CREATE INDEX idx_skill_subskill_child_hash ON public.skill_subskill (polynomial_hash(child_skill_id::TEXT));


-- ----------------------------------------------------------------------------
-- USERCOMPETENCY (Junction Table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.usercompetency (
    user_id UUID NOT NULL,
    competency_id UUID NOT NULL,
    coverage_percentage NUMERIC(5, 2) NULL DEFAULT 0.00,
    proficiency_level VARCHAR(50) NULL,
    verifiedskills JSONB NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usercompetency_pkey PRIMARY KEY (user_id, competency_id),
    CONSTRAINT usercompetency_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT usercompetency_competency_id_fkey 
        FOREIGN KEY (competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_usercompetency_user_id ON public.usercompetency (user_id);
CREATE INDEX idx_usercompetency_competency_id ON public.usercompetency (competency_id);
CREATE INDEX idx_usercompetency_verified_skills ON public.usercompetency USING GIN (verifiedskills);

-- Hash Indexes
CREATE INDEX idx_usercompetency_user_hash ON public.usercompetency (polynomial_hash(user_id::TEXT));
CREATE INDEX idx_usercompetency_competency_hash ON public.usercompetency (polynomial_hash(competency_id::TEXT));

-- Trigger
CREATE TRIGGER update_usercompetency_updated_at 
    BEFORE UPDATE ON usercompetency 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- USERSKILL (Junction Table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.userskill (
    user_id UUID NOT NULL,
    skill_id UUID NOT NULL,
    skill_name VARCHAR(500) NOT NULL,
    verified BOOLEAN NULL DEFAULT FALSE,
    source VARCHAR(100) NULL,
    last_update TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT userskill_pkey PRIMARY KEY (user_id, skill_id),
    CONSTRAINT userskill_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT userskill_skill_id_fkey 
        FOREIGN KEY (skill_id) 
        REFERENCES skills (skill_id) ON DELETE CASCADE
);

-- Standard Indexes
CREATE INDEX idx_userskill_user_id ON public.userskill (user_id);
CREATE INDEX idx_userskill_skill_id ON public.userskill (skill_id);

-- Hash Indexes
CREATE INDEX idx_userskill_user_hash ON public.userskill (polynomial_hash(user_id::TEXT));
CREATE INDEX idx_userskill_skill_hash ON public.userskill (polynomial_hash(skill_id::TEXT));


-- ----------------------------------------------------------------------------
-- USER_CAREER_PATH (Junction Table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_career_path (
    user_id UUID NOT NULL,
    competency_id UUID NOT NULL,
    root_career_path_competency_id UUID NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_career_path_pkey PRIMARY KEY (user_id, competency_id),
    CONSTRAINT user_career_path_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT user_career_path_competency_id_fkey 
        FOREIGN KEY (competency_id) 
        REFERENCES competencies (competency_id) ON DELETE CASCADE,
    CONSTRAINT user_career_path_root_fkey 
        FOREIGN KEY (root_career_path_competency_id) 
        REFERENCES competencies (competency_id) ON DELETE SET NULL
);

-- Standard Indexes
CREATE INDEX idx_user_career_path_user_id ON public.user_career_path (user_id);
CREATE INDEX idx_user_career_path_competency_id ON public.user_career_path (competency_id);
CREATE INDEX idx_user_career_path_root ON public.user_career_path (root_career_path_competency_id);

-- Hash Indexes
CREATE INDEX idx_user_career_path_user_hash ON public.user_career_path (polynomial_hash(user_id::TEXT));
CREATE INDEX idx_user_career_path_competency_hash ON public.user_career_path (polynomial_hash(competency_id::TEXT));
CREATE INDEX idx_user_career_path_root_hash ON public.user_career_path (polynomial_hash(root_career_path_competency_id::TEXT)) WHERE root_career_path_competency_id IS NOT NULL;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Hash Index Usage Example:
-- 
-- SELECT * FROM skills 
-- WHERE polynomial_hash(skill_name) = polynomial_hash('Python')
--   AND skill_name ILIKE 'Python';
--
-- SELECT * FROM users
-- WHERE polynomial_hash(user_id::TEXT) = polynomial_hash('550e8400-e29b-41d4-a716-446655440000')
--   AND user_id = '550e8400-e29b-41d4-a716-446655440000';
--
-- ============================================================================