# Gap Analysis Fix for Failed Post-Course Exams

## Problem Statement

Currently, when a user **fails a post-course exam**, the gap analysis calculates gaps for **all career-path competencies**, regardless of whether those competencies were part of the course or not.

### Current Behavior (Incorrect)

**Scenario:**
- User's career path includes: `["Full Stack Development", "Data Analysis"]`
- Course covers: `["Full Stack Development", "Cloud Security"]`
  - "Full Stack Development" is in career path ✅
  - "Cloud Security" is NOT in career path ❌
- Post-course exam status: `"failed"`
- Updated competencies from exam: `["Full Stack Development", "Cloud Security"]`

**Current Result:**
- Gap analysis shows: `["Full Stack Development", "Data Analysis"]`
- ❌ **Problem 1:** "Data Analysis" appears in gap even though it was NOT part of this course
- ❌ **Problem 2:** "Cloud Security" does NOT appear in gap even though it WAS part of this course

### Desired Behavior (Correct)

**Same Scenario:**
- Post-course exam status: `"failed"`
- Updated competencies from exam: `["Full Stack Development", "Cloud Security"]`

**Desired Result:**
- Gap analysis shows: `["Full Stack Development", "Cloud Security"]`
- ✅ Only competencies that were **updated by this exam** appear in the gap
- ✅ Includes course competencies even if they're **not in the career path**

## Root Cause

In `verificationService.js`, the `runGapAnalysis()` method currently:

1. For **baseline exams** → Uses all career-path competencies ✅ (correct)
2. For **post-course PASS** → Uses all career-path competencies ✅ (correct)
3. For **post-course FAIL** → Uses all career-path competencies ❌ (incorrect - should use only updated competencies)

The code at lines 1136-1147 always calls `calculateCareerPathGap(userId)`, which fetches **all** career-path competencies from the `user_career_path` table, ignoring the `updatedCompetencies` parameter.

## Solution

### Overview

For **post-course + failed** exams, change the gap calculation to:
- Use `updatedCompetencies` (Set of competency IDs that were updated during exam processing)
- Calculate gaps **only for those specific competencies**
- This automatically includes **both types** of competencies that were in the course:
  - ✅ Career-path competencies that were in the course (e.g., "Full Stack Development")
  - ✅ Non-career-path competencies that were in the course (e.g., "Cloud Security")

### Changes Required

#### 1. Add New Method to `gapAnalysisService.js`

**File:** `backend/src/services/gapAnalysisService.js`

**Action:** Add a new method `calculateGapForCompetencies(userId, competencyIds)`

**Purpose:** Calculate gap analysis for a specific set of competency IDs (instead of all career-path competencies)

**Method Signature:**
```javascript
/**
 * Calculate gap analysis for specific competencies
 * @param {string} userId - User ID
 * @param {Array<string>} competencyIds - Array of competency IDs to calculate gaps for
 * @returns {Promise<Object>} Simple gap structure: { "Competency Name": [{ skill_id, skill_name }] }
 */
async calculateGapForCompetencies(userId, competencyIds = [])
```

**Logic:**
- Same as `calculateCareerPathGap()` but:
  - Instead of fetching all career paths from `user_career_path` table
  - Takes an explicit array of `competencyIds` as input
  - Iterates through those specific competencies only
  - For each competency: gets required MGS → finds missing skills → adds to gaps object

**Location:** Add after `calculateCareerPathGap()` method (after line 253)

---

#### 2. Modify `runGapAnalysis()` in `verificationService.js`

**File:** `backend/src/services/verificationService.js`

**Action:** Change the gap calculation logic for failed post-course exams

**Current Code (lines 1136-1147):**
```javascript
} else {
  console.log('[VerificationService.runGapAnalysis] Step 3: Calling calculateCareerPathGap for all career path competencies', {
    userId,
    careerPathCount: careerPaths.length,
    analysisType
  });
  // Always calculate gap analysis for all career path competencies
  const allCareerPathGaps = await gapAnalysisService.calculateCareerPathGap(userId);

  // Both broad and narrow analysis return all career path gaps
  // Narrow analysis still shows all missing skills in career path competencies
  gaps = allCareerPathGaps;
  // ... logging ...
}
```

**New Code:**
```javascript
} else {
  if (normalizedExamType === 'postcourse' && normalizedExamStatus === 'failed') {
    // NARROW: Only calculate gaps for competencies updated by this exam
    const targetCompetencyIds = Array.from(updatedCompetencies || []);
    console.log('[VerificationService.runGapAnalysis] Step 3: Calling calculateGapForCompetencies for updated competencies only', {
      userId,
      updatedCompetencyCount: targetCompetencyIds.length,
      updatedCompetencyIds: targetCompetencyIds.slice(0, 10)
    });
    
    if (targetCompetencyIds.length > 0) {
      gaps = await gapAnalysisService.calculateGapForCompetencies(userId, targetCompetencyIds);
    } else {
      console.log('[VerificationService.runGapAnalysis] Step 3: No updated competencies - returning empty gap');
      gaps = {};
    }
  } else {
    // BASELINE or POST-COURSE PASS: Calculate gaps for all career path competencies
    console.log('[VerificationService.runGapAnalysis] Step 3: Calling calculateCareerPathGap for all career path competencies', {
      userId,
      careerPathCount: careerPaths.length,
      analysisType
    });
    gaps = await gapAnalysisService.calculateCareerPathGap(userId);
  }
  
  // ... logging ...
}
```

