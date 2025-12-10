# Step 6: API Design & Contracts

**Project:** Skills Engine Microservice  
**Platform:** EduCora AI (11 microservices)  
**Date:** 2025-01-27  
**Status:** Draft

---

## 1. Overview

This document defines all API endpoints, request/response formats, authentication, and contracts for the Skills Engine microservice. The API is divided into two main categories:

1. **Unified Data Exchange Protocol** - Single endpoint for all microservice communications
2. **REST API for Frontend/UI** - Endpoints consumed by the Skills Engine frontend

**API Base URL:** `https://{project-name}.up.railway.app` (production)  
**Note:** Replace `{project-name}` with your Railway project name, or use a custom domain if configured.  
**API Version:** `v1` (versioned in URL path)  
**Content-Type:** `application/json` (unless specified otherwise)  
**Character Encoding:** UTF-8

**AI Integration:**
- **AI Provider:** Google Gemini
- **Models Used:**
  - **Gemini 1.5 Flash:** Used for skill/competency extraction from user profiles, normalization, and quick validation
  - **Gemini 1.5 Pro (Deep Search):** Used for deep web scanning, extraction from external sources, and comprehensive validation
- **API Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Authentication:** Google API Key (stored securely, not exposed in API responses)

---

## 1.1 Tech Stack & Architecture

### Technology Stack

**Frontend:**
- **Framework:** Next.js
- **Deployment:** Vercel

**Backend:**
- **Runtime:** Node.js
- **Framework:** Express.js
- **Deployment:** Railway
- **API Type:** REST only

**Database:**
- **Type:** PostgreSQL
- **Provider:** Supabase

**Version Control & CI/CD:**
- **Version Control:** GitHub
- **CI/CD:** GitHub Actions

**Testing:**
- **Framework:** Jest or Vitest

**AI Integration:**
- **Provider:** Google Gemini API
- **Fallback:** Local AI simulation (for development/testing)

### Backend Architecture Structure

The backend follows a layered architecture pattern with clear separation of concerns:

```
backend/
├── routes/              # API route definitions
│   ├── api/
│   │   ├── user/
│   │   ├── competencies/
│   │   ├── skills/
│   │   ├── user-competency/
│   │   ├── user-skill/
│   │   └── fill-content-metrics/  # Unified endpoint
│   └── index.js
│
├── controllers/         # Request handlers (business logic orchestration)
│   ├── userController.js
│   ├── competencyController.js
│   ├── skillController.js
│   ├── userCompetencyController.js
│   ├── userSkillController.js
│   ├── importController.js
│   └── unifiedEndpointController.js
│
├── services/           # Business logic layer
│   ├── userService.js
│   ├── competencyService.js
│   ├── skillService.js
│   ├── userCompetencyService.js
│   ├── userSkillService.js
│   ├── gapAnalysisService.js
│   ├── extractionService.js
│   ├── normalizationService.js
│   ├── validationService.js
│   └── aiService.js
│
├── models/             # Database models/entities
│   ├── User.js
│   ├── Competency.js
│   ├── Skill.js
│   ├── UserCompetency.js
│   └── UserSkill.js
│
├── repositories/       # Data access layer
│   ├── userRepository.js
│   ├── competencyRepository.js
│   ├── skillRepository.js
│   ├── userCompetencyRepository.js
│   └── userSkillRepository.js
│
├── middleware/         # Express middleware
│   ├── auth.js
│   ├── validation.js
│   ├── errorHandler.js
│   └── rateLimiter.js
│
├── utils/              # Utility functions
│   ├── logger.js
│   ├── constants.js
│   └── helpers.js
│
├── config/             # Configuration files
│   ├── database.js
│   ├── ai.js
│   └── env.js
│
├── tests/              # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── index.js            # Application entry point
```

### Architecture Layers

**1. Routes Layer (`routes/`):**
- Defines API endpoints and HTTP methods
- Maps URLs to controller functions
- Handles request/response formatting
- Validates request structure

**2. Controllers Layer (`controllers/`):**
- Receives HTTP requests from routes
- Orchestrates business logic by calling services
- Handles request validation
- Formats responses
- Manages error handling

**3. Services Layer (`services/`):**
- Contains core business logic
- Coordinates between multiple repositories
- Implements algorithms (gap analysis, MGS calculation, etc.)
- Handles AI integration
- Manages data transformations

**4. Repositories Layer (`repositories/`):**
- Abstracts database operations
- Provides data access methods
- Handles SQL queries
- Manages database transactions

**5. Models Layer (`models/`):**
- Defines data structures
- Validates data schemas
- Maps database tables to JavaScript objects

### Request Flow Example

```
Client Request
    ↓
Route (routes/api/user/profile.js)
    ↓
Controller (controllers/userController.js)
    ↓
Service (services/userService.js)
    ↓
Repository (repositories/userRepository.js)
    ↓
Database (PostgreSQL via Supabase)
    ↓
Response flows back through layers
```

### Deployment Architecture

**Frontend (Next.js):**
- **Platform:** Vercel
- **Build:** Automatic on git push
- **Environment:** Production, Staging (via branches)

**Backend (Node.js + Express.js):**
- **Platform:** Railway
- **Domain:** `{project-name}.up.railway.app`
- **Environment Variables:** Managed via Railway dashboard
- **Database Connection:** Supabase PostgreSQL connection string

**Database (PostgreSQL):**
- **Provider:** Supabase
- **Connection:** Via connection string from Supabase dashboard
- **Migrations:** Managed via migration scripts or Supabase CLI

### Development Workflow

1. **Local Development:**
   - Frontend: `npm run dev` (Next.js dev server)
   - Backend: `npm run dev` (Express.js with nodemon)
   - Database: Local PostgreSQL or Supabase connection

