# Directory MS Profile Structure

## Overview

This document describes the exact data structures that Skills Engine sends to Directory MS. There are **two types** of profile payloads:

1. **Initial Profile** - Sent after user onboarding and ingestion pipeline
2. **Updated Profile** - Sent after exam results processing

Both are sent via the **Coordinator microservice** using signed unified protocol envelopes.

---

## Table of Contents

1. [Initial Profile Structure](#initial-profile-structure)
2. [Updated Profile Structure](#updated-profile-structure)
3. [Envelope Format](#envelope-format)
4. [Complete Examples](#complete-examples)
5. [Hierarchy Serialization](#hierarchy-serialization)

---

## Initial Profile Structure

### When It's Sent

**Trigger:** After user onboarding completes the ingestion pipeline:
1. User data received from Directory MS
2. Skills Engine extracts competencies & skills from `raw_data`
3. Skills Engine normalizes and deduplicates
4. Skills Engine builds initial profile
5. **Skills Engine sends initial profile to Directory MS**

### Data Structure

```typescript
{
  userId: string;              // User ID
  relevanceScore: number;      // Always 0 for initial profile
  competencies: Array<{
    competencyId: string;      // UUID
    competencyName: string;    // Competency name
    level: string;             // Always "undefined" initially
    coverage: number;          // Always 0 initially
    children?: Array<{         // Recursive sub-competencies (if any)
      competencyId: string;
      competencyName: string;
      level: string;
      coverage: number;
      children?: Array<...>;
    }>;
  }>;
}
```

### Field Descriptions

| Field                   | Type     | Description                                    | Initial Value        |
|-------------------------|----------|------------------------------------------------|----------------------|
| `userId`                | string   | User ID from Directory MS                      | From user record     |
| `relevanceScore`        | number   | Career path relevance score (0-100)            | `0`                  |
| `competencies`          | array    | Array of root competencies                     | Extracted from data  |
| `competencies[].competencyId` | string | UUID of the competency                    | Generated            |
| `competencies[].competencyName` | string | Name of the competency                  | Extracted            |
| `competencies[].level`  | string   | Proficiency level                              | `"undefined"`        |
| `competencies[].coverage` | number | Coverage percentage (0-100)                   | `0`                  |
| `competencies[].children` | array  | Sub-competencies (hierarchical)              | Extracted (optional) |

### Example: Initial Profile Payload

```json
{
  "userId": "user-123",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "comp-001",
      "competencyName": "Backend Development",
      "level": "undefined",
      "coverage": 0,
      "children": [
        {
          "competencyId": "comp-002",
          "competencyName": "API Development",
          "level": "undefined",
          "coverage": 0
        },
        {
          "competencyId": "comp-003",
          "competencyName": "Database Integration",
          "level": "undefined",
          "coverage": 0
        }
      ]
    },
    {
      "competencyId": "comp-004",
      "competencyName": "Authentication & Security",
      "level": "undefined",
      "coverage": 0
    }
  ]
}
```

### Code Location

**File:** `backend/src/services/userService.js`  
**Method:** `buildInitialProfile(userId, normalizedData)`

```javascript
// Step 11: Build final payload
const payload = {
  userId: userId,
  relevanceScore: 0,
  competencies: competencies  // Hierarchical structure
};

// Step 12: Send to Directory MS
await directoryMSClient.sendInitialProfile(userId, payload);
```

---

## Updated Profile Structure

### When It's Sent

**Trigger:** After exam results are processed:
1. Assessment MS sends baseline or post-course exam results
2. Skills Engine updates `userCompetency.verifiedSkills`
3. Skills Engine recalculates `coverage_percentage` and `proficiency_level`
4. **Skills Engine sends updated profile to Directory MS**

### Data Structure

```typescript
{
  userId: string;              // User ID
  relevanceScore: number;      // Currently always 0 (future: calculated from career path)
  competencies: Array<{
    competencyId: string;      // UUID
    competencyName: string;    // Competency name
    level: string;             // "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | "undefined"
    coverage: number;          // Coverage percentage (0-100)
    children?: Array<{         // Recursive sub-competencies (if any)
      competencyId: string;
      competencyName: string;
      level: string;
      coverage: number;
      children?: Array<...>;
    }>;
  }>;
}
```

### Field Descriptions

| Field                   | Type     | Description                                    | Updated Value                       |
|-------------------------|----------|------------------------------------------------|-------------------------------------|
| `userId`                | string   | User ID from Directory MS                      | Same                                |
| `relevanceScore`        | number   | Career path relevance score (0-100)            | Currently always `0` (future work)  |
| `competencies`          | array    | Array of root competencies                     | User's current competencies         |
| `competencies[].competencyId` | string | UUID of the competency                    | Same                                |
| `competencies[].competencyName` | string | Name of the competency                  | Same                                |
| `competencies[].level`  | string   | Proficiency level                              | Calculated from coverage            |
| `competencies[].coverage` | number | Coverage percentage (0-100)                   | (verified MGS / required MGS) × 100 |
| `competencies[].children` | array  | Sub-competencies (hierarchical)              | Updated recursively                 |

### Proficiency Level Mapping

| Coverage %    | Proficiency Level |
|---------------|-------------------|
| 80% - 100%    | `EXPERT`          |
| 60% - 79%     | `ADVANCED`        |
| 40% - 59%     | `INTERMEDIATE`    |
| 0% - 39%      | `BEGINNER`        |

### Example: Updated Profile Payload

```json
{
  "userId": "user-123",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "comp-001",
      "competencyName": "Backend Development",
      "level": "INTERMEDIATE",
      "coverage": 55.33,
      "children": [
        {
          "competencyId": "comp-002",
          "competencyName": "API Development",
          "level": "ADVANCED",
          "coverage": 68.75
        },
        {
          "competencyId": "comp-003",
          "competencyName": "Database Integration",
          "level": "BEGINNER",
          "coverage": 25.00
        }
      ]
    },
    {
      "competencyId": "comp-004",
      "competencyName": "Authentication & Security",
      "level": "INTERMEDIATE",
      "coverage": 50.00
    }
  ]
}
```

### Code Location

**File:** `backend/src/services/verificationService.js`  
**Method:** `buildUpdatedProfilePayload(userId)`

```javascript
// Get all user competencies
const userCompetencies = await userCompetencyRepository.findByUser(userId);

// Build competency hierarchy
const nodes = new Map();

for (const userComp of userCompetencies) {
  const competency = await competencyRepository.findById(userComp.competency_id);
  
  // Get parent relationships
  const parentLinks = await competencyRepository.getParentCompetencies(userComp.competency_id);
  const parentId = parentLinks.length > 0 ? parentLinks[0].competency_id : null;

  const node = {
    competencyId: userComp.competency_id,
    competencyName: competency.competency_name,
    level: userComp.proficiency_level || 'undefined',  // Updated from exam results
    coverage: userComp.coverage_percentage || 0,       // Calculated coverage
    parentId: parentId,
    children: []
  };

  nodes.set(userComp.competency_id, node);
}

// Build parent-child relationships
// ... (hierarchy building logic)

// Build final payload
const payload = {
  userId: userId,
  relevanceScore: 0,
  competencies: competencies  // Hierarchical structure with updated values
};

// Send to Directory MS
await directoryMSClient.sendUpdatedProfile(userId, payload);
```

---

## Envelope Format

### Initial Profile Envelope

**Endpoint:** `POST /api/events/directory/initial-profile` (via Coordinator)

```json
{
  "requester_service": "skills-engine-service",
  "payload": {
    "action": "Send initial competency profile to Directory MS",
    "user_id": "user-123",
    "userId": "user-123",
    "relevanceScore": 0,
    "competencies": [
      {
        "competencyId": "comp-001",
        "competencyName": "Backend Development",
        "level": "undefined",
        "coverage": 0,
        "children": [...]
      }
    ]
  },
  "response": {
    "answer": {}
  }
}
```

### Updated Profile Envelope

**Endpoint:** `POST /api/events/directory/updated-profile` (via Coordinator)

```json
{
  "requester_service": "skills-engine-service",
  "payload": {
    "action": "Update user profile",
    "user_id": "user-123",
    "userId": "user-123",
    "relevanceScore": 0,
    "competencies": [
      {
        "competencyId": "comp-001",
        "competencyName": "Backend Development",
        "level": "INTERMEDIATE",
        "coverage": 55.33,
        "children": [...]
      }
    ]
  },
  "response": {
    "answer": {}
  }
}
```

### Code Location

**File:** `backend/src/services/directoryMSClient.js`

```javascript
// Initial Profile
async function sendInitialProfile(userId, profile) {
  const envelope = {
    requester_service: 'skills-engine-service',
    payload: {
      action: 'Send initial competency profile to Directory MS',
      user_id: userId,
      ...profile  // Spreads userId, relevanceScore, competencies
    },
    response: {
      answer: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/directory/initial-profile'
  });
}

// Updated Profile
async function sendUpdatedProfile(userId, profile) {
  const envelope = {
    requester_service: 'skills-engine-service',
    payload: {
      action: 'Update user profile',
      user_id: userId,
      ...profile  // Spreads userId, relevanceScore, competencies
    },
    response: {
      answer: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/directory/updated-profile'
  });
}
```

---

## Complete Examples

### Example 1: Initial Profile (Simple Flat Structure)

**User onboarded with basic LinkedIn data → Skills Engine extracts "JavaScript" competency**

```json
{
  "userId": "user-456",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "comp-js-001",
      "competencyName": "JavaScript",
      "level": "undefined",
      "coverage": 0
    }
  ]
}
```

### Example 2: Initial Profile (Hierarchical Structure)

**User onboarded with career path "Backend Development" → AI generates hierarchy**

```json
{
  "userId": "user-789",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "comp-backend-001",
      "competencyName": "Backend Development",
      "level": "undefined",
      "coverage": 0,
      "children": [
        {
          "competencyId": "comp-api-001",
          "competencyName": "API Development",
          "level": "undefined",
          "coverage": 0
        },
        {
          "competencyId": "comp-db-001",
          "competencyName": "Database Integration",
          "level": "undefined",
          "coverage": 0
        },
        {
          "competencyId": "comp-auth-001",
          "competencyName": "Authentication & Security",
          "level": "undefined",
          "coverage": 0
        }
      ]
    }
  ]
}
```

### Example 3: Updated Profile (After Baseline Exam)

**User took baseline exam → verified 10 out of 20 MGS for "API Development"**

```json
{
  "userId": "user-789",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "comp-backend-001",
      "competencyName": "Backend Development",
      "level": "INTERMEDIATE",
      "coverage": 45.50,
      "children": [
        {
          "competencyId": "comp-api-001",
          "competencyName": "API Development",
          "level": "INTERMEDIATE",
          "coverage": 50.00
        },
        {
          "competencyId": "comp-db-001",
          "competencyName": "Database Integration",
          "level": "BEGINNER",
          "coverage": 25.00
        },
        {
          "competencyId": "comp-auth-001",
          "competencyName": "Authentication & Security",
          "level": "INTERMEDIATE",
          "coverage": 60.00
        }
      ]
    }
  ]
}
```

### Example 4: Updated Profile (After Post-Course Exam PASS)

**User took post-course exam and PASSED → verified additional skills**

```json
{
  "userId": "user-789",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "comp-backend-001",
      "competencyName": "Backend Development",
      "level": "ADVANCED",
      "coverage": 72.25,
      "children": [
        {
          "competencyId": "comp-api-001",
          "competencyName": "API Development",
          "level": "EXPERT",
          "coverage": 85.00
        },
        {
          "competencyId": "comp-db-001",
          "competencyName": "Database Integration",
          "level": "ADVANCED",
          "coverage": 65.00
        },
        {
          "competencyId": "comp-auth-001",
          "competencyName": "Authentication & Security",
          "level": "ADVANCED",
          "coverage": 67.00
        }
      ]
    }
  ]
}
```

---

## Hierarchy Serialization

### How Hierarchy Is Built

Skills Engine uses a **parent-child relationship model** stored in the database:

**`competencies` table:**
```sql
competency_id | competency_name              | parent_competency_id
--------------|------------------------------|---------------------
comp-001      | Backend Development          | NULL
comp-002      | API Development              | NULL
comp-003      | Database Integration         | NULL
```

**`competency_subCompetency` table (junction):**
```sql
parent_competency_id | child_competency_id
---------------------|--------------------
comp-001             | comp-002
comp-001             | comp-003
```

### Serialization Algorithm

```javascript
// 1. Build nodes map
const nodes = new Map();
for (const userComp of userCompetencies) {
  const parentLinks = await competencyRepository.getParentCompetencies(userComp.competency_id);
  const parentId = parentLinks.length > 0 ? parentLinks[0].competency_id : null;

  nodes.set(userComp.competency_id, {
    competencyId: userComp.competency_id,
    competencyName: competency.competency_name,
    level: userComp.proficiency_level || 'undefined',
    coverage: userComp.coverage_percentage || 0,
    parentId: parentId,
    children: []
  });
}

// 2. Build parent-child relationships
for (const [id, node] of nodes.entries()) {
  if (node.parentId && nodes.has(node.parentId)) {
    const parent = nodes.get(node.parentId);
    parent.children.push(node);
  }
}

// 3. Get root nodes (no parent)
const roots = Array.from(nodes.values()).filter(node => !node.parentId);

// 4. Serialize recursively
const serializeNode = (node) => {
  const base = {
    competencyId: node.competencyId,
    competencyName: node.competencyName,
    level: node.level,
    coverage: node.coverage
  };

  const childNodes = (node.children || []).map(serializeNode);
  if (childNodes.length > 0) {
    base.children = childNodes;
  }

  return base;
};

const competencies = roots.map(serializeNode);
```

### Result

```json
{
  "competencies": [
    {
      "competencyId": "comp-001",
      "competencyName": "Backend Development",
      "level": "INTERMEDIATE",
      "coverage": 55.33,
      "children": [
        {
          "competencyId": "comp-002",
          "competencyName": "API Development",
          "level": "ADVANCED",
          "coverage": 68.75
        },
        {
          "competencyId": "comp-003",
          "competencyName": "Database Integration",
          "level": "BEGINNER",
          "coverage": 25.00
        }
      ]
    }
  ]
}
```

---

## Key Differences Between Initial and Updated Profiles

| Aspect              | Initial Profile                 | Updated Profile                        |
|---------------------|---------------------------------|----------------------------------------|
| **When Sent**       | After onboarding/ingestion      | After exam results processing          |
| **Trigger**         | `userService.buildInitialProfile` | `verificationService.buildUpdatedProfilePayload` |
| **level**           | Always `"undefined"`            | Calculated from coverage               |
| **coverage**        | Always `0`                      | `(verified MGS / required MGS) × 100`  |
| **Hierarchy**       | Based on extracted competencies | Based on user's current competencies   |
| **Endpoint**        | `/api/events/directory/initial-profile` | `/api/events/directory/updated-profile` |

---

## Related Files

- `backend/src/services/directoryMSClient.js` - Client for sending profiles to Directory MS
- `backend/src/services/userService.js` - Builds initial profile after ingestion
- `backend/src/services/verificationService.js` - Builds updated profile after exams
- `backend/src/repositories/competencyRepository.js` - Fetches competency hierarchy
- `backend/src/repositories/userCompetencyRepository.js` - Fetches user competencies

---

## Summary

**Initial Profile:**
- Sent after user onboarding
- All `level = "undefined"`, all `coverage = 0`
- Represents discovered competencies from raw data + career path

**Updated Profile:**
- Sent after exam results processing
- `level` calculated from `coverage`
- `coverage` = `(verified MGS / required MGS) × 100`
- Reflects user's current skill verification status

Both profiles use the **same hierarchical structure** and are sent via Coordinator with unified protocol envelopes.

