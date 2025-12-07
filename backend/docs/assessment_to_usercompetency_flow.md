# Assessment Results to UserCompetency Update Flow

This document explains how the system processes assessment results (baseline or post-course exam) to:
1. **Add MGS entries** to `userCompetency.verifiedSkills` JSON array (does NOT create new competencies or skills)
2. **Update `coverage_percentage`** based on verified MGS vs total required MGS
3. **Determine `proficiency_level`** based on coverage percentage (first time set after baseline exam)

**Important:** 
- This process **does NOT create new competencies or skills**. It only updates existing `userCompetency` records by:
  - Adding verified MGS to the JSON array
  - Recalculating coverage percentage
  - Determining proficiency level (initially `undefined` when extracted from Directory raw data, then set after baseline exam)
- When `userCompetency` is initially created from Directory raw data extraction, `proficiency_level` is `'undefined'`
- The `proficiency_level` is **first determined after the baseline exam** based on assessment results
- Competencies and skills must already exist in the system before assessment processing

---

## Overview

**Flow Summary:** The system receives exam feedback (baseline or post-course) from Assessment MS, looks inside `userCompetency` to find competencies related to the user, and for each verified MGS:

1. **Receives exam feedback** from Assessment MS (baseline or post-course exam) with verified skills (MGS)
2. **Filters MGS** - only processes MGS with `status: "pass"` (MGS with `status: "fail"` are skipped)
3. **Looks inside `userCompetency`** to find competencies that relate to the user
4. **For each verified MGS with status "pass"**, finds which competency it belongs to (based on which competency has that skill linked via `competency_skill` table)
5. **Adds the MGS to that competency's `verifiedSkills` JSON array** in `userCompetency` (only MGS with status "pass" are added)
6. **Calculates `coverage_percentage`** for that competency based on verified MGS vs total required MGS
7. **Determines `proficiency_level`** of that competency based on the new coverage percentage (first time set after baseline exam if it was `undefined`)
8. **Saves all updates** to the database

**Important:** The assessment processing flow **does NOT create new competencies or skills**. It only:
- Creates new `userCompetency` records if the user didn't have that competency before (adds new competencies to user)
- Adds verified MGS to `userCompetency.verifiedSkills` JSON (existing or newly created records)
- Updates `coverage_percentage` for competencies (existing or newly created userCompetency records)
- Determines `proficiency_level` for competencies (existing or newly created userCompetency records - first time set after baseline exam if it was `undefined`)

Competencies and skills must already exist in the system (created via Career Path Hierarchy feature or manual creation) before assessment results can be processed.

**Simple Flow Diagram:**
```
Assessment MS sends exam results:
- Baseline exam: includes all skills (pass/fail)
- Post-course exam: includes course_name, exam_status, and only skills with status "pass"
    ↓
System filters MGS - only processes MGS with status "pass"
    ↓
System looks inside userCompetency to find competencies related to the user
    ↓
For each verified MGS with status "pass":
    ↓
Find which competency this MGS belongs to (based on skill linkage)
    ↓
Add MGS to that competency's verifiedSkills JSON array (only "pass" MGS)
    ↓
Calculate coverage percentage for that competency
    ↓
Update proficiency level based on new coverage
    ↓
Save to database
```

---

## Table Relationship Structure

**Key Understanding:** Based on the Career Path Hierarchy feature, the competency structure is:
- **High-level Competency** (e.g., "Full Stack Development") - Parent
- **Subcompetency** (e.g., "Frontend Development") - Child of parent
- **Core Competency / Last-level** (e.g., "React Framework") - Acts as L1 in skill hierarchy, marked with `"core-competency": true`

The `competency_skill` table links the **last-level/core competency** to **skills** (which start from L2).

```
competencies table
├── High-level Competency (e.g., "Full Stack Development")
│   └── competency_subCompetency table
│       └── Subcompetency (e.g., "Frontend Development")
│           └── competency_subCompetency table
│               └── Core Competency / Last-level (e.g., "React Framework", core-competency: true)
│                   │
│                   └── competency_skill table (links last-level competency → Skills)
│                       │
│                       └── skills table
│                           ├── Skill L2 (linked to core competency)
│                           │   │
│                           │   └── skill_subSkill table (parent_skill_id → child_skill_id)
│                           │       │
│                           │       └── Skill L3 (parent_skill_id = L2_skill_id)
│                           │           │
│                           │           └── skill_subSkill table
│                           │               │
│                           │               └── Skill L4 / MGS (leaf, no children)
```

**Table Relationships:**
- `competency_subCompetency`: High-level Competency → Subcompetency → Core Competency (last-level)
- `competency_skill`: **Core Competency (last-level)** → **Skills** (L2, L3, MGS)
- `skill_subSkill`: Skill L2 → Skill L3 → ... → MGS
- `userCompetency`: User → Competency (stores coverage, proficiency level, verified MGS)

**Note:** Core competencies (last-level) are marked with `"core-competency": true` and never have subcompetencies. They act as the entry point to the skill hierarchy.

