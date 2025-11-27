### Skills Engine – New User Ingestion & Normalization Pipeline

## 1. High-level overview

**Goal:**  
Take a **new user** and their **raw data** (CV, LinkedIn, GitHub, etc.), then:

1. Save the user.
2. **Extract** competencies and skills from raw text (AI).
3. **Normalize & map** them onto your taxonomy (tables `competencies` and `skills`).
4. **Write** user-specific links into `user_competencies` and `user_skill`.
5. **Return & send** an initial profile to Directory MS.

Everything is implemented with HTTP endpoints plus service classes in the backend.

---

## 2. Main components

- **Controllers**
  - `userController`
    - `createOrUpdateUser` – creates/updates basic user profile.
    - `extractFromRawData` – runs extraction + normalization for a user’s raw data.
    - `normalizeData` – normalizes a provided extracted payload.
    - `buildInitialProfile` – builds and sends initial profile (writes `user_*` tables).

- **Services**
  - `extractionService` – calls AI to extract `{ competencies, skills }` from raw text and persists them into taxonomy tables.
  - `normalizationService` – normalizes extracted items and maps them to taxonomy IDs.
  - `userService` – builds the initial user profile, writes `user_competencies` and `user_skill`, sends profile to Directory MS.
  - `aiService` – low-level AI calls (extract, normalize, validate structure).
  - `directoryMSClient` – sends initial profile back to Directory MS.

- **Repositories (DB access)**
  - `userRepository` – `users` table.
  - `competencyRepository` – `competencies` table + links.
  - `skillRepository` – `skills` table + hierarchy & MGS helpers.
  - `userCompetencyRepository` – `user_competencies` table.
  - `userSkillRepository` – `user_skill` table.

---

## 3. End-to-end flow from Directory MS

### 3.1 Step 1 – Directory MS creates/updates the user

- **Endpoint:** `POST /api/user`  
- **Controller:** `userController.createOrUpdateUser`  
- **Service:** `userService.createBasicProfile`

**What happens:**

1. Directory MS sends user master data (e.g. `userId`, name, email, etc.).
2. `userService.createBasicProfile` wraps it in a `User` model.
3. `userRepository.upsert` saves into `users` (create or update).
4. Returns the stored user.

**Result:** the user exists in the DB and is ready for skill/competency processing.

---

### 3.2 Step 2 – Directory MS sends raw data for extraction

- **Endpoint:** `POST /api/user/:userId/extract`  
- **Controller:** `userController.extractFromRawData`  
- **Service:** `extractionService.extractFromUserData(userId, rawData)`

**Request body:**

```json
{
  "rawData": "Full resume / profile text..."
}
```

**What happens in `extractFromUserData`:**

1. **Validate user** – checks `userRepository.findById(userId)`; throws if user doesn’t exist.
2. **Chunk raw text** – `chunkData(rawData, 50000)` to respect AI token limits.
3. For each chunk:
   - Calls `aiService.extractFromRawData(chunk)` which should return:
     ```json
     {
       "competencies": [...],
       "skills": [...]
     }
     ```
   - Validates structure via `aiService.validateExtractedData`.
   - Merges all chunks into `allExtracted = { competencies, skills }`.
4. **Deduplicate by name** using `deduplicateByName`, based on lower-cased, trimmed `name`.
5. **Persist to taxonomy tables** with `persistToTaxonomy(allExtracted)`:
   - For each competency:
     - If not already in `competencies` (case-insensitive), creates a new record with generated ID `comp_<...>`.
   - For each skill:
     - If not already in `skills`, creates a new record with generated ID `skill_<...>`.
   - Returns `stats = { competencies: <created>, skills: <created> }`.

**Controller behavior:**

In `userController.extractFromRawData`:

1. Calls `extractionService.extractFromUserData(userId, rawData)` → `extracted`.
2. Calls `normalizationService.normalize(extracted)` → `normalizedRaw`.
3. Calls `normalizationService.deduplicate(normalizedRaw)` → `normalized`.
4. Returns both `extracted` and `normalized` in the HTTP response.

---

### 3.3 Step 3 – Normalize and map to taxonomy IDs

Normalization can happen:

- As part of `/api/user/:userId/extract` (see above), or  
- Via a dedicated endpoint:

- **Endpoint:** `POST /api/user/:userId/normalize`  
- **Controller:** `userController.normalizeData`  
- **Service:** `normalizationService.normalize(extractedData)`

**Request body:**

```json
{
  "extractedData": {
    "competencies": [...],
    "skills": [...]
  }
}
```

#### What `normalizationService.normalize` does

1. **Validate** structure with `aiService.validateExtractedData(extractedData)`.
2. **Call AI**:
   ```js
   const normalized = await aiService.normalizeData(extractedData);
   ```
3. **Normalize shapes**:
   - If Gemini returns plain strings, convert them to objects:
     - `"JavaScript"` → `{ normalized_name: "JavaScript" }`
4. **Validate** that `normalized.competencies` and `normalized.skills` are arrays.
5. **Map to taxonomy IDs** with `mapToTaxonomyIds(items, type)`:
   - For competencies (`type === 'competency'`):
     - Look up by name: `competencyRepository.findByName(normalized_name)`.
     - If found:
       - `taxonomy_id = existing.competency_id`
       - `found_in_taxonomy = true`
     - If not found:
       - Generate new ID: `competency_<timestamp>_<random>`
       - `found_in_taxonomy = false`
   - For skills (`type === 'skill'`):
     - Same logic using `skillRepository.findByName` and `skill_id`.
