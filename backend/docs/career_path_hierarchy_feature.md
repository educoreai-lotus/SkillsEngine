# Career Path Competency Hierarchy Feature

## Overview

This feature automatically builds and persists competency hierarchies based on a user's career path. When a user joins the system (via Directory MS), the Skills Engine uses AI to generate a complete competency tree for their career path and saves it to the database **before** extracting skills from raw data.

---

## Feature Flow

```
1. Directory MS sends user data with path_career: "Backend Development"
                    ↓
2. Skills Engine receives onboarding request
                    ↓
3. AI generates competency hierarchy tree
   Backend Development
     ├── Database Management
     │   ├── SQL (core-competency)
     │   ├── PostgreSQL (core-competency)
     │   └── MongoDB (core-competency)
     └── Server-Side Programming
         ├── Node.js (core-competency)
         └── Python (core-competency)
                    ↓
4. Extract all nodes from tree
                    ↓
5. For each node:
   - Check if competency exists in database
   - If not, create new competency
   - Map to competency_id
                    ↓
6. Create parent-child relationships in competency_subcompetency table
                    ↓
7. Proceed with raw data extraction (existing flow)
```

---

## Key Concepts

### **Core Competencies**
- **Definition**: Leaf nodes in the hierarchy tree marked with `"core-competency": true`
- **Purpose**: These are high-level skills that serve as the foundation for the user's competency profile
- **Example**: In "Backend Development" → "Database Management" → "SQL", the "SQL" node is a core competency

### **Hierarchy Depth**
- The AI recursively expands competencies until reaching core competencies (leaves)
- Core competencies **never** have subcompetencies
- The depth varies based on the domain complexity

### **Idempotency**
- Running the feature multiple times for the same career path is safe
- Existing competencies are reused (not duplicated)
- New relationships are created only if they don't exist

---

## Database Schema

### Tables Used

#### `competencies`
```sql
competency_id          UUID PRIMARY KEY
competency_name        VARCHAR(500) UNIQUE
description            TEXT
parent_competency_id   UUID (nullable, legacy field - not used in this feature)
source                 VARCHAR(100) -- Set to 'career_path_ai'
created_at             TIMESTAMP
updated_at             TIMESTAMP
```

#### `competency_subcompetency` (Junction Table)
```sql
parent_competency_id   UUID REFERENCES competencies(competency_id)
child_competency_id    UUID REFERENCES competencies(competency_id)
created_at             TIMESTAMP
PRIMARY KEY (parent_competency_id, child_competency_id)
```

---

## API Integration

### Endpoint: `POST /api/user/onboard`

**Request Body:**
```json
{
  "user_id": "user-123",
  "user_name": "John Doe",
  "company_id": "company-456",
  "path_career": "Backend Development",
  "raw_data": "I have 5 years of experience in Node.js..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "userId": "user-123",
      "relevanceScore": 0,
      "competencies": [...]
    },
    "hierarchyStats": {
      "competenciesCreated": 8,
      "competenciesExisting": 2,
      "relationshipsCreated": 7,
      "relationshipsExisting": 0
    }
  }
}
```

---

## Service Architecture

### `aiService.js`
**Method:** `generateCompetencyHierarchy(careerPath)`
- Loads the `Competency_huerarchies_prompt`
- Replaces placeholder with career path name
- Calls Gemini API (flash model)
- Returns hierarchical JSON structure

### `competencyHierarchyService.js`
**Methods:**
1. `buildFromCareerPath(careerPath)` - Main orchestrator
2. `extractNodes(tree, parentId)` - Flattens tree into node array
3. `persistHierarchy(nodes)` - Saves nodes and relationships to database
4. `validateHierarchyTree(tree)` - Validates AI response structure

### `userController.js`
**Updated Method:** `onboardAndIngest(req, res)`
- **Step 1:** Create basic user profile
- **Step 1.5:** Build competency hierarchy (NEW)
- **Step 2:** Extract from raw data
- **Step 3:** Normalize and deduplicate
- **Step 4:** Build initial profile

---

## AI Prompt

**File:** `backend/docs/prompts/Competency_huerarchies_prompt`

**Key Rules:**
1. Every node uses the key `"competency"`
2. Sub-levels use the key `"subcompetencies"`
3. Leaves are marked with `"core-competency": true`
4. No subcompetencies under core competencies
5. Returns valid JSON only