---

## Part 1: Understanding Competency Hierarchy and Adding MGS

### Competency Hierarchy Structure

The system supports a **multi-level competency hierarchy** that connects to a **skill hierarchy**:

```
High-level Competency (Level 1)
  └── Subcompetency (Level 2)
      └── Subcompetency (Level 3, optional - can have multiple levels)
          └── ... (can have more subcompetency levels)
              └── Core Competency (Last Level, marked with core-competency: true)
                  └── (linked via competency_skill table)
                      └── Skills (L2, L3, MGS)
                          └── Skill L2 (via skill_subSkill table)
                              └── Skill L3 (via skill_subSkill table)
                                  └── Skill L4/MGS (leaf node, no children)
```

**Key Points:**
- **High-level Competencies** are top-level (no parent)
- **Subcompetencies** can have multiple levels (Level 2, 3, 4, etc.) - linked via `competency_subCompetency` table
- **Core Competencies (Last Level)** are marked with `"core-competency": true` and have no subcompetencies
- **`competency_skill` table** links **core competencies (last-level)** to **Skills** (L2, L3, MGS)
- **Skills** have their own hierarchy via `skill_subSkill` table (L2 → L3 → MGS)
- **MGS** are leaf skills (no child skills) that get verified in assessments

**Note:** The competency hierarchy can have **any number of levels** (not limited to two). The depth depends on the domain complexity. Only the **last level** (core competency) links to skills.

**Example (3-level hierarchy):**
```
High-level: "Full Stack Development" (Level 1)
  └── Subcompetency: "Frontend Development" (Level 2)
      └── Core Competency / Last-level: "React Framework" (Level 3, core-competency: true)
          └── (competency_skill links last-level competency to skills)
              └── Skill L2: "React Hooks"
                  └── Skill L3 (MGS): "useState Hook" ✅ (leaf, verified in assessment)
                  └── Skill L3 (MGS): "useEffect Hook" ✅ (leaf, verified in assessment)
              └── Skill L2: "React Context"
                  └── Skill L3 (MGS): "Context API" ✅ (leaf, verified in assessment)
```

**Example (4-level hierarchy):**
```
High-level: "Software Engineering" (Level 1)
  └── Subcompetency: "Backend Development" (Level 2)
      └── Subcompetency: "Database Management" (Level 3)
          └── Core Competency / Last-level: "PostgreSQL" (Level 4, core-competency: true)
              └── (competency_skill links last-level competency to skills)
                  └── Skill L2: "Query Optimization"
                      └── Skill L3 (MGS): "Index Creation" ✅
                  └── Skill L2: "Data Modeling"
                      └── Skill L3 (MGS): "Schema Design" ✅
```

**Important:** The `competency_skill` junction table links:
- `competency_id` → **Core Competency (last-level)** (marked with `"core-competency": true`, no subcompetencies)
- `skill_id` → **Skills** (L2, L3, MGS - skills start from L2, not L1)

**Note:** Based on the Career Path Hierarchy feature:
- **High-level Competency**: Top-level (e.g., "Full Stack Development")
- **Subcompetencies**: Can have multiple levels (Level 2, 3, 4, etc.) - linked via `competency_subCompetency` table
- **Core Competency (last-level)**: Leaf in competency hierarchy, marked with `"core-competency": true` (e.g., "React Framework")
- **Skills**: Start from L2, linked to core competencies via `competency_skill` table
- **The hierarchy depth is flexible** - can have 2, 3, 4, or more levels depending on domain complexity

## Part 1.1: Adding MGS to Competency

### Understanding MGS Structure

**MGS (Micro-Graduated Skills)** are the **leaf nodes** in the skill hierarchy - the most granular skills that have no children.

**Note:** Competencies have a **multi-level hierarchy structure** (High-level → Subcompetency → ... → Core Competency), and skills are linked to the last-level (core) competencies.

```
High-level Competency: "Full Stack Development"
  └── Subcompetency: "Frontend Development"
      └── Core Competency / Last-level: "React Framework" (core-competency: true)
          └── (competency_skill table links last-level competency to skills)
              └── Skill L2: "React Hooks"
                  └── Skill L3 (MGS): "useState Hook" ✅
                  └── Skill L3 (MGS): "useEffect Hook" ✅
              └── Skill L2: "React Context API"
                  └── Skill L3 (MGS): "Context API" ✅
              └── Skill L2: "React Router"
                  └── Skill L3 (MGS): "Route Configuration" ✅
```

**Structure (based on Career Path Hierarchy feature):**
- **High-level Competency**: Top-level competency (e.g., "Full Stack Development")
- **Subcompetency**: Child of high-level (e.g., "Frontend Development")
- **Core Competency (last-level)**: Leaf in competency hierarchy, marked with `"core-competency": true` (e.g., "React Framework")
- **`competency_skill` table**: Links **core competency (last-level)** → **Skills** (L2, L3, MGS)
- **Skills**: Start from L2, linked to core competencies
- **Skill Hierarchy**: L2 → L3 → ... → MGS (via `skill_subSkill` table)
- **MGS**: Leaf skills (no child skills) - these are what get verified in assessments