6. **Return**:
   ```json
   {
     "competencies": [
       {
         "normalized_name": "Software Architecture",
         "taxonomy_id": "comp_...",
         "found_in_taxonomy": true
       }
     ],
     "skills": [
       {
         "normalized_name": "React",
         "taxonomy_id": "skill_...",
         "found_in_taxonomy": false
       }
     ]
   }
   ```
7. **Deduplicate** (optional but recommended) with `normalizationService.deduplicate(normalized)`:
   - Removes duplicates based on `normalized_name` for competencies and skills.

---

## 4. Step 4 – Build initial profile and write user tables

- **Endpoint:** `POST /api/user/:userId/initial-profile`  
- **Controller:** `userController.buildInitialProfile`  
- **Service:** `userService.buildInitialProfile(userId, normalizedData)`

**Request body:**

```json
{
  "normalizedData": {
    "competencies": [...],
    "skills": [...]
  }
}
```

Typically, `normalizedData` is the output of Step 3 (normalize + deduplicate).

### 4.1 Finalize taxonomy IDs

Inside `userService.buildInitialProfile`:

1. **Competencies**
   - For each item in `normalizedData.competencies`:
     - Start with `competencyId = comp.taxonomy_id`.
     - If `!comp.found_in_taxonomy`:
       - Try `competencyRepository.findByName(comp.normalized_name)` again.
       - If still not found:
         - Create a new competency with:
           - `competency_id = comp.taxonomy_id`
           - `competency_name = comp.normalized_name`
           - Optional `description`, etc.
     - Add to `competencyMappings`:
       ```js
       {
         original: comp,
         competency_id: resolvedId
       }
       ```

2. **Skills**
   - For each item in `normalizedData.skills`:
     - Start with `skillId = skill.taxonomy_id`.
     - If `!skill.found_in_taxonomy`:
       - Try `skillRepository.findByName(skill.normalized_name)`.
       - If still not found:
         - Create a new skill with:
           - `skill_id = skill.taxonomy_id`
           - `skill_name = skill.normalized_name`
           - Optional `description`, etc.
     - Add to `skillMappings`:
       ```js
       {
         original: skill,
         skill_id: resolvedId
       }
       ```

### 4.2 Insert into `user_competencies`

For each `competencyMappings` item:

- Build a `UserCompetency` model:
  - `user_id = userId`
  - `competency_id = mapping.competency_id`
  - `coverage_percentage = 0.00`
  - `proficiency_level = null`
  - `verifiedSkills = []`
- Call `userCompetencyRepository.upsert(userComp)`.

### 4.3 Insert into `user_skill` and mirror as competency

For each `skillMappings` item:

1. **Insert `user_skill`:**
   - Build `UserSkill`:
     - `user_id = userId`
     - `skill_id = mapping.skill_id`
     - `skill_name = mapping.original.normalized_name`
     - `verified = false`
     - `source = 'ai'`
   - Call `userSkillRepository.upsert(userSkill)`.

2. **Also create a corresponding competency entry (if needed):**
   - Check if a competency with `competency_id = mapping.skill_id` exists:
     - `competencyRepository.findById(mapping.skill_id)`.
   - If not, create one:
     - `competency_id = mapping.skill_id`
     - `competency_name = mapping.original.normalized_name`
     - Optional `description`.
   - Build `UserCompetency` with this `competency_id` and `upsert` it.

Result: every normalized skill is represented both:

- As a row in `user_skill`, and  
- As a row in `user_competencies` (so skills can be treated as competencies in analytics).

### 4.4 Build profile object and send to Directory MS

1. Fetch:
   - `userCompetencies = userCompetencyRepository.findByUser(userId)`
   - `userSkills = userSkillRepository.findByUser(userId)`
2. For each unique `competency_id`:
   - Load competency: `competencyRepository.findById(compId)`.
   - Get required skills: `competencyRepository.getLinkedSkills(compId)`.
   - Compute `matchedSkills` by intersecting with `userSkills`.
   - Build an entry:
     ```json
     {
       "competencyId": "comp_...",
       "level": "undefined",
       "coverage": 0,
       "skills": [
         { "skillId": "skill_...", "status": "verified|unverified" }
       ]
     }
     ```
3. Build final payload:
   ```json
   {
     "userId": "user123",
     "relevanceScore": 0,
     "competencies": [ ... ]
   }
   ```
4. Call `directoryMSClient.sendInitialProfile(userId, payload)` to send this initial profile back to Directory MS (with error handling/fallback).

---

## 5. How Directory MS should trigger the pipeline

Using the current API design, the recommended call sequence is:

1. **Create/update user**
   - `POST /api/user`
   - Body: user’s core data.

2. **Extract + normalize**
   - Option A (two requests):
     1. `POST /api/user/:userId/extract` with `{ rawData }` → response contains `data.normalized`.
     2. `POST /api/user/:userId/initial-profile` with:
        ```json
        {
          "normalizedData": { ... from previous step ... }
        }
        ```
   - Option B (if a combined endpoint is implemented):
     - Single request `POST /api/user/:userId/ingest` with `{ rawData }` that internally:
       - extracts → normalizes/deduplicates → builds initial profile.

3. **Consume the initial profile**
   - Directory MS receives the payload sent by `directoryMSClient.sendInitialProfile` and uses it in its own workflows.