2. **Version Control:**
   - Code pushed to GitHub
   - GitHub Actions triggers on push/PR

3. **CI/CD Pipeline:**
   - **GitHub Actions:**
     - Run tests (Jest/Vitest)
     - Lint code
     - Build application
     - Deploy to Railway (backend) and Vercel (frontend)

4. **Testing:**
   - Unit tests: Jest or Vitest
   - Integration tests: API endpoint testing
   - E2E tests: Full workflow testing

---

## 2. Authentication & Authorization

### 2.1 Authentication Method

All API endpoints require authentication using Bearer tokens:

```
Authorization: Bearer <token>
```

**Token Format:**
- JWT (JSON Web Token) or API key
- Token must be included in the `Authorization` header
- Token validation performed on every request

### 2.2 Authorization Rules

**User Profile Endpoints:**
- Users can only access their own profile (`user_id` must match authenticated user)
- Admin/Ops can impersonate users for debugging (requires admin privileges)

**Competency Import Endpoints:**
- Requires `employee_type = "trainer"` in user's basic profile
- Backend validates `employee_type` before allowing access

**Microservice Endpoints (Unified Protocol):**
- Requires valid microservice API key/token
- Each microservice has its own authentication credentials

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Valid token but insufficient permissions
- `404 Not Found`: Resource not found or user doesn't exist

---

## 3. Unified Data Exchange Protocol

### 3.1 Overview

Skills Engine implements a **Unified Data Exchange Endpoint** as the single gateway for all microservice communications. Instead of exposing multiple endpoints for each microservice, all external microservices communicate through one unified endpoint.

**Important:** All API interactions described in Features 8.1-8.7 are implemented through this unified protocol. The specific endpoints mentioned in each feature represent logical operations, but the physical implementation uses the unified endpoint architecture.

### 3.2 Unified Endpoint

**Single Public API Route:**
- `POST /api/fill-content-metrics/`

This is the **only public API route** for external microservices. All microservices (Directory MS, Assessment MS, Course Builder MS, Content Studio MS, Learner AI MS, Learning Analytics MS, RAG MS) must call this endpoint and no other.

### 3.3 Request Format

Every request must follow this mandatory structure:

```json
{
  "requester_service": "string",
  "payload": {},
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Fields:**
- `requester_service` (string, required): The exact name of the microservice sending the request. Valid values:
  - `"directory-ms"`
  - `"assessment-ms"`
  - `"course-builder-ms"`
  - `"content-studio-ms"`
  - `"learner-ai-ms"`
  - `"analytics-ms"`
  - `"rag-ms"`
- `payload` (object, required): The **input data** sent by that microservice (can be empty `{}`); all contextual inputs and filters MUST live here.
- `response` (object, required): A **response template**. Its `data` object lists the **fields and structure that the caller is requesting Skills Engine to fill**. Handlers will only populate keys that appear under `response.data`.

**Rules:**
- Must not add, remove, or rename any fields
- Must follow this structure exactly
- All fields are required (even if empty)
- All **requested output fields** from Skills Engine MUST be nested under `response.data` in the request body.

### 3.4 Request Routing Logic

The unified endpoint implements internal routing based on `requester_service`:

1. Endpoint receives the JSON request
2. Reads `requester_service` value
3. Routes to the correct internal handler based on mapping:

| requester_service | Internal Handler Folder |
|-------------------|------------------------|
| directory-ms | `/handlers/directory/` |
| assessment-ms | `/handlers/assessment/` |
| course-builder-ms | `/handlers/courses/` |
| content-studio-ms | `/handlers/content/` |
| learner-ai-ms | `/handlers/learner/` |
| analytics-ms | `/handlers/analytics/` |
| rag-ms | `/handlers/rag/` |

Each handler is responsible only for its specific microservice logic.

### 3.5 Response Construction

Each handler must return data inside the same response template the caller provided:

```json
{
  "requester_service": "<same as input>",
  "payload": { ...same payload received... },
  "response": {
    "status": "success",
    "message": "string describing the result",
    "data": { ...filled according to caller template... }
  }
}
```

**Rules:**
- Fill only what appears under `response.data` in the template
- Never add extra keys
- Never rename fields
- Never flatten or restructure data unless explicitly defined in handler logic
- If error occurs, return:
  ```json
  {
    "requester_service": "<same as input>",
    "payload": { ...same payload received... },
    "response": {
      "status": "error",
      "message": "description of the error",
      "data": {}
    }
  }
  ```

### 3.6 HTTP Status Codes

- `200 OK`: Request processed successfully
- `400 Bad Request`: Invalid request format or missing required fields
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Valid token but insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error during processing

---

## 4. Microservice-Specific API Contracts

### 4.1 Directory MS Integration

**Logical Operations:**
- Directory MS → Skills Engine: Send user data
- Skills Engine → Directory MS: Send initial/updated profiles

**Unified Protocol Implementation:**

#### 4.1.1 Directory MS Sends User Data

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "directory-ms",
  "payload": {
    "user_id": "string",
    "user_name": "string",
    "company_id": "string",
    "employee_type": "regular" | "trainer",
    "career_path": "string",
    "raw_data": {
      "claimed_skills": ["string"],
      "job_roles": ["string"],
      "certifications": ["string"],
      "experiences": ["string"]
    }
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Response:**
```json
{
  "requester_service": "directory-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "User profile created successfully",
    "data": {}
  }
}
```

**Behavior:**
- Skills Engine creates user profile (Feature 2.1)
- Triggers AI extraction (Feature 2.2)
- Returns acknowledgment

#### 4.1.2 Skills Engine Sends Initial Profile

**Request (from Skills Engine to Directory MS, via Coordinator using unified envelope):**
```json
POST /api/directory/initial-profile
{
  "requester_service": "skills-engine",
  "payload": {
  "user_id": "string",
  "relevanceScore": 0,
  "competencies": [
    {
      "competencyId": "string",
      "level": "undefined",
      "coverage": 0,
      "skills": [
        {
          "skillId": "string",
          "status": "unverified"
        }
      ]
    }
  ]
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Response (from Directory MS):**
```json
{
  "status": "success",
  "message": "Initial profile received"
}
```

**Behavior:**
- Triggered after Feature 2.4 completes
- All skills have `status="unverified"`
- All competencies have `level="undefined"`, `coverage=0`

#### 4.1.3 Skills Engine Sends Updated Profile

**Request (from Skills Engine to Directory MS, via Coordinator using unified envelope):**
```json
POST /api/directory/update-profile
{
  "requester_service": "skills-engine",
  "payload": {
  "user_id": "string",
  "user_name": "string",
  "company_id": "string",
  "competencies": [
    {
      "competency_id": "string",
      "competency_name": "string",
      "proficiency_level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | "UNDEFINED",
      "coverage": 0-100,
      "l1_skills": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ]
    }
  ],
  "relevance_score": 0-100,
  "updated_at": "timestamp"
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Response (from Directory MS):**
```json
{
  "status": "success",
  "message": "Profile updated successfully"
}
```

**Behavior:**
- Triggered after Feature 2.5 (Profile Updates)
- Includes verified skills and updated proficiency levels

---

### 4.2 Assessment MS Integration

**Logical Operations:**
- Skills Engine → Assessment MS: Send MGS list for exam creation
- Assessment MS → Skills Engine: Send exam results

**Unified Protocol Implementation:**

#### 4.2.1 Skills Engine Sends Baseline Exam Request

**Request (from Skills Engine to Assessment MS, via Coordinator using unified envelope):**
```json
POST /api/assessment/create-baseline-exam
{
  "requester_service": "skills-engine",
  "payload": {
  "user_id": "string",
  "user_name": "string",
  "company_id": "string",
  "competency_map": {
    "competency_id_1": [
      {
        "skill_id": "string",
        "skill_name": "string"
      }
    ],
    "competency_id_2": [...]
    }
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "exam_id": "string"
    }
  }
}
```

**Response (from Assessment MS):**
```json
{
  "status": "success",
  "message": "Baseline exam created",
  "exam_id": "string"
}
```

#### 4.2.2 Assessment MS Sends Baseline Exam Results

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "assessment-ms",
  "payload": {
    "exam_type": "baseline",
    "exam_status": "pass" | "fail",
    "final_grade": 0-100,
    "user_id": "string",
    "user_name": "string",
    "skills": [
      {
        "skill_id": "string",
        "skill_name": "string",
        "verified": true | false,
        "competency_name": "string"
      }
    ]
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Response:**
```json
{
  "requester_service": "assessment-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "Exam results processed successfully",
    "data": {}
  }
}
```

#### 4.2.3 Assessment MS Sends Post-Course Exam Results

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "assessment-ms",
  "payload": {
    "exam_type": "post-course",
    "exam_status": "pass" | "fail",
    "final_grade": 0-100,
    "user_id": "string",
    "user_name": "string",
    "company_id": "string",
    "course_name": "string",
    "skills": [
      {
        "skill_id": "string",
        "skill_name": "string",
        "verified": true
      }
    ]
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Response:**
```json
{
  "requester_service": "assessment-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "Post-course exam results processed successfully",
    "data": {}
  }
}
```

---

### 4.3 Course Builder MS Integration

**Logical Operation:**
- Course Builder MS → Skills Engine: Request MGS for competency (with external discovery if not found)

**Unified Protocol Implementation:**

#### 4.3.1 Course Builder MS Requests MGS

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "course-builder-ms",
  "payload": {
    "competency_name": "string"
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "competency_id": "string",
      "competency_name": "string",
      "mgs_list": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ],
      "discovered": true | false
    }
  }
}
```

**Response:**
```json
{
  "requester_service": "course-builder-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "MGS retrieved successfully",
    "data": {
      "competency_id": "string",
      "competency_name": "string",
      "mgs_list": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ],
      "discovered": false
    }
  }
}
```

**Behavior:**
- If competency found internally: returns MGS list, `discovered=false`
- If competency not found: triggers Feature 6.2 (External Discovery), stores competency, returns MGS list, `discovered=true`

---

### 4.4 Content Studio MS Integration

**Logical Operation:**
- Content Studio MS → Skills Engine: Request MGS for competency (internal lookup only, no external discovery)

**Unified Protocol Implementation:**

#### 4.4.1 Content Studio MS Requests MGS

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "content-studio-ms",
  "payload": {
    "competency_name": "string"
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "competency_id": "string | null",
      "competency_name": "string",
      "mgs_list": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ]
    }
  }
}
```

**Response:**
```json
{
  "requester_service": "content-studio-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "MGS retrieved successfully",
    "data": {
      "competency_id": "string",
      "competency_name": "string",
      "mgs_list": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ]
    }
  }
}
```

**Behavior:**
- Only performs internal lookup (Feature 6.1)
- If competency not found: returns empty `mgs_list`, `competency_id=null`
- No external discovery allowed

---

### 4.5 Learner AI MS Integration

**Logical Operations:**
- Skills Engine → Learner AI MS: Send gap analysis results
- Learner AI MS → Skills Engine: Request MGS for competency

**Unified Protocol Implementation:**

#### 4.5.1 Skills Engine Sends Gap Analysis Results

**Request (from Skills Engine to Learner AI MS, via Coordinator using unified envelope):**
```json
POST /api/learner-ai/gap-analysis-results
{
  "requester_service": "skills-engine",
  "payload": {
  "user_id": "string",
  "user_name": "string",
  "company_id": "string",
  "course_name": "string | null",
  "missing_mgs": {
    "competency_name_1": [
      {
        "skill_id": "string",
        "skill_name": "string"
      }
    ],
    "competency_name_2": [...]
  },
  "exam_status": "pass" | "fail" | null,
  "analysis_type": "broad" | "narrow"
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {}
  }
}
```

**Response (from Learner AI MS):**
```json
{
  "status": "success",
  "message": "Gap analysis received"
}
```

**Behavior:**
- Triggered after Feature 5 (Gap Analysis) completes
- Gap analysis calculated on-the-fly (not stored in database)
- Sent immediately to Learner AI MS and frontend

#### 4.5.2 Learner AI MS Requests MGS

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "learner-ai-ms",
  "payload": {
    "competency_name": "string"
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "competency_id": "string | null",
      "competency_name": "string",
      "mgs_list": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ]
    }
  }
}
```