### Method 1: Link Existing Skills to Competency

If skills already exist in the database:

```javascript
const competencyService = require('./services/competencyService');
const skillRepository = require('./repositories/skillRepository');
const competencyRepository = require('./repositories/competencyRepository');

// 1. Find or create the parent competency
const parentCompetency = await competencyRepository.findByName('Full Stack Development');

// 2. Find or create subcompetency (child of high-level)
let subCompetency = await competencyRepository.findByName('Frontend Development');
if (!subCompetency) {
  subCompetency = await competencyService.createCompetency({
    competency_name: 'Frontend Development',
    description: 'Frontend development subcompetency',
    parent_competency_id: null // Will be linked via competency_subCompetency table
  });
  // Link subcompetency to high-level via competency_subCompetency
  await competencyService.linkSubCompetency(parentCompetency.competency_id, subCompetency.competency_id);
}

// 3. Find or create core competency (last-level, marked with core-competency: true)
// IMPORTANT: This is the LAST LEVEL in competency hierarchy, acts as entry point to skills
let coreCompetency = await competencyRepository.findByName('React Framework');
if (!coreCompetency) {
  coreCompetency = await competencyService.createCompetency({
    competency_name: 'React Framework',
    description: 'React framework core competency',
    parent_competency_id: null, // Will be linked via competency_subCompetency table
    source: 'career_path_ai' // Mark as core competency
  });
  // Link core competency to subcompetency via competency_subCompetency
  await competencyService.linkSubCompetency(subCompetency.competency_id, coreCompetency.competency_id);
}

// 4. Link skills to core competency (last-level) via competency_skill table
// IMPORTANT: competency_skill links core competency (last-level) → Skills (L2, L3, MGS)

// 5. Create skills linked to the "L1" competency (skills start from L2)
const l2Skill = await skillRepository.create({
  skill_name: 'React Hooks',
  description: 'React Hooks skills',
  parent_skill_id: null // L2 skill, but linked to competency
});

// Link L2 skill to the "L1" competency
await competencyService.linkSkill(l1Competency.competency_id, l2Skill.skill_id);

// 6. Create sub-skills and MGS in skill hierarchy
const l3Skill = await skillRepository.create({
  skill_name: 'useState Hook',
  description: 'Understanding useState hook',
  parent_skill_id: l2Skill.skill_id // MGS (leaf node)
});
```

### Method 2: Create New Competencies and Skills, Then Link

If you need to create new competencies and skills:

```javascript
const skillRepository = require('./repositories/skillRepository');
const competencyService = require('./services/competencyService');
const competencyRepository = require('./repositories/competencyRepository');

// 1. Create or find parent competency
let parentCompetency = await competencyRepository.findByName('Full Stack Development');
if (!parentCompetency) {
  parentCompetency = await competencyService.createCompetency({
    competency_name: 'Full Stack Development',
    description: 'Full stack development competencies',
    parent_competency_id: null // Parent competency
  });
}

// 2. Create subcompetency (child of high-level)
let subCompetency = await competencyRepository.findByName('Frontend Development');
if (!subCompetency) {
  subCompetency = await competencyService.createCompetency({
    competency_name: 'Frontend Development',
    description: 'Frontend development subcompetency',
    parent_competency_id: null // Will be linked via competency_subCompetency table
  });
  // Link subcompetency to high-level via competency_subCompetency
  await competencyService.linkSubCompetency(parentCompetency.competency_id, subCompetency.competency_id);
}

// 3. Create core competency (last-level, marked with core-competency: true)
// IMPORTANT: This is the LAST LEVEL in competency hierarchy, acts as entry point to skills
let coreCompetency = await competencyRepository.findByName('React Framework');
if (!coreCompetency) {
  coreCompetency = await competencyService.createCompetency({
    competency_name: 'React Framework',
    description: 'React framework core competency',
    parent_competency_id: null, // Will be linked via competency_subCompetency table
    source: 'career_path_ai' // Mark as core competency
  });
  // Link core competency to subcompetency via competency_subCompetency
  await competencyService.linkSubCompetency(subCompetency.competency_id, coreCompetency.competency_id);
}

// 4. Create skills linked to the core competency (last-level) - skills start from L2
const l2Skill = await skillRepository.create({
  skill_name: 'React Hooks',
  description: 'React Hooks skills',
  parent_skill_id: null // L2 skill, linked to core competency
});

// Link L2 skill to the core competency (last-level) via competency_skill table
await competencyService.linkSkill(coreCompetency.competency_id, l2Skill.skill_id);

// 6. Create sub-skills and MGS in skill hierarchy
const l3Skill = await skillRepository.create({
  skill_name: 'useState Hook',
  description: 'Understanding useState hook',
  parent_skill_id: l2Skill.skill_id // MGS (leaf node)
});
```