**Key Changes:**
- Add conditional check: `if (normalizedExamType === 'postcourse' && normalizedExamStatus === 'failed')`
- For failed post-course: Convert `updatedCompetencies` Set to Array and pass to new method
- For baseline/passed post-course: Keep existing behavior (all career-path competencies)

---

## Behavior Summary After Fix

| Exam Type | Exam Status | Gap Analysis Scope |
|-----------|-------------|-------------------|
| Baseline | N/A | All career-path competencies |
| Post-course | PASS | All career-path competencies |
| Post-course | FAIL | **Only updated competencies** (from this exam) |

## Example Scenarios

### Scenario 1: Failed Post-Course with Mixed Competencies

**Setup:**
- Career path: `["Full Stack Development", "Data Analysis"]`
- Course: "Cloud Computing Basics"
- Course competencies: `["Full Stack Development", "Cloud Security"]`
  - ✅ "Full Stack Development" is **in career path AND in course**
  - ❌ "Cloud Security" is **NOT in career path BUT in course**
  - ❌ "Data Analysis" is **in career path BUT NOT in course**
- Exam status: `"failed"`
- Updated competencies: `["Full Stack Development", "Cloud Security"]`

**Gap Analysis Result:**
```json
{
  "Full Stack Development": [
    { "skill_id": "skill_123", "skill_name": "React Hooks" },
    { "skill_id": "skill_456", "skill_name": "State Management" }
  ],
  "Cloud Security": [
    { "skill_id": "skill_789", "skill_name": "IAM Policies" },
    { "skill_id": "skill_012", "skill_name": "Encryption" }
  ]
}
```

**Key Points:**
- ✅ "Full Stack Development" appears (career-path competency that was in the course)
- ✅ "Cloud Security" appears (non-career-path competency that was in the course)
- ❌ "Data Analysis" does NOT appear (career-path competency that was NOT in the course)

---

### Scenario 2: Passed Post-Course

**Setup:**
- Same as Scenario 1, but exam status: `"passed"`

**Gap Analysis Result:**
```json
{
  "Full Stack Development": [
    { "skill_id": "skill_123", "skill_name": "React Hooks" }
  ],
  "Data Analysis": [
    { "skill_id": "skill_999", "skill_name": "Statistical Analysis" }
  ]
}
```

**Note:** Shows ALL career-path competencies (existing behavior, unchanged).

---

### Scenario 3: Baseline Exam

**Setup:**
- Career path: `["Full Stack Development", "Data Analysis"]`
- Exam type: `"baseline"`

**Gap Analysis Result:**
```json
{
  "Full Stack Development": [
    { "skill_id": "skill_123", "skill_name": "React Hooks" },
    { "skill_id": "skill_456", "skill_name": "State Management" }
  ],
  "Data Analysis": [
    { "skill_id": "skill_999", "skill_name": "Statistical Analysis" }
  ]
}
```

**Note:** Shows ALL career-path competencies (existing behavior, unchanged).

---

## Files to Modify

1. **`backend/src/services/gapAnalysisService.js`**
   - Add new method: `calculateGapForCompetencies()`
   - Location: After `calculateCareerPathGap()` method (after line 253)

2. **`backend/src/services/verificationService.js`**
   - Modify `runGapAnalysis()` method
   - Location: Lines 1136-1147 (gap calculation logic)

## Testing Checklist

After implementation, verify:

- [ ] Failed post-course exam shows gaps only for updated competencies
- [ ] Failed post-course exam includes **both types** of course competencies in gaps:
  - [ ] Career-path competencies that are in the course (e.g., "Full Stack Development" from course)
  - [ ] Non-career-path competencies that are in the course (e.g., "Cloud Security" from course)
- [ ] Failed post-course exam excludes career-path competencies that were **NOT** in the course (e.g., "Data Analysis" not in course)
- [ ] Passed post-course exam still shows all career-path competencies (unchanged)
- [ ] Baseline exam still shows all career-path competencies (unchanged)
- [ ] Gap calculation logic (required MGS - verified skills) works correctly for both methods
- [ ] Empty `updatedCompetencies` returns empty gaps object
- [ ] Logging messages are clear and helpful

## Implementation Notes

- The `updatedCompetencies` parameter is already being passed to `runGapAnalysis()` from `processPostCourseExamResults()` (line 1000)
- The new method `calculateGapForCompetencies()` reuses the same gap calculation logic as `calculateCareerPathGap()`, just with a different source for competency IDs
- No database schema changes required
- No API contract changes required
- Backward compatible: baseline and passed post-course exams maintain existing behavior