**Response:**
```json
{
  "requester_service": "learner-ai-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "MGS retrieved successfully",
    "data": {
      "competency_id": "string",
      "competency_name": "string",
      "mgs_list": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ]
    }
  }
}
```

**Behavior:**
- Only performs internal lookup (Feature 6.1)
- If competency not found: returns empty `mgs_list`, `competency_id=null`
- No external discovery allowed

---

### 4.6 Learning Analytics MS Integration

**Logical Operations:**
- Learning Analytics MS → Skills Engine: Request user profiles
- Learning Analytics MS → Skills Engine: Request team aggregates

**Unified Protocol Implementation:**

#### 4.6.1 Learning Analytics MS Requests User Profiles

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "analytics-ms",
  "payload": {
    "user_ids": ["string"] | null,
    "company_id": "string" | null
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "users": [
        {
          "user_id": "string",
          "user_name": "string",
          "company_id": "string",
          "competencies": [
            {
              "competency_id": "string",
              "competency_name": "string",
              "proficiency_level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | "UNDEFINED",
              "verified_mgs_count": 0,
              "coverage": 0-100
            }
          ],
          "relevance_score": 0-100
        }
      ]
    }
  }
}
```

**Response:**
```json
{
  "requester_service": "analytics-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "User profiles retrieved successfully",
    "data": {
      "users": [
        {
          "user_id": "string",
          "user_name": "string",
          "company_id": "string",
          "competencies": [...],
          "relevance_score": 75.5
        }
      ]
    }
  }
}
```

**Behavior:**
- If `user_ids` provided: returns profiles for specified users
- If `user_ids` not provided: returns all users (optionally filtered by `company_id`)
- Returns verified user profiles with proficiency levels and coverage

#### 4.6.2 Learning Analytics MS Requests Team Aggregates

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "analytics-ms",
  "payload": {
    "company_id": "string",
    "team_ids": ["string"] | null
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "company_id": "string",
      "average_proficiency_levels": {
        "competency_id_1": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT",
        "competency_id_2": "..."
      },
      "team_gap_summary": {
        "competency_name": [
          {
            "skill_id": "string",
            "skill_name": "string"
          }
        ]
      },
      "total_verified_mgs_count": 0,
      "coverage_statistics": {
        "average": 0-100,
        "min": 0-100,
        "max": 0-100
      }
    }
  }
}
```

**Response:**
```json
{
  "requester_service": "analytics-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "Team aggregates retrieved successfully",
    "data": {
      "company_id": "string",
      "average_proficiency_levels": {...},
      "team_gap_summary": {...},
      "total_verified_mgs_count": 150,
      "coverage_statistics": {
        "average": 65.5,
        "min": 20.0,
        "max": 95.0
      }
    }
  }
}
```

**Behavior:**
- Aggregates data for all users in company/teams
- Calculates average proficiency levels per competency
- Provides team gap summary
- Returns coverage statistics

---

### 4.7 RAG/Chatbot MS Integration

**Logical Operation:**
- RAG MS → Skills Engine: Request normalized taxonomy and gap data

**Unified Protocol Implementation:**

#### 4.7.1 RAG MS Requests Taxonomy & Gap Data

**Request:**
```json
POST /api/fill-content-metrics/
{
  "requester_service": "rag-ms",
  "payload": {
    "user_id": "string" | null,
    "competency_name": "string" | null
  },
  "response": {
    "status": "success | error",
    "message": "string",
    "data": {
      "taxonomy": {
        "competencies": [...],
        "skills": [...]
      },
      "gap_data": {
        "user_id": "string",
        "missing_mgs": {
          "competency_name": [
            {
              "skill_id": "string",
              "skill_name": "string"
            }
          ]
        }
      } | null
    }
  }
}
```

**Response:**
```json
{
  "requester_service": "rag-ms",
  "payload": { ...same as input... },
  "response": {
    "status": "success",
    "message": "Taxonomy and gap data retrieved successfully",
    "data": {
      "taxonomy": {
        "competencies": [...],
        "skills": [...]
      },
      "gap_data": {
        "user_id": "string",
        "missing_mgs": {...}
      }
    }
  }
}
```

**Behavior:**
- Returns normalized taxonomy (competencies and skills)
- If `user_id` provided: includes gap analysis data for that user
- Gap analysis calculated on-the-fly (not stored)

---

## 5. REST API for Frontend/UI

The Skills Engine frontend consumes the following REST API endpoints (separate from the Unified Data Exchange Protocol used by microservices).

### 5.1 Unified User Profile & Dashboard Endpoint

**Note:** All users (regular employees and trainers) use the same endpoint to access their profile and competency data. The system checks the `employee_type` field from the basic profile to determine UI rendering (e.g., showing/hiding CSV upload button for trainers).

#### 5.1.1 Get User Profile

**Endpoint:**
```
GET /api/user/{user_id}/profile
```