### Method 3: Get All Required MGS for a Competency

To see all MGS currently linked to a competency:

```javascript
const competencyService = require('./services/competencyService');

const competencyId = 'your-competency-id';
const requiredMGS = await competencyService.getRequiredMGS(competencyId);

console.log(`Competency has ${requiredMGS.length} required MGS:`);
requiredMGS.forEach(mgs => {
  console.log(`- ${mgs.skill_name} (${mgs.skill_id})`);
});
```

**Note:** `getRequiredMGS()` automatically:
- Gets skills linked to the core competency (last-level) via `competency_skill` table
- Traverses skill hierarchy from each skill (L2 → L3 → MGS) to find all MGS (leaf nodes)
- If competency has subcompetencies, recursively gets MGS from child core competencies too
- Returns a deduplicated list of all MGS required for the competency

**Important:** The flow is:
1. **Core Competency (last-level)** is linked to **Skills** (L2, L3, MGS) via `competency_skill` table
2. **Skills** have their own hierarchy (L2 → L3 → MGS) via `skill_subSkill` table
3. **MGS** are collected by traversing the skill hierarchy from skills linked to the core competency down to leaf nodes
4. When high-level competencies have subcompetencies, MGS are aggregated from all child core competencies

---

## Part 2: Updating UserCompetency from Assessment Results

### Assessment Result Payload Structure

#### Baseline Exam Payload

When Assessment MS sends baseline exam results, the payload looks like:

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "exam_type": "baseline",
  "exam_status": "pass",
  "final_grade": 85,
  "skills": [
    {
      "skill_id": "skill_123",
      "skill_name": "React Hooks",
      "score": 90,
      "status": "pass"
    },
    {
      "skill_id": "skill_456",
      "skill_name": "React Context API",
      "score": 75,
      "status": "pass"
    },
    {
      "skill_id": "skill_789",
      "skill_name": "React Router",
      "score": 50,
      "status": "fail"
    }
  ]
}
```

#### Post-Course Exam Payload

When Assessment MS sends post-course exam results (after user finishes a course), the payload includes:

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "exam_type": "post-course",
  "course_name": "React Fundamentals Course",
  "exam_status": "pass",  // or "fail"
  "final_grade": 85,
  "skills": [
    {
      "skill_id": "skill_123",
      "skill_name": "React Hooks",
      "score": 90,
      "status": "pass"
    },
    {
      "skill_id": "skill_456",
      "skill_name": "React Context API",
      "score": 75,
      "status": "pass"
    }
    // Note: Only skills with status "pass" are included in post-course exam results
  ]
}
```

**Key Differences:**
- **Post-course exam** includes `course_name` field
- **Post-course exam** only includes skills with `status: "pass"` in the `verified_skills` array
- **Baseline exam** may include both "pass" and "fail" status skills

### Processing Flow

**Summary:** The system receives exam feedback (baseline or post-course) from Assessment MS, looks inside `userCompetency` to find competencies related to the user, and for each verified MGS:
1. Finds which competency the MGS belongs to (based on which competency has that skill linked)
2. Adds the MGS to that competency's `verifiedSkills` JSON array
3. Calculates the coverage percentage for that competency
4. Updates the proficiency level of that competency

The system processes assessment results through `verificationService.processBaselineExamResults()` or `processPostCourseExamResults()`:

#### Step 1: Normalize and Filter MGS

```javascript
// Only leaf skills (MGS) with status "pass" are persisted in verifiedSkills
const normalizeVerifiedSkill = async (rawSkill) => {
  const { skill_id, skill_name, score, status } = rawSkill;
  
  // Only process MGS with status "pass"
  if (status !== "pass") {
    return null; // Skip MGS that did not pass
  }
  
  // Check if skill is a leaf (MGS)
  const isLeaf = await skillRepository.isLeaf(skill_id);
  if (!isLeaf) {
    return null; // Skip non-MGS skills
  }
  
  return {
    skill_id,
    skill_name,
    verified: true // Only MGS with status "pass" are added
  };
};
```

#### Step 2: Find Competencies for Each Skill

```javascript
// For each verified skill, find which competencies require it
// IMPORTANT: Only finds EXISTING competencies - does NOT create new ones
// This finds both parent and child competencies that have this skill linked
const competencies = await competencyService.getCompetenciesBySkill(skill_id);
```

**Note:** When an MGS is verified, the system:
- Finds which **existing** competencies require this MGS by:
  1. Finding the skill that contains this MGS (by traversing skill hierarchy up)
  2. Finding which core competency (last-level) has that skill linked via `competency_skill` table
  3. Finding which subcompetency is linked to that core competency via `competency_subCompetency` table
  4. **Finding parent competencies** linked to the subcompetency via `competency_subCompetency` table (traversing up the hierarchy)
