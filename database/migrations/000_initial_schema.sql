-- ============================================================================
-- Skills Engine - Initial Database Schema
-- ============================================================================
-- Description: Complete database schema for Skills Engine microservice
-- Created: 2025-01-27
-- Order: All tables created in dependency order
-- ============================================================================

-- ============================================================================
-- 0. Hash Index Function
-- ============================================================================

-- Polynomial Rolling Hash Function
-- Formula: h(s) = (s[0]*p^0 + s[1]*p^1 + ... + s[n-1]*p^(n-1)) mod M
-- Parameters: p = 31, M = 1,000,000,009
-- Normalization: LOWER(TRIM()) applied before hashing
CREATE OR REPLACE FUNCTION POLYNOMIAL_HASH(input_text TEXT)
RETURNS BIGINT AS $$
DECLARE
    hash_value BIGINT := 0;
    prime BIGINT := 31;
    modulus BIGINT := 1000000009;
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
        hash_value := (hash_value + char_code * POWER(prime, i - 1)) % modulus;
    END LOOP;
    
    RETURN hash_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 1. Core Taxonomy Tables
-- ============================================================================

-- 1.1 Skills Table
-- Purpose: Stores all skills in the hierarchical taxonomy
CREATE TABLE IF NOT EXISTS skills (
    skill_id VARCHAR(255) PRIMARY KEY,
    skill_name VARCHAR(500) NOT NULL,
    parent_skill_id VARCHAR(255),
    description TEXT,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_skills_parent 
        FOREIGN KEY (parent_skill_id) 
        REFERENCES skills(skill_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parent_skill ON skills(parent_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_name ON skills(skill_name);

-- Hash indexes for skills table
CREATE INDEX IF NOT EXISTS idx_skill_id_hash ON skills((POLYNOMIAL_HASH(skill_id)));
CREATE INDEX IF NOT EXISTS idx_skill_name_hash ON skills((POLYNOMIAL_HASH(skill_name)));

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_skills_updated_at();

-- 1.2 Competencies Table
-- Purpose: Stores all competencies
CREATE TABLE IF NOT EXISTS competencies (
    competency_id VARCHAR(255) PRIMARY KEY,
    competency_name VARCHAR(500) NOT NULL,
    description TEXT,
    source VARCHAR(100),
    parent_competency_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_competencies_parent 
        FOREIGN KEY (parent_competency_id) 
        REFERENCES competencies(competency_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parent_competency ON competencies(parent_competency_id);
CREATE INDEX IF NOT EXISTS idx_competency_id ON competencies(competency_id);
CREATE INDEX IF NOT EXISTS idx_competency_name ON competencies(competency_name);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_competencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_competencies_updated_at
    BEFORE UPDATE ON competencies
    FOR EACH ROW
    EXECUTE FUNCTION update_competencies_updated_at();

-- ============================================================================
-- 2. Junction Tables
-- ============================================================================

-- 2.1 Competency-Skill Junction Table
-- Purpose: Links competencies to their required L1 skills
CREATE TABLE IF NOT EXISTS competency_skill (
    competency_id VARCHAR(255) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (competency_id, skill_id),
    CONSTRAINT fk_competency_skill_competency 
        FOREIGN KEY (competency_id) 
        REFERENCES competencies(competency_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_competency_skill_skill 
        FOREIGN KEY (skill_id) 
        REFERENCES skills(skill_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_competency_skill_skill ON competency_skill(skill_id);
CREATE INDEX IF NOT EXISTS idx_competency_skill_competency ON competency_skill(competency_id);

-- Hash index for competency_skill table
CREATE INDEX IF NOT EXISTS idx_competency_id_hash ON competency_skill((POLYNOMIAL_HASH(competency_id)));

-- 2.2 Skill-SubSkill Junction Table
-- Purpose: Junction table for skill hierarchy (parent-child relationships)
CREATE TABLE IF NOT EXISTS skill_subSkill (
    parent_skill_id VARCHAR(255) NOT NULL,
    child_skill_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (parent_skill_id, child_skill_id),
    CONSTRAINT fk_skill_subskill_parent 
        FOREIGN KEY (parent_skill_id) 
        REFERENCES skills(skill_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_skill_subskill_child 
        FOREIGN KEY (child_skill_id) 
        REFERENCES skills(skill_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_subskill_parent ON skill_subSkill(parent_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_subskill_child ON skill_subSkill(child_skill_id);

-- Hash indexes for skill_subSkill table
CREATE INDEX IF NOT EXISTS idx_parent_skill_id_hash ON skill_subSkill((POLYNOMIAL_HASH(parent_skill_id)));
CREATE INDEX IF NOT EXISTS idx_child_skill_id_hash ON skill_subSkill((POLYNOMIAL_HASH(child_skill_id)));

-- 2.3 Competency-SubCompetency Junction Table
-- Purpose: Junction table for nested competencies (sub-competencies)
CREATE TABLE IF NOT EXISTS competency_subCompetency (
    parent_competency_id VARCHAR(255) NOT NULL,
    child_competency_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (parent_competency_id, child_competency_id),
    CONSTRAINT fk_competency_subcompetency_parent 
        FOREIGN KEY (parent_competency_id) 
        REFERENCES competencies(competency_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_competency_subcompetency_child 
        FOREIGN KEY (child_competency_id) 
        REFERENCES competencies(competency_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_competency_subcompetency_parent ON competency_subCompetency(parent_competency_id);
CREATE INDEX IF NOT EXISTS idx_competency_subcompetency_child ON competency_subCompetency(child_competency_id);

-- ============================================================================
-- 3. User Profile Tables
-- ============================================================================

-- 3.1 Users Table
-- Purpose: Stores basic user information
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    company_id VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    employee_type VARCHAR(100),
    path_career VARCHAR(500),
    raw_data TEXT,
    relevance_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_users_relevance_score 
        CHECK (relevance_score >= 0.00 AND relevance_score <= 100.00)
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_employee_type ON users(employee_type);

-- Hash index for users table
CREATE INDEX IF NOT EXISTS idx_user_id_hash ON users((POLYNOMIAL_HASH(user_id)));

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- 3.2 UserCompetency Table
-- Purpose: Stores user competency profiles with verification status
CREATE TABLE IF NOT EXISTS userCompetency (
    user_id VARCHAR(255) NOT NULL,
    competency_id VARCHAR(255) NOT NULL,
    coverage_percentage DECIMAL(5,2) DEFAULT 0.00,
    proficiency_level VARCHAR(50),
    verifiedSkills JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, competency_id),
    CONSTRAINT fk_usercompetency_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_usercompetency_competency 
        FOREIGN KEY (competency_id) 
        REFERENCES competencies(competency_id) 
        ON DELETE CASCADE,
    CONSTRAINT chk_usercompetency_coverage 
        CHECK (coverage_percentage >= 0.00 AND coverage_percentage <= 100.00)
);

CREATE INDEX IF NOT EXISTS idx_usercompetency_user ON userCompetency(user_id);
CREATE INDEX IF NOT EXISTS idx_usercompetency_competency ON userCompetency(competency_id);

-- Hash indexes for userCompetency table
CREATE INDEX IF NOT EXISTS idx_usercompetency_user_hash ON userCompetency((POLYNOMIAL_HASH(user_id)));
CREATE INDEX IF NOT EXISTS idx_usercompetency_competency_hash ON userCompetency((POLYNOMIAL_HASH(competency_id)));

-- GIN index for JSONB field for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_usercompetency_verified_skills ON userCompetency USING GIN (verifiedSkills);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_usercompetency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_usercompetency_updated_at
    BEFORE UPDATE ON userCompetency
    FOR EACH ROW
    EXECUTE FUNCTION update_usercompetency_updated_at();

-- 3.3 UserSkill Table
-- Purpose: Stores individual user skills (optional, for detailed tracking)
CREATE TABLE IF NOT EXISTS userSkill (
    user_id VARCHAR(255) NOT NULL,
    skill_id VARCHAR(255) NOT NULL,
    skill_name VARCHAR(500) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    source VARCHAR(100),
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, skill_id),
    CONSTRAINT fk_userskill_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_userskill_skill 
        FOREIGN KEY (skill_id) 
        REFERENCES skills(skill_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_userskill_user ON userSkill(user_id);
CREATE INDEX IF NOT EXISTS idx_userskill_skill ON userSkill(skill_id);


-- Hash indexes for userSkill table
CREATE INDEX IF NOT EXISTS idx_userskill_user_hash ON userSkill((POLYNOMIAL_HASH(user_id)));
CREATE INDEX IF NOT EXISTS idx_userskill_skill_hash ON userSkill((POLYNOMIAL_HASH(skill_id)));

-- ============================================================================
-- 4. External Sources Table
-- ============================================================================

-- 4.1 Official Sources Table
-- Purpose: Stores official sources discovered by AI for taxonomy building
CREATE TABLE IF NOT EXISTS official_sources (
    source_id VARCHAR(255) PRIMARY KEY,
    source_name VARCHAR(500) NOT NULL,
    reference_index_url VARCHAR(1000) NOT NULL,
    reference_type VARCHAR(100),
    hierarchy_support BOOLEAN DEFAULT FALSE,
    provides TEXT,
    topics_covered TEXT,
    skill_focus TEXT,
    notes TEXT,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_official_sources_source_id ON official_sources(source_id);


-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_official_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_official_sources_updated_at
    BEFORE UPDATE ON official_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_official_sources_updated_at();

-- ============================================================================
-- End of Initial Schema
-- ============================================================================