**Path Parameters:**
- `user_id` (string, required): User identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "basic_profile": {
    "user_id": "string",
    "user_name": "string",
    "company_id": "string",
    "employee_type": "regular" | "trainer",
    "career_path_goal": {},
    "basic_info": {},
    "relevance_score": 0-100
  },
  "competencies": [
    {
      "id": "string",
      "title": "string",
      "percentage": 0-100,
      "skillsTotal": 0,
      "skillsMastered": 0,
      "missingMgsCount": 0
    }
  ],
  "competency_trees": {
    "competency_id_1": {
      "tree": {
        "l1": {
          "label": "string",
          "percent": "string",
          "children": {
            "l2": {
              "label": "string",
              "percent": "string",
              "children": {
                "l3": {
                  "label": "string",
                  "percent": "string",
                  "skills": [
                    {
                      "code": "string",
                      "label": "string",
                      "percent": "string",
                      "passed": true | false
                    }
                  ]
                }
              }
            }
          }
        }
      },
      "missing_mgs": {
        "competency_name": [
          {
            "skill_id": "string",
            "skill_name": "string"
          }
        ]
      }
    }
  },
  "gap_analysis": {
    "missing_mgs": {
      "competency_name": [
        {
          "skill_id": "string",
          "skill_name": "string"
        }
      ]
    }
  }
}
```

**Important Notes:**
- **Gap analysis is always calculated on-the-fly** when the endpoint is called (Feature 5). **It is never stored in the database.**
- **No database write operations** are performed for gap analysis—it is purely a read-time calculation.
- The calculation is performed based on:
  - Required MGS from competency definitions (read from `competencies` and `competency_skills` tables)
  - Verified MGS from user's competency profile (read from `userCompetency` table)
  - Missing MGS = Required MGS - Verified MGS
- The calculated gap data is sent immediately to:
  - Frontend (for display in UI)
  - Learner AI MS (via Unified Data Exchange Protocol, Feature 8.6)

**UI Behavior:**
- Frontend checks `basic_profile.employee_type` to conditionally render UI elements
- If `employee_type === "trainer"`: Show CSV upload button in header, show Trainer Imports navigation item
- If `employee_type === "regular"`: Hide trainer-specific features
- All users see the same competency dashboard with cards and modal overlay

**HTTP Status Codes:**
- `200 OK`: Profile retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this profile
- `404 Not Found`: User not found

---

#### 5.1.2 Get Competency Tree (Optional - Lazy Loading)

**Endpoint:**
```
GET /api/user-competency/{user_id}/competency/{competency_id}/tree
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `competency_id` (string, required): Competency identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "competency_id": "string",
  "competency_name": "string",
  "tree": {
    "l1": {
      "label": "string",
      "percent": "string",
      "children": {
        "l2": {
          "label": "string",
          "percent": "string",
          "children": {
            "l3": {
              "label": "string",
              "percent": "string",
              "skills": [
                {
                  "code": "string",
                  "label": "string",
                  "percent": "string",
                  "passed": true | false
                }
              ]
            }
          }
        }
      }
    }
  },
  "missing_mgs": {
    "competency_name": [
      {
        "skill_id": "string",
        "skill_name": "string"
      }
    ]
  }
}
```

**Behavior:**
- Used when user clicks a competency card to open the detail modal
- Returns full hierarchical tree structure (L0–L4) for a specific user competency
- Includes verification status, percentages, and missing MGS list

**HTTP Status Codes:**
- `200 OK`: Tree retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this competency
- `404 Not Found`: Competency not found

---

### 5.2 Competency & Skill Import Endpoints

**Note:** Adding custom skills or competencies via CSV upload is part of the competency/taxonomy management routes, not a separate trainer route. Access is controlled by checking `employee_type === "trainer"` in the user's basic profile.

#### 5.2.1 Import Competencies & Skills from CSV

**Endpoint:**
```
POST /api/competencies/import
```

**Content-Type:**
```
multipart/form-data
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
- `file` (file, required): CSV file containing competencies and skills
- File format: See CSV template documentation

**Response (Synchronous - if processing is fast):**
```json
{
  "status": "success",
  "message": "Import completed successfully",
  "results": {
    "competencies_added": 0,
    "skills_added": 0,
    "duplicates_skipped": 0,
    "errors": []
  },
  "timestamp": "2025-01-27T10:00:00Z"
}
```

**Response (Asynchronous - if processing takes time):**
```json
{
  "status": "processing",
  "message": "Import job queued",
  "job_id": "string",
  "timestamp": "2025-01-27T10:00:00Z"
}
```

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile
- Backend validates `employee_type` before allowing access

**HTTP Status Codes:**
- `200 OK`: Import completed or queued successfully
- `400 Bad Request`: Invalid file format or missing file
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer (`employee_type !== "trainer"`)
- `413 Payload Too Large`: File size exceeds limit
- `500 Internal Server Error`: Server error during processing

---

### 5.3 Taxonomy Management Endpoints

These endpoints provide CRUD operations for competencies, skills, userCompetency, and userSkill entities.

#### 5.3.1 Competency Endpoints

##### 5.3.1.1 Get All Competencies

**Endpoint:**
```
GET /api/competencies
```