- **Does NOT create new competencies or skills** - only creates/updates `userCompetency` records (user-competency relationships)
- **May create new `userCompetency` records** if the user didn't have that competency before
- Updates `userCompetency.verifiedSkills` JSON array for each found competency (including parent competencies)
- **Also updates parent competencies** if the user owns them - recalculates parent coverage by aggregating from all child competencies

**Example:**
- MGS "useState Hook" is verified in assessment with `status: "pass"`
- System filters: only processes MGS with status "pass" (MGS with status "fail" are skipped)
- System finds skill "React Hooks" (parent of "useState Hook")
- System finds core competency "React Framework" (last-level) that has "React Hooks" skill linked via `competency_skill`
- System finds subcompetency "Frontend Development" linked to "React Framework" via `competency_subCompetency`
- System finds parent competency "Full Stack Development" linked to "Frontend Development" via `competency_subCompetency` (traversing up)
- **For "React Framework" (core competency)**:
  - **If the user already has this competency** (userCompetency record exists):
    - Adds MGS "useState Hook" to `userCompetency.verifiedSkills` JSON array (only MGS with status "pass" are added)
    - **Recalculates `coverage_percentage`** based on verified MGS vs total required MGS
    - **Updates `proficiency_level`** based on the new coverage percentage
    - Updates the `userCompetency` record in the database
  - **If the user doesn't have this competency yet** (no userCompetency record exists):
    - **Creates a new `userCompetency` record** for this user-competency relationship
    - Initializes with `coverage_percentage: 0.00`, `proficiency_level: 'undefined'` (undefined initially), `verifiedSkills: []`
    - Adds MGS "useState Hook" to the new `userCompetency.verifiedSkills` JSON array
    - **Recalculates `coverage_percentage`** based on verified MGS vs total required MGS
    - **Determines `proficiency_level`** based on the new coverage percentage (first time set after baseline exam)
    - Saves the new `userCompetency` record to the database
- **For "Frontend Development" (subcompetency)** - if user owns it:
  - Updates `userCompetency.verifiedSkills` JSON array (if applicable)
  - **Recalculates `coverage_percentage`** by aggregating from all child competencies (including "React Framework")
  - **Updates `proficiency_level`** based on the new coverage percentage
- **For "Full Stack Development" (parent competency)** - if user owns it:
  - **Recalculates `coverage_percentage`** by aggregating from all child competencies (including "Frontend Development")
  - **Updates `proficiency_level`** based on the new coverage percentage
  - Updates the `userCompetency` record in the database

**Important:** 
- The system **may add new competencies** to the user by creating new `userCompetency` records (user-competency relationships)
- The competency itself must already exist in the `competencies` table - the system does NOT create new competencies or skills
- Only MGS with `status: "pass"` are added to the `verifiedSkills` JSON array
- MGS with `status: "fail"` are not added to the JSON and do not count toward coverage
- The system automatically calculates coverage and updates the proficiency level for **all competencies** (existing or newly created userCompetency records) that require the verified MGS
- **Parent competencies are also updated** if the user owns them - the system finds parent competencies via `competency_subCompetency` table and recalculates their coverage by aggregating from all child competencies
- **Parent competencies are also updated** if the user owns them - the system finds parent competencies via `competency_subCompetency` table and recalculates their coverage by aggregating from all child competencies

#### Step 3: Add MGS to UserCompetency.verifiedSkills JSON

```javascript
// Get existing userCompetency or create new one if it doesn't exist
// This may add a new competency to the user if they didn't have it before
let userComp = await userCompetencyRepository.findByUserAndCompetency(
  userId,
  competency.competency_id
);

if (!userComp) {
  // Create new userCompetency record if user doesn't have this competency yet
  // This adds a new competency to the user (user-competency relationship)
  // IMPORTANT: The competency itself must already exist in the competencies table
  userComp = await userCompetencyRepository.create({
    user_id: userId,
    competency_id: competency.competency_id, // Competency must already exist
    coverage_percentage: 0.00,
    proficiency_level: 'undefined', // Initially undefined - will be determined after baseline exam
    verifiedSkills: []
  });
}

// Add MGS to verifiedSkills array (does NOT create new skills)
const verifiedSkills = userComp.verifiedSkills || [];
const existingIndex = verifiedSkills.findIndex(s => s.skill_id === skill_id);

const verifiedSkillData = {
  skill_id,      // Skill must already exist in skills table
  skill_name,
  verified: true // Only MGS with status "pass" are added to JSON
};

if (existingIndex >= 0) {
  verifiedSkills[existingIndex] = verifiedSkillData; // Update existing MGS entry
} else {
  verifiedSkills.push(verifiedSkillData); // Add new MGS entry to JSON array
}
```

**Important:** 
- This step **may create a new `userCompetency` record** if the user didn't have this competency before (adds new competency to user)
- This step **adds MGS entries to the JSON array** - it does NOT create new skills or competencies
- The `skill_id` must already exist in the `skills` table
- The `competency_id` must already exist in the `competencies` table
- The system creates the `userCompetency` record (user-competency relationship) if it doesn't exist, then adds the MGS