**Example Output:**
```json
{
  "competency": "Backend Development",
  "subcompetencies": [
    {
      "competency": "Database Management",
      "subcompetencies": [
        { "competency": "SQL", "core-competency": true },
        { "competency": "PostgreSQL", "core-competency": true }
      ]
    }
  ]
}
```

---

## Edge Cases

### 1. **Null or Empty `path_career`**
- **Behavior:** Skip hierarchy generation entirely
- **Flow:** Proceed directly to raw data extraction

### 2. **Career Path Already Exists**
- **Behavior:** Regenerate hierarchy and update relationships
- **Reason:** Ensures latest AI knowledge is reflected

### 3. **AI Returns Invalid JSON**
- **Behavior:** Throw error and halt onboarding
- **Mitigation:** Retry logic in `aiService.callGeminiJSON`

### 4. **Duplicate Competency Names**
- **Behavior:** Reuse existing competency_id
- **Database Constraint:** `competency_name` has UNIQUE constraint

### 5. **Circular Relationships**
- **Prevention:** Parent-child relationships are one-way
- **Validation:** AI prompt enforces tree structure

---

## Testing

### Manual Test Script
**File:** `backend/tests/manual/test-career-path-hierarchy.js`

**Run:**
```bash
node backend/tests/manual/test-career-path-hierarchy.js
```

**Tests:**
1. Generate hierarchy from AI
2. Extract nodes from tree
3. Persist hierarchy to database
4. Verify data in database
5. Handle null career path

### Integration Test
**Endpoint Test:**
```bash
curl -X POST http://localhost:3000/api/user/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-001",
    "user_name": "Test User",
    "company_id": "test-company",
    "path_career": "Frontend Development",
    "raw_data": "I have experience with React and Vue.js"
  }'
```

---

## Performance Considerations

### AI Call Latency
- **Model:** Gemini Flash (faster than Pro)
- **Average Time:** 2-5 seconds per hierarchy generation
- **Optimization:** Consider caching common career paths

### Database Operations
- **Batch Inserts:** Not currently implemented (sequential inserts)
- **Future Optimization:** Use bulk insert for competencies

### Concurrent Requests
- **Safe:** Multiple users can onboard simultaneously
- **Database Constraint:** UNIQUE constraint prevents duplicates
- **Junction Table:** Primary key prevents duplicate relationships

---

## Future Enhancements

1. **Career Path Caching**
   - Cache generated hierarchies for common career paths
   - Reduce AI calls and improve latency

2. **Hierarchy Versioning**
   - Track changes to career path hierarchies over time
   - Allow rollback to previous versions

3. **Custom Hierarchies**
   - Allow companies to define custom career path hierarchies
   - Override AI-generated hierarchies

4. **Hierarchy Visualization**
   - Frontend component to display competency tree
   - Interactive exploration of career path structure

5. **Skill Mapping**
   - Automatically map core competencies to granular skills
   - Link to existing skill taxonomy

---

## Troubleshooting

### Issue: "Competency already exists" error
**Cause:** UNIQUE constraint on `competency_name`
**Solution:** This is expected behavior - the system reuses existing competencies

### Issue: AI returns empty or invalid JSON
**Cause:** Gemini API timeout or rate limit
**Solution:** Check API key, quota, and retry logic in `aiService`

### Issue: Relationships not created
**Cause:** Missing parent or child competency_id
**Solution:** Check logs for node extraction and ID mapping

### Issue: Onboarding takes too long
**Cause:** AI call + database operations
**Solution:** Consider async processing or background jobs for large hierarchies

---

## Related Files

- `backend/src/services/aiService.js`
- `backend/src/services/competencyHierarchyService.js`
- `backend/src/controllers/userController.js`
- `backend/src/models/Competency.js`
- `backend/src/repositories/competencyRepository.js`
- `backend/docs/prompts/Competency_huerarchies_prompt`

---

## Changelog

### Version 1.0 (Initial Release)
- ✅ AI-powered hierarchy generation
- ✅ Recursive tree traversal
- ✅ Database persistence with relationship mapping
- ✅ Integration with onboarding flow
- ✅ Idempotent operations (safe to run multiple times)