**Query Parameters:**
- `parent_competency_id` (string, optional): Filter by parent competency
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `search` (string, optional): Search by competency name

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "data": [
    {
      "competency_id": "string",
      "competency_name": "string",
      "description": "string | null",
      "parent_competency_id": "string | null",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

**HTTP Status Codes:**
- `200 OK`: Competencies retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions

---

##### 5.3.1.2 Get Competency by ID

**Endpoint:**
```
GET /api/competencies/{competency_id}
```

**Path Parameters:**
- `competency_id` (string, required): Competency identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "competency_id": "string",
  "competency_name": "string",
  "description": "string | null",
  "parent_competency_id": "string | null",
  "child_competencies": [
    {
      "competency_id": "string",
      "competency_name": "string"
    }
  ],
  "linked_skills": [
    {
      "skill_id": "string",
      "skill_name": "string"
    }
  ],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**HTTP Status Codes:**
- `200 OK`: Competency retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Competency not found

---

##### 5.3.1.3 Create Competency

**Endpoint:**
```
POST /api/competencies
```

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "competency_id": "string",
  "competency_name": "string",
  "description": "string | null",
  "parent_competency_id": "string | null"
}
```

**Response:**
```json
{
  "competency_id": "string",
  "competency_name": "string",
  "description": "string | null",
  "parent_competency_id": "string | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**HTTP Status Codes:**
- `201 Created`: Competency created successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `409 Conflict`: Competency with this ID already exists

---

##### 5.3.1.4 Update Competency

**Endpoint:**
```
PUT /api/competencies/{competency_id}
```

**Path Parameters:**
- `competency_id` (string, required): Competency identifier

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "competency_name": "string",
  "description": "string | null",
  "parent_competency_id": "string | null"
}
```

**Response:**
```json
{
  "competency_id": "string",
  "competency_name": "string",
  "description": "string | null",
  "parent_competency_id": "string | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**HTTP Status Codes:**
- `200 OK`: Competency updated successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `404 Not Found`: Competency not found

---

##### 5.3.1.5 Delete Competency

**Endpoint:**
```
DELETE /api/competencies/{competency_id}
```

**Path Parameters:**
- `competency_id` (string, required): Competency identifier

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Competency deleted successfully"
}
```

**HTTP Status Codes:**
- `200 OK`: Competency deleted successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `404 Not Found`: Competency not found
- `409 Conflict`: Cannot delete competency with child competencies or linked skills

---

##### 5.3.1.6 Link Skills to Competency

**Endpoint:**
```
POST /api/competencies/{competency_id}/skills
```

**Path Parameters:**
- `competency_id` (string, required): Competency identifier

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "skill_ids": ["string"]
}
```

**Response:**
```json
{
  "competency_id": "string",
  "linked_skills": [
    {
      "skill_id": "string",
      "skill_name": "string"
    }
  ]
}
```

**HTTP Status Codes:**
- `200 OK`: Skills linked successfully
- `400 Bad Request`: Invalid skill IDs or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `404 Not Found`: Competency not found

---

#### 5.3.2 Skill Endpoints

##### 5.3.2.1 Get All Skills

**Endpoint:**
```
GET /api/skills
```

**Query Parameters:**
- `parent_skill_id` (string, optional): Filter by parent skill
- `level` (string, optional): Filter by level (L1, L2, L3, L4/MGS)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `search` (string, optional): Search by skill name

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "data": [
    {
      "skill_id": "string",
      "skill_name": "string",
      "description": "string | null",
      "parent_skill_id": "string | null",
      "level": "L1" | "L2" | "L3" | "L4",
      "is_mgs": true | false,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "total_pages": 25,
    "has_next": true,
    "has_prev": false
  }
}
```

**HTTP Status Codes:**
- `200 OK`: Skills retrieved successfully
- `401 Unauthorized`: Missing or invalid token

---

##### 5.3.2.2 Get Skill by ID

**Endpoint:**
```
GET /api/skills/{skill_id}
```

**Path Parameters:**
- `skill_id` (string, required): Skill identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "skill_id": "string",
  "skill_name": "string",
  "description": "string | null",
  "parent_skill_id": "string | null",
  "level": "L1" | "L2" | "L3" | "L4",
  "is_mgs": true | false,
  "child_skills": [
    {
      "skill_id": "string",
      "skill_name": "string"
    }
  ],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**HTTP Status Codes:**
- `200 OK`: Skill retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Skill not found

---

##### 5.3.2.3 Get Skill Hierarchy Tree

**Endpoint:**
```
GET /api/skills/{skill_id}/tree
```

**Path Parameters:**
- `skill_id` (string, required): Skill identifier (L1 skill)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "skill_id": "string",
  "skill_name": "string",
  "level": "L1",
  "children": [
    {
      "skill_id": "string",
      "skill_name": "string",
      "level": "L2",
      "children": [
        {
          "skill_id": "string",
          "skill_name": "string",
          "level": "L3",
          "children": [
            {
              "skill_id": "string",
              "skill_name": "string",
              "level": "L4",
              "is_mgs": true,
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "total_mgs_count": 0
}
```

**HTTP Status Codes:**
- `200 OK`: Skill tree retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Skill not found

---

##### 5.3.2.4 Create Skill

**Endpoint:**
```
POST /api/skills
```

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "skill_id": "string",
  "skill_name": "string",
  "description": "string | null",
  "parent_skill_id": "string | null"
}
```

**Response:**
```json
{
  "skill_id": "string",
  "skill_name": "string",
  "description": "string | null",
  "parent_skill_id": "string | null",
  "level": "L1" | "L2" | "L3" | "L4",
  "is_mgs": true | false,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**HTTP Status Codes:**
- `201 Created`: Skill created successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `409 Conflict`: Skill with this ID already exists

---

##### 5.3.2.5 Update Skill

**Endpoint:**
```
PUT /api/skills/{skill_id}
```

**Path Parameters:**
- `skill_id` (string, required): Skill identifier

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "skill_name": "string",
  "description": "string | null",
  "parent_skill_id": "string | null"
}
```

**Response:**
```json
{
  "skill_id": "string",
  "skill_name": "string",
  "description": "string | null",
  "parent_skill_id": "string | null",
  "level": "L1" | "L2" | "L3" | "L4",
  "is_mgs": true | false,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**HTTP Status Codes:**
- `200 OK`: Skill updated successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `404 Not Found`: Skill not found

---

##### 5.3.2.6 Delete Skill

**Endpoint:**
```
DELETE /api/skills/{skill_id}
```

**Path Parameters:**
- `skill_id` (string, required): Skill identifier

**Authorization:**
- Requires `employee_type = "trainer"` in user's basic profile

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Skill deleted successfully"
}
```

**HTTP Status Codes:**
- `200 OK`: Skill deleted successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User is not a trainer
- `404 Not Found`: Skill not found
- `409 Conflict`: Cannot delete skill with child skills or linked to competencies

---

#### 5.3.3 User Competency Endpoints

##### 5.3.3.1 Get User Competencies

**Endpoint:**
```
GET /api/user-competency/{user_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier

**Query Parameters:**
- `competency_id` (string, optional): Filter by specific competency
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "data": [
    {
      "user_id": "string",
      "competency_id": "string",
      "competency_name": "string",
      "coverage_percentage": 0.00-100.00,
      "proficiency_level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null,
      "verified_skills": [
        {
          "skill_id": "string",
          "skill_name": "string",
          "verified": true,
          "lastUpdate": "timestamp"
        }
      ],
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

**Authorization:**
- Users can only access their own competencies (`user_id` must match authenticated user)
- Admin/Ops can access any user's competencies

**HTTP Status Codes:**
- `200 OK`: User competencies retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access these competencies
- `404 Not Found`: User not found

---

##### 5.3.3.2 Get User Competency by ID

**Endpoint:**
```
GET /api/user-competency/{user_id}/{competency_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `competency_id` (string, required): Competency identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "user_id": "string",
  "competency_id": "string",
  "competency_name": "string",
  "coverage_percentage": 0.00-100.00,
  "proficiency_level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null,
  "verified_skills": [
    {
      "skill_id": "string",
      "skill_name": "string",
      "verified": true,
      "lastUpdate": "timestamp"
    }
  ],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Authorization:**
- Users can only access their own competencies
- Admin/Ops can access any user's competencies

**HTTP Status Codes:**
- `200 OK`: User competency retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this competency
- `404 Not Found`: User competency not found

---

##### 5.3.3.3 Create/Update User Competency

**Endpoint:**
```
PUT /api/user-competency/{user_id}/{competency_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `competency_id` (string, required): Competency identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "coverage_percentage": 0.00-100.00,
  "proficiency_level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null,
  "verified_skills": [
    {
      "skill_id": "string",
      "skill_name": "string",
      "verified": true,
      "lastUpdate": "timestamp"
    }
  ]
}
```

**Response:**
```json
{
  "user_id": "string",
  "competency_id": "string",
  "competency_name": "string",
  "coverage_percentage": 0.00-100.00,
  "proficiency_level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null,
  "verified_skills": [...],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Behavior:**
- Creates user competency if it doesn't exist
- Updates user competency if it already exists (upsert operation)
- Coverage percentage and proficiency level are calculated automatically based on verified skills

**Authorization:**
- Users can only update their own competencies
- Admin/Ops can update any user's competencies

**HTTP Status Codes:**
- `200 OK`: User competency created/updated successfully
- `201 Created`: User competency created successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot update this competency
- `404 Not Found`: User or competency not found

---

##### 5.3.3.4 Delete User Competency

**Endpoint:**
```
DELETE /api/user-competency/{user_id}/{competency_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `competency_id` (string, required): Competency identifier

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "User competency deleted successfully"
}
```

**Authorization:**
- Users can only delete their own competencies
- Admin/Ops can delete any user's competencies

**HTTP Status Codes:**
- `200 OK`: User competency deleted successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot delete this competency
- `404 Not Found`: User competency not found

---

#### 5.3.4 User Skill Endpoints

##### 5.3.4.1 Get User Skills

**Endpoint:**
```
GET /api/user-skill/{user_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier

**Query Parameters:**
- `skill_id` (string, optional): Filter by specific skill
- `verified` (boolean, optional): Filter by verification status
- `source` (string, optional): Filter by source ('assessment', 'certification', 'claim', 'ai')
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "data": [
    {
      "user_id": "string",
      "skill_id": "string",
      "skill_name": "string",
      "verified": true | false,
      "source": "assessment" | "certification" | "claim" | "ai",
      "last_update": "timestamp",
      "created_at": "timestamp"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

**Authorization:**
- Users can only access their own skills
- Admin/Ops can access any user's skills

**HTTP Status Codes:**
- `200 OK`: User skills retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access these skills
- `404 Not Found`: User not found

---

##### 5.3.4.2 Get User Skill by ID

**Endpoint:**
```
GET /api/user-skill/{user_id}/{skill_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `skill_id` (string, required): Skill identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "user_id": "string",
  "skill_id": "string",
  "skill_name": "string",
  "verified": true | false,
  "source": "assessment" | "certification" | "claim" | "ai",
  "last_update": "timestamp",
  "created_at": "timestamp"
}
```

**Authorization:**
- Users can only access their own skills
- Admin/Ops can access any user's skills

**HTTP Status Codes:**
- `200 OK`: User skill retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this skill
- `404 Not Found`: User skill not found

---

##### 5.3.4.3 Create/Update User Skill

**Endpoint:**
```
PUT /api/user-skill/{user_id}/{skill_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `skill_id` (string, required): Skill identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "skill_name": "string",
  "verified": true | false,
  "source": "assessment" | "certification" | "claim" | "ai"
}
```

**Response:**
```json
{
  "user_id": "string",
  "skill_id": "string",
  "skill_name": "string",
  "verified": true | false,
  "source": "assessment" | "certification" | "claim" | "ai",
  "last_update": "timestamp",
  "created_at": "timestamp"
}
```

**Behavior:**
- Creates user skill if it doesn't exist
- Updates user skill if it already exists (upsert operation)

**Authorization:**
- Users can only update their own skills
- Admin/Ops can update any user's skills

**HTTP Status Codes:**
- `200 OK`: User skill created/updated successfully
- `201 Created`: User skill created successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot update this skill
- `404 Not Found`: User or skill not found

---

##### 5.3.4.4 Delete User Skill

**Endpoint:**
```
DELETE /api/user-skill/{user_id}/{skill_id}
```

**Path Parameters:**
- `user_id` (string, required): User identifier
- `skill_id` (string, required): Skill identifier

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "User skill deleted successfully"
}
```

**Authorization:**
- Users can only delete their own skills
- Admin/Ops can delete any user's skills

**HTTP Status Codes:**
- `200 OK`: User skill deleted successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot delete this skill
- `404 Not Found`: User skill not found

---

### 5.4 Additional Profile Endpoints (Optional)

These endpoints provide additional detail when needed, but the main `/api/user/{user_id}/profile` endpoint (Section 5.1) contains all essential data for the dashboard.

#### 5.4.1 Get Detailed User Profile

**Endpoint:**
```
GET /api/user/{user_id}/profile/detailed
```

**Path Parameters:**
- `user_id` (string, required): User identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "basic_profile": {...},
  "raw_data": {...},
  "ai_extraction": {
    "output": {...},
    "prompt_version": "string",
    "model": "gemini-1.5-flash",
    "provider": "google",
    "timestamp": "timestamp"
  },
  "normalization": {
    "normalized_data": {...},
    "mapping": {...},
    "timestamp": "timestamp"
  },
  "verification_history": [
    {
      "exam_type": "baseline" | "post-course",
      "date": "timestamp",
      "status": "pass" | "fail",
      "score": 0-100
    }
  ],
  "gap_analysis": {...}
}
```

**Behavior:**
- Returns extended user profile including raw data, AI extraction results, verification history, normalization details
- Used for the "User Profile Detail View" screen (Section 6.3 in UX Design)

**HTTP Status Codes:**
- `200 OK`: Detailed profile retrieved successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this profile
- `404 Not Found`: User not found

---

**Note:** There is no separate endpoint for gap analysis (`/api/user/{user_id}/profile/gap-analysis`) because gap analysis is always calculated on-the-fly and included in the main profile endpoint (`GET /api/user/{user_id}/profile`). The gap analysis data is part of the `gap_analysis` field in the profile response and is calculated in real-time on every request.

---

#### 5.4.2 Export User Profile

**Endpoint:**
```
POST /api/user/{user_id}/profile/export
```

**Path Parameters:**
- `user_id` (string, required): User identifier

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "format": "json" | "pdf",
  "include_raw_data": true | false,
  "include_verification_history": true | false
}
```

**Response:**
```json
{
  "status": "success",
  "download_url": "https://{project-name}.up.railway.app/api/exports/{export_id}",
  "expires_at": "timestamp"
}
```

**Behavior:**
- Triggers profile JSON/PDF export
- Returns download URL (temporary, expires after 24 hours)
- Available to all users for exporting their own profile data

**HTTP Status Codes:**
- `200 OK`: Export job created successfully
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: User cannot access this profile
- `404 Not Found`: User not found

---

## 6. Error Handling

### 6.1 Error Response Format

All error responses follow this standard format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2025-01-27T10:00:00Z",
    "correlation_id": "string"
  }
}
```

### 6.2 Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request format or missing required fields |
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | Valid token but insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate entry) |
| 413 | `PAYLOAD_TOO_LARGE` | Request payload exceeds size limit |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Internal server error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

### 6.3 Validation Errors

When validation fails, the error response includes field-level details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "user_id": ["User ID is required"],
        "employee_type": ["Invalid employee_type value. Must be 'regular' or 'trainer'"]
      }
    },
    "timestamp": "2025-01-27T10:00:00Z",
    "correlation_id": "abc123"
  }
}
```

---

## 7. Rate Limiting

**Rate Limits:**
- **Unified Protocol Endpoint:** 100 requests per minute per microservice
- **Frontend API Endpoints:** 200 requests per minute per user
- **Import Endpoints:** 10 requests per hour per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643200000
```

**Rate Limit Exceeded Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "retry_after": 60
  }
}
```

---

## 8. API Versioning

**Version Strategy:**
- API version included in URL path: `/api/v1/...`
- Current version: `v1`
- Future versions: `v2`, `v3`, etc.

**Versioning Rules:**
- Breaking changes require new version
- Non-breaking changes can be added to existing version
- Deprecated endpoints marked with `X-Deprecated` header
- Minimum 6 months notice before removing deprecated endpoints

---

## 9. Pagination

**Pagination Parameters:**
- `page` (integer, default: 1): Page number (1-indexed)
- `limit` (integer, default: 20, max: 100): Items per page

**Pagination Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 10. Webhooks & Events

**Webhook Endpoints (Future):**
- Webhook support for async operations
- Event-driven architecture for profile updates
- Notification callbacks for import completion

**Note:** Webhook support will be added in Phase 2/3 of rollout strategy.

---

## 11. API Documentation

**Documentation Access:**
- OpenAPI/Swagger specification available at `/api/docs`
- Interactive API explorer
- Code examples for each endpoint

**Documentation Updates:**
- Updated automatically with code changes
- Versioned with API versions
- Includes request/response examples

---

## 12. Testing & Mocking

**Test Endpoints:**
- Test environment: `https://{project-name}-test.up.railway.app` (or separate Railway project for testing)
- Mock responses available for development
- Test data seeding endpoints (dev only)

**Mock Responses:**
- Mock data for all endpoints
- Configurable response delays
- Error scenario simulation

---

**Next Steps:**
- Review API contracts with microservice teams
- Create OpenAPI/Swagger specification
- Implement API endpoints
- Set up API documentation portal
- Create integration tests