#### Step 4: Recalculate Coverage Percentage

```javascript
async calculateCoverage(userId, competencyId) {
  // Get all required MGS for this EXISTING competency
  // Does NOT create new competencies or skills - only reads existing data
  const requiredMGS = await competencyService.getRequiredMGS(competencyId);
  const requiredCount = requiredMGS.length;
  
  if (requiredCount === 0) {
    return 0;
  }
  
  // Get verified skills from existing userCompetency
  const userComp = await userCompetencyRepository.findByUserAndCompetency(
    userId,
    competencyId
  );
  
  if (!userComp) {
    return 0;
  }
  
  // Count verified MGS from the JSON array
  const verifiedSkills = userComp.verifiedSkills || [];
  const verifiedCount = verifiedSkills.filter(s => s.verified === true).length;
  
  // Calculate percentage: (verified / required) * 100
  return Math.round((verifiedCount / requiredCount) * 100 * 100) / 100;
}
```

**How the system finds required MGS for a competency (e.g., "React.js"):**

1. **Finds the competency** (e.g., "React.js" - this is the core competency/last-level)
2. **Finds all skills linked to this competency** via `competency_skill` table (these are L2 skills)
3. **Traverses the skill hierarchy down** from each L2 skill:
   - L2 Skill → L3 Skills (via `skill_subSkill` table)
   - L3 Skill → L4 Skills (via `skill_subSkill` table)
   - ... continues until reaching leaf nodes (MGS)
4. **Collects all leaf skills (MGS)** that have no children - these are the required MGS
5. **Returns the list of required MGS** for the competency

**Example for "React.js" competency:**
```
React.js (Core Competency)
  └── competency_skill table links to:
      ├── Skill L2: "React Hooks"
      │   └── skill_subSkill table links to:
      │       ├── Skill L3 (MGS): "useState Hook" ✅ (leaf, no children)
      │       ├── Skill L3 (MGS): "useEffect Hook" ✅ (leaf, no children)
      │       └── Skill L3 (MGS): "useContext Hook" ✅ (leaf, no children)
      ├── Skill L2: "React Context"
      │   └── skill_subSkill table links to:
      │       └── Skill L3 (MGS): "Context API" ✅ (leaf, no children)
      └── Skill L2: "React Router"
          └── skill_subSkill table links to:
              └── Skill L3 (MGS): "Route Configuration" ✅ (leaf, no children)

Required MGS for "React.js": 5 MGS total
```

**Then for coverage calculation:**
1. **Gets required MGS** from the competency structure (e.g., 5 MGS for "React.js")
2. **Gets verified MGS** from `userCompetency.verifiedSkills` JSON array (e.g., user has 3 verified MGS)
3. **Calculates**: (3 verified / 5 required) × 100 = 60% coverage

**Important:** This step only **reads existing data** and **calculates** the coverage percentage. It does NOT create any new competencies or skills.

**Formula:**
```
Coverage Percentage = (Verified MGS Count / Total Required MGS Count) × 100
```

#### Step 5: Map Coverage to Proficiency Level

```javascript
mapCoverageToProficiency(coverage) {
  if (coverage >= 80) return 'EXPERT';
  if (coverage >= 60) return 'ADVANCED';
  if (coverage >= 40) return 'INTERMEDIATE';
  if (coverage >= 0) return 'BEGINNER';  // 0% to 39%
  return 'BEGINNER'; // Default to BEGINNER (should not reach here)
}
```

**Mapping:**
- **EXPERT**: 80-100%
- **ADVANCED**: 60-79%
- **INTERMEDIATE**: 40-59%
- **BEGINNER**: 0-39%

#### Step 6: Update Database

```javascript
// Update existing userCompetency record
// Does NOT create new competencies or skills - only updates existing userCompetency
await userCompetencyRepository.update(userId, competency.competency_id, {
  verifiedSkills: verifiedSkills,        // Updated JSON array with added MGS
  coverage_percentage: coverage,         // Recalculated percentage
  proficiency_level: proficiencyLevel   // Mapped level
});

// After updating the competency, also update parent competencies if user owns them
// Find parent competencies via competency_subCompetency table (traversing up)
const findParentCompetencies = async (competencyId) => {
  const parents = [];
  let currentCompetencyId = competencyId;
  
  // Traverse up the hierarchy to find all parent competencies
  while (currentCompetencyId) {
    // Find parent via competency_subCompetency table
    const { data: parentLinks } = await competencyRepository.getClient()
      .from('competency_subCompetency')
      .select('parent_competency_id')
      .eq('child_competency_id', currentCompetencyId)
      .limit(1)
      .single();
    
    if (parentLinks && parentLinks.parent_competency_id) {
      const parent = await competencyRepository.findById(parentLinks.parent_competency_id);
      if (parent) {
        parents.push(parent);
        currentCompetencyId = parent.competency_id;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return parents;
};

// Update parent competencies
const parentCompetencies = await findParentCompetencies(competency.competency_id);
for (const parent of parentCompetencies) {
  // Check if user owns this parent competency
  const parentUserComp = await userCompetencyRepository.findByUserAndCompetency(
    userId,
    parent.competency_id
  );
  
  if (parentUserComp) {
    // Recalculate parent coverage by aggregating from all child competencies
    const parentCoverage = await this.calculateParentCoverage(userId, parent.competency_id);
    const parentProficiencyLevel = this.mapCoverageToProficiency(parentCoverage);
    
    // Update parent userCompetency
    await userCompetencyRepository.update(userId, parent.competency_id, {
      coverage_percentage: parentCoverage,
      proficiency_level: parentProficiencyLevel
    });
  }
}
```

**Important:** This step:
- **Updates the existing `userCompetency` record** for the competency directly linked to the skill
- **Also updates parent competencies** if the user owns them:
  - Finds parent competencies via `competency_subCompetency` table (traversing up the hierarchy)
  - Recalculates parent `coverage_percentage` by aggregating from all child competencies
  - Updates parent `proficiency_level` based on the new coverage
- It does NOT:
  - Create new competencies
  - Create new skills
  - Modify the competency or skill structure

It updates:
- The `verifiedSkills` JSON array (adds/updates MGS entries) - for the competency directly linked to the skill
- The `coverage_percentage` (recalculated based on verified MGS / total required MGS) - for both the competency and its parents
- The `proficiency_level` (determined from coverage: BEGINNER, INTERMEDIATE, ADVANCED, or EXPERT - first time set after baseline exam if it was `undefined`) - for both the competency and its parents

**Key Point:** For each competency that requires the verified MGS:
1. **If userCompetency record exists**: Updates it with the new MGS
2. **If userCompetency record doesn't exist**: Creates a new one (adds the competency to the user), then adds the MGS
3. **Adds the verified MGS** to the `verifiedSkills` JSON array
4. **Automatically recalculates** the `coverage_percentage`
5. **Determines `proficiency_level`** based on the new coverage (first time set after baseline exam if it was `'undefined'`)
6. **Saves all updates** to the database

**Note:** When `userCompetency` is initially created from Directory raw data extraction, `proficiency_level` is `'undefined'`. The proficiency level is **first determined after the baseline exam** based on assessment results.

---

## Complete Example: End-to-End Flow

### Scenario: User takes baseline exam for "Full Stack Development"

**Initial State:**
- Competency: "Full Stack Development" **already exists** with 10 required MGS
- All skills (MGS) **already exist** in the skills table
- UserCompetency: `coverage_percentage: 0%`, `proficiency_level: undefined` (undefined - extracted from Directory raw data), `verifiedSkills: []`

**Assessment Results:**
- User passes 7 out of 10 MGS (all MGS must already exist in the system)

**Processing:**

```javascript
// 1. Assessment MS sends results
// NOTE: All skill_id values must already exist in the skills table
const examResults = {
  user_id: "user-123",
  exam_type: "baseline",
  verified_skills: [
    { skill_id: "skill_1", skill_name: "React Hooks", status: "pass" }, // Skill already exists
    { skill_id: "skill_2", skill_name: "React Context", status: "pass" }, // Skill already exists
    // ... 5 more passed
    { skill_id: "skill_8", skill_name: "Node.js Async", status: "fail" }, // Skill already exists
    { skill_id: "skill_9", skill_name: "Database Design", status: "fail" }, // Skill already exists
    { skill_id: "skill_10", skill_name: "API Design", status: "fail" } // Skill already exists
  ]
};

// 2. Process results (does NOT create new competencies or skills)
await verificationService.processBaselineExamResults("user-123", examResults);

// 3. System updates EXISTING userCompetency:
// - For "Full Stack Development" (directly linked competency):
//   - verifiedSkills: [7 verified MGS entries with status "pass" added to JSON array]
//     (MGS with status "fail" are NOT added to the JSON)
//   - coverage_percentage: (7/10) * 100 = 70% (recalculated, only counts MGS with status "pass")
//   - proficiency_level: "ADVANCED" (70% >= 60%, mapped from coverage)
// - For parent competencies (if user owns them):
//   - coverage_percentage: Recalculated by aggregating from all child competencies
//   - proficiency_level: Updated based on the new aggregated coverage
```

**Final State:**
- `coverage_percentage: 70.00`
- `proficiency_level: "ADVANCED"`
- `verifiedSkills: [{ skill_id: "skill_1", skill_name: "React Hooks", verified: true }, ...]`

---

## API Endpoints

### Receive Assessment Results

**POST** `/api/assessment/baseline-exam-results` or `/api/assessment/post-course-exam-results`

**Handler:** `backend/src/handlers/assessment/index.js`

#### Baseline Exam Request Body:
```json
{
  "user_id": "uuid",
  "exam_type": "baseline",
  "exam_status": "pass",
  "skills": [
    {
      "skill_id": "skill_id",
      "skill_name": "Skill Name",
      "score": 85,
      "status": "pass"
    }
  ]
}
```

#### Post-Course Exam Request Body:
```json
{
  "user_id": "uuid",
  "exam_type": "post-course",
  "course_name": "React Fundamentals Course",
  "exam_status": "pass",  // or "fail"
  "skills": [
    {
      "skill_id": "skill_id",
      "skill_name": "Skill Name",
      "score": 85,
      "status": "pass"
    }
  ]
  // Note: Only skills with status "pass" are included in post-course exam results
}
```

**Important:** 
- Post-course exam includes `course_name` field to identify which course the exam is for
- Post-course exam `skills` (or `verified_skills`) array only contains skills with `status: "pass"` (failed skills are not included)
- Both exam types use the same processing logic to update `userCompetency` records

**Response:**
```json
{
  "status": "success",
  "message": "Exam results processed successfully",
  "data": {
    "userId": "uuid",
    "updated_competencies": ["competency_id_1", "competency_id_2"],
    "verified_skills_count": 7
  }
}
```

---

## Key Points to Remember

1. **The assessment process does NOT create new competencies or skills** - it only creates/updates `userCompetency` records (user-competency relationships)
2. **The system may add new competencies to the user** by creating new `userCompetency` records if the user didn't have that competency before
3. **Only MGS (leaf skills) with `status: "pass"` are stored in `verifiedSkills`** - Non-leaf skills and MGS with `status: "fail"` are filtered out
4. **MGS with status "pass" are added to the `verifiedSkills` JSON array** - the skills themselves must already exist
5. **Coverage is calculated as: `(Verified MGS / Total Required MGS) × 100`** - only counts MGS with status "pass"
6. **Proficiency level is determined from coverage percentage** - initially `undefined` when extracted from Directory raw data, then set after baseline exam
7. **If a `userCompetency` record doesn't exist, it will be created** (user-competency relationship), adding that competency to the user, but the competency itself must already exist in the `competencies` table
8. **Parent competencies are also updated** if the user owns them - the system finds parent competencies via `competency_subCompetency` table, recalculates parent coverage by aggregating from all child competencies, and updates parent proficiency level
9. **Both baseline and post-course exams use the same processing logic** - the difference is:
   - **Baseline exam**: May include skills with both "pass" and "fail" status
   - **Post-course exam**: Includes `course_name`, `exam_status` (pass/fail), and only includes skills with `status: "pass"` in the request (failed skills are not sent)
10. **Competencies and skills must be created before assessment processing** (via Career Path Hierarchy feature or manual creation)

---

## Adding New MGS After Assessment

If you need to add new MGS to a competency **after** users have already been assessed:

1. **Add the new MGS to the competency** (using methods in Part 1)
2. **Recalculate coverage for all affected users:**

```javascript
const userCompetencyRepository = require('./repositories/userCompetencyRepository');
const verificationService = require('./services/verificationService');

// Get all users with this competency
const userCompetencies = await userCompetencyRepository.findByCompetency(competencyId);

// Recalculate for each user
for (const userComp of userCompetencies) {
  const newCoverage = await verificationService.calculateCoverage(
    userComp.user_id,
    competencyId
  );
  const newLevel = verificationService.mapCoverageToProficiency(newCoverage);
  
  await userCompetencyRepository.update(userComp.user_id, competencyId, {
    coverage_percentage: newCoverage,
    proficiency_level: newLevel
  });
}
```

**Note:** Adding new MGS will **decrease** coverage percentage for existing users (since denominator increases), but their verified skills remain unchanged.

---

## Database Schema Reference

### `userCompetency` Table

```sql
CREATE TABLE userCompetency (
    user_id UUID NOT NULL,
    competency_id UUID NOT NULL,
    coverage_percentage DECIMAL(5,2) DEFAULT 0.00,  -- 0.00 to 100.00
    proficiency_level VARCHAR(50),                   -- BEGINNER, INTERMEDIATE, ADVANCED, or EXPERT
    verifiedSkills JSONB DEFAULT '[]'::jsonb,        -- Array of { skill_id, skill_name, verified }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, competency_id)
);
```

### `verifiedSkills` JSON Structure

```json
[
  {
    "skill_id": "uuid",
    "skill_name": "React Hooks",
    "verified": true
  },
  {
    "skill_id": "uuid",
    "skill_name": "React Context API",
    "verified": false
  }
]
```

---

## Troubleshooting

### Coverage percentage not updating?
- Check that skills in assessment results are **MGS (leaf nodes)**
- Verify `competencyService.getRequiredMGS()` returns the expected MGS
- Ensure `verifiedSkills` array is being updated correctly

### Proficiency level is BEGINNER with 0% coverage?
- This is expected behavior - BEGINNER covers 0-39% coverage
- If you want to distinguish 0% from other BEGINNER levels, you may need to add additional logic

### New MGS not appearing in coverage calculation?
- Ensure MGS is linked to competency via `competency_skills` table
- Verify MGS is a leaf node (no children)
- Check `getRequiredMGS()` includes the new MGS

