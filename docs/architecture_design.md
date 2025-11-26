# Step 7: Architecture Design

**Project:** Skills Engine Microservice  
**Platform:** EduCora AI (11 microservices)  
**Date:** 2025-01-27  
**Status:** Draft

---

## 1. Overview

This document defines the complete architecture design for the Skills Engine microservice, including technology stack, system architecture, deployment strategy, and development workflow.

---

## 2. Technology Stack

### 2.1 Frontend

**Framework:**
- **Next.js** - React framework with server-side rendering and static site generation

**Deployment:**
- **Vercel** - Automatic deployments on git push
- **Environment:** Production, Staging (via branches)

**Key Features:**
- Server-side rendering (SSR)
- Static site generation (SSG)
- API routes (if needed for frontend-specific endpoints)
- TypeScript support
- Tailwind CSS for styling

### 2.2 Backend

**Runtime:**
- **Node.js** - JavaScript runtime environment

**Framework:**
- **Express.js** - Web application framework for Node.js

**API Type:**
- **REST only** - All endpoints follow RESTful principles

**Deployment:**
- **Railway** - Platform for deploying Node.js applications
- **Domain:** `{project-name}.up.railway.app`
- **Environment Variables:** Managed via Railway dashboard

**Key Features:**
- RESTful API endpoints
- Middleware support (authentication, validation, error handling)
- Modular architecture (routes, controllers, services, repositories)
- TypeScript support (optional but recommended)

### 2.3 Database

**Type:**
- **PostgreSQL** - Relational database management system

**Provider:**
- **Supabase** - PostgreSQL hosting with additional features

**Connection:**
- Via connection string from Supabase dashboard
- Connection pooling for optimal performance

**Migrations:**
- Managed via migration scripts or Supabase CLI
- Version-controlled schema changes

**Key Features:**
- ACID compliance
- JSON/JSONB support for flexible data structures
- Full-text search capabilities
- Row-level security (if needed)

### 2.4 Version Control & CI/CD

**Version Control:**
- **GitHub** - Source code repository
- **Branching Strategy:**
  - `main` - Production branch
  - `develop` - Development branch
  - `feature/*` - Feature branches
  - `hotfix/*` - Hotfix branches

**CI/CD:**
- **GitHub Actions** - Automated workflows
- **Workflows:**
  - Run tests on push/PR
  - Lint code
  - Build application
  - Deploy to Railway (backend) and Vercel (frontend)

### 2.5 Testing

**Framework:**
- **Jest** or **Vitest** - JavaScript testing framework

**Test Types:**
- **Unit Tests:** Test individual functions and services
- **Integration Tests:** Test API endpoints and database interactions
- **E2E Tests:** Test complete user workflows

**Coverage:**
- Target: 80%+ code coverage
- Critical paths: 100% coverage

### 2.6 AI Integration

**Provider:**
- **Google Gemini API** - Primary AI provider

**Models Used:**
- **Gemini 1.5 Flash:**
  - Skill/competency extraction from user profiles
  - Normalization of extracted data
  - Quick validation of data quality
- **Gemini 1.5 Pro (Deep Search):**
  - Deep web scanning and extraction
  - Extraction from external sources
  - Comprehensive validation of extracted data

**API Endpoint:**
- `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

**Authentication:**
- Google API Key (stored securely in environment variables)
- Not exposed in API responses

**Fallback:**
- Local AI simulation for development/testing
- Mock responses for offline development

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │
│   Vercel        │
└────────┬────────┘
         │
         │ REST API
         │
┌────────▼────────────────────────┐
│      Backend                    │
│   (Node.js + Express.js)        │
│   Railway                       │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Unified Endpoint        │  │
│  │  /api/fill-content-      │  │
│  │  metrics/                │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  REST API Endpoints      │  │
│  │  /api/user/*             │  │
│  │  /api/competencies/*     │  │
│  │  /api/skills/*           │  │
│  └──────────────────────────┘  │
└────────┬────────────────────────┘
         │
         │ SQL Queries
         │
┌────────▼────────┐
│   Database      │
│  (PostgreSQL)   │
│   Supabase      │
└─────────────────┘
         │
         │ API Calls
         │
┌────────▼────────┐
│  Google Gemini  │
│      API        │
└─────────────────┘
```

### 3.2 Microservice Integration

```
┌─────────────────┐
│  Directory MS   │
└────────┬────────┘
         │
┌────────▼────────┐
│ Assessment MS  │
└────────┬────────┘
         │
┌────────▼────────┐
│ Course Builder │
└────────┬────────┘
         │
┌────────▼────────┐
│ Content Studio │
└────────┬────────┘
         │
┌────────▼────────┐
│  Learner AI MS  │
└────────┬────────┘
         │
┌────────▼────────┐
│   Analytics MS  │
└────────┬────────┘
         │
┌────────▼────────┐
│    RAG MS       │
└────────┬────────┘
         │
         │ Unified Protocol
         │ POST /api/fill-content-metrics/
         │
┌────────▼────────────────────────┐
│      Skills Engine              │
│   (This Microservice)           │
└─────────────────────────────────┘
```

---

## 4. Backend Architecture

### 4.1 Directory Structure

```
backend/
├── routes/                    # API route definitions
│   ├── api/
│   │   ├── user/
│   │   │   ├── profile.js
│   │   │   └── export.js
│   │   ├── competencies/
│   │   │   ├── index.js
│   │   │   ├── import.js
│   │   │   └── [competencyId].js
│   │   ├── skills/
│   │   │   ├── index.js
│   │   │   ├── [skillId].js
│   │   │   └── [skillId]/tree.js
│   │   ├── user-competency/
│   │   │   ├── [userId].js
│   │   │   └── [userId]/[competencyId].js
│   │   ├── user-skill/
│   │   │   ├── [userId].js
│   │   │   └── [userId]/[skillId].js
│   │   └── fill-content-metrics/
│   │       └── index.js          # Unified endpoint
│   └── index.js
│
├── controllers/                # Request handlers
│   ├── userController.js
│   ├── competencyController.js
│   ├── skillController.js
│   ├── userCompetencyController.js
│   ├── userSkillController.js
│   ├── importController.js
│   ├── gapAnalysisController.js
│   └── unifiedEndpointController.js
│
├── services/                   # Business logic layer
│   ├── userService.js
│   ├── competencyService.js
│   ├── skillService.js
│   ├── userCompetencyService.js
│   ├── userSkillService.js
│   ├── gapAnalysisService.js
│   ├── extractionService.js
│   ├── normalizationService.js
│   ├── validationService.js
│   ├── mgsCalculationService.js
│   └── aiService.js
│
├── repositories/               # Data access layer
│   ├── userRepository.js
│   ├── competencyRepository.js
│   ├── skillRepository.js
│   ├── userCompetencyRepository.js
│   ├── userSkillRepository.js
│   └── baseRepository.js
│
├── models/                     # Database models/entities
│   ├── User.js
│   ├── Competency.js
│   ├── Skill.js
│   ├── UserCompetency.js
│   └── UserSkill.js
│
├── middleware/                 # Express middleware
│   ├── auth.js                 # Authentication middleware
│   ├── validation.js           # Request validation
│   ├── errorHandler.js         # Error handling
│   ├── rateLimiter.js          # Rate limiting
│   └── logger.js               # Request logging
│
├── handlers/                   # Unified endpoint handlers
│   ├── directory/
│   │   └── index.js
│   ├── assessment/
│   │   └── index.js
│   ├── courses/
│   │   └── index.js
│   ├── content/
│   │   └── index.js
│   ├── learner/
│   │   └── index.js
│   ├── analytics/
│   │   └── index.js
│   └── rag/
│       └── index.js
│
├── utils/                      # Utility functions
│   ├── logger.js
│   ├── constants.js
│   ├── helpers.js
│   ├── validators.js
│   └── formatters.js
│
├── config/                     # Configuration files
│   ├── database.js             # Database connection
│   ├── ai.js                   # AI service configuration
│   ├── env.js                  # Environment variables
│   └── routes.js               # Route configuration
│
├── tests/                      # Test files
│   ├── unit/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── repositories/
│   ├── integration/
│   │   ├── api/
│   │   └── database/
│   └── e2e/
│       └── workflows/
│
├── migrations/                 # Database migrations
│   └── *.sql
│
├── .env.example               # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json              # TypeScript config (if using TS)
└── index.js                   # Application entry point
```

### 4.2 Architecture Layers

#### 4.2.1 Routes Layer (`routes/`)

**Purpose:** Define API endpoints and HTTP methods

**Responsibilities:**
- Map URLs to controller functions
- Handle HTTP methods (GET, POST, PUT, DELETE)
- Validate request structure
- Apply middleware (authentication, rate limiting)
- Format responses

**Example:**
```javascript
// routes/api/user/profile.js
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { authenticate } = require('../../middleware/auth');

router.get('/:userId/profile', authenticate, userController.getProfile);

module.exports = router;
```

#### 4.2.2 Controllers Layer (`controllers/`)

**Purpose:** Handle HTTP requests and orchestrate business logic

**Responsibilities:**
- Receive HTTP requests from routes
- Validate request parameters and body
- Call appropriate services
- Format responses
- Handle errors

**Example:**
```javascript
// controllers/userController.js
const userService = require('../services/userService');

exports.getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const profile = await userService.getUserProfile(userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};
```

#### 4.2.3 Services Layer (`services/`)

**Purpose:** Implement core business logic

**Responsibilities:**
- Coordinate between multiple repositories
- Implement algorithms (gap analysis, MGS calculation)
- Handle AI integration
- Transform data
- Enforce business rules

**Example:**
```javascript
// services/gapAnalysisService.js
const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const competencyRepository = require('../repositories/competencyRepository');
const skillRepository = require('../repositories/skillRepository');

exports.calculateGapAnalysis = async (userId) => {
  // Get user competencies
  const userCompetencies = await userCompetencyRepository.findByUserId(userId);
  
  // Calculate missing MGS for each competency
  const missingMgs = {};
  
  for (const userComp of userCompetencies) {
    const requiredMgs = await this.getRequiredMgs(userComp.competency_id);
    const verifiedMgs = userComp.verified_skills || [];
    missingMgs[userComp.competency_name] = requiredMgs.filter(
      mgs => !verifiedMgs.some(v => v.skill_id === mgs.skill_id)
    );
  }
  
  return missingMgs;
};
```

#### 4.2.4 Repositories Layer (`repositories/`)

**Purpose:** Abstract database operations

**Responsibilities:**
- Provide data access methods
- Handle SQL queries
- Manage database transactions
- Map database results to models

**Example:**
```javascript
// repositories/userCompetencyRepository.js
const db = require('../config/database');

exports.findByUserId = async (userId) => {
  const query = `
    SELECT uc.*, c.competency_name
    FROM userCompetency uc
    JOIN competencies c ON uc.competency_id = c.competency_id
    WHERE uc.user_id = $1
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
};
```

#### 4.2.5 Models Layer (`models/`)

**Purpose:** Define data structures and validation

**Responsibilities:**
- Define data schemas
- Validate data
- Map database tables to JavaScript objects
- Provide type safety (if using TypeScript)

**Example:**
```javascript
// models/UserCompetency.js
class UserCompetency {
  constructor(data) {
    this.user_id = data.user_id;
    this.competency_id = data.competency_id;
    this.coverage_percentage = data.coverage_percentage || 0.00;
    this.proficiency_level = data.proficiency_level;
    this.verified_skills = data.verified_skills || [];
  }
  
  validate() {
    if (this.coverage_percentage < 0 || this.coverage_percentage > 100) {
      throw new Error('Coverage percentage must be between 0 and 100');
    }
  }
}

module.exports = UserCompetency;
```

### 4.3 Request Flow

```
1. Client Request
   ↓
2. Route (routes/api/user/profile.js)
   - Validates URL pattern
   - Applies middleware (auth, rate limiting)
   ↓
3. Controller (controllers/userController.js)
   - Extracts parameters
   - Validates request
   ↓
4. Service (services/userService.js)
   - Implements business logic
   - Coordinates repositories
   - Calls AI services if needed
   ↓
5. Repository (repositories/userRepository.js)
   - Executes SQL queries
   - Maps results to models
   ↓
6. Database (PostgreSQL)
   - Executes query
   - Returns data
   ↓
7. Response flows back through layers
   - Repository → Service → Controller → Route → Client
```

### 4.4 Unified Endpoint Architecture

The unified endpoint (`POST /api/fill-content-metrics/`) uses a routing pattern:

```
Request → Unified Endpoint Controller
   ↓
Read requester_service from payload
   ↓
Route to appropriate handler:
   - directory-ms → handlers/directory/
   - assessment-ms → handlers/assessment/
   - course-builder-ms → handlers/courses/
   - content-studio-ms → handlers/content/
   - learner-ai-ms → handlers/learner/
   - analytics-ms → handlers/analytics/
   - rag-ms → handlers/rag/
   ↓
Handler processes request
   ↓
Returns response in caller's template format
```

---

## 5. Database Architecture

### 5.1 Database Schema

See `docs/step_5_database_schema_design.md` for complete schema documentation.

**Key Tables:**
- `users` - User profiles
- `competencies` - Competency definitions
- `skills` - Skill hierarchy
- `userCompetency` - User competency profiles
- `userSkill` - User skill records
- `competency_skill` - Competency-skill mappings
- `skill_subSkill` - Skill hierarchy relationships
- `competency_subCompetency` - Competency hierarchy
- `official_sources` - External source URLs

### 5.2 Connection Management

**Connection Pooling:**
- Use connection pooling for optimal performance
- Configure pool size based on expected load
- Handle connection errors gracefully

**Example Configuration:**
```javascript
// config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### 5.3 Indexing Strategy

**Hash Indexes:**
- Used for string keys (VARCHAR columns)
- Polynomial Rolling Hash function
- Parameters: `p = 31`, `M = 1,000,000,009`
- Normalization: `LOWER(TRIM(column_name))`

**B-TREE Indexes:**
- Used for ordered queries, sorting, LIKE searches
- Applied to `competency_id`, `competency_name`

**Composite Indexes:**
- Used on junction tables
- Primary keys on composite columns

---

## 6. AI Integration Architecture

### 6.1 AI Service Structure

```
services/
└── aiService.js
    ├── extractSkillsAndCompetencies()    # Feature 2.2
    ├── normalizeExtractedData()          # Feature 2.3
    ├── discoverSources()                 # Feature 9.1
    ├── extractFromWeb()                  # Feature 9.2
    ├── validateExtractedData()          # Feature 9.5
    └── discoverExternalCompetency()      # Feature 6.2
```

### 6.2 AI Service Implementation

**Service Pattern:**
```javascript
// services/aiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  
  async extractSkillsAndCompetencies(rawData) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = this.buildExtractionPrompt(rawData);
    const result = await model.generateContent(prompt);
    return this.parseExtractionResult(result);
  }
  
  async normalizeExtractedData(extractedData) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = this.buildNormalizationPrompt(extractedData);
    const result = await model.generateContent(prompt);
    return this.parseNormalizationResult(result);
  }
  
  // ... other methods
}

module.exports = new AIService();
```

### 6.3 Error Handling

**Retry Logic:**
- Implement exponential backoff for API failures
- Maximum retry attempts: 3
- Fallback to local simulation in development

**Rate Limiting:**
- Respect Gemini API rate limits
- Queue requests if rate limit exceeded
- Monitor API usage

---

## 7. Security Architecture

### 7.1 Authentication

**Method:**
- Bearer token authentication
- JWT tokens or API keys
- Token validation on every request

**Implementation:**
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 7.2 Authorization

**Role-Based Access Control:**
- `employee_type = "trainer"` - Full access including CSV import
- `employee_type = "regular"` - Read-only access to own profile
- Admin/Ops - Full system access

**Implementation:**
```javascript
// middleware/authorize.js
const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (req.user.employee_type !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
```

### 7.3 Input Validation

**Validation Middleware:**
- Validate request body structure
- Validate data types
- Sanitize inputs
- Prevent SQL injection
- Prevent prompt injection (for AI endpoints)

### 7.4 Rate Limiting

**Implementation:**
- Rate limit by IP address
- Rate limit by user ID
- Different limits for different endpoints
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

## 8. Deployment Architecture

### 8.1 Frontend Deployment (Vercel)

**Configuration:**
- Automatic deployments on git push to `main` branch
- Preview deployments for pull requests
- Environment variables managed via Vercel dashboard

**Build Process:**
```bash
npm run build
```

**Environment Variables:**
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_ENV` - Environment (production/staging)

### 8.2 Backend Deployment (Railway)

**Configuration:**
- Connect GitHub repository
- Automatic deployments on git push
- Environment variables managed via Railway dashboard

**Build Process:**
```bash
npm install
npm run build  # If using TypeScript
npm start
```

**Environment Variables:**
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `GEMINI_API_KEY` - Google Gemini API key
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (production/staging)

**Health Check:**
- Endpoint: `GET /health`
- Returns: `{ status: 'ok', timestamp: '...' }`

### 8.3 Database Deployment (Supabase)

**Migrations:**
- Create migration files in `migrations/` directory
- Run migrations via Supabase CLI or dashboard
- Version control all schema changes

**Backup:**
- Automatic daily backups (Supabase managed)
- Point-in-time recovery available

---

## 9. Development Workflow

### 9.1 Local Development Setup

**Prerequisites:**
- Node.js (v18+)
- PostgreSQL (local or Supabase connection)
- Git

**Setup Steps:**
1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Configure environment variables
5. Run migrations: `npm run migrate`
6. Start development server: `npm run dev`

### 9.2 Git Workflow

**Branching Strategy:**
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature development
- `hotfix/*` - Critical bug fixes

**Commit Convention:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

### 9.3 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run lint

  deploy-backend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railway-app/railway-action@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 9.4 Testing Strategy

**Unit Tests:**
- Test individual functions and services
- Mock external dependencies
- Target: 80%+ coverage

**Integration Tests:**
- Test API endpoints
- Test database interactions
- Use test database

**E2E Tests:**
- Test complete user workflows
- Test microservice integrations
- Use staging environment

---

## 10. Monitoring & Observability

### 10.1 Logging

**Log Levels:**
- `ERROR` - Errors requiring attention
- `WARN` - Warnings
- `INFO` - Informational messages
- `DEBUG` - Debug information

**Log Format:**
```json
{
  "timestamp": "2025-01-27T10:00:00Z",
  "level": "INFO",
  "message": "User profile retrieved",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "correlationId": "abc-123"
}
```

### 10.2 Error Tracking

**Error Handling:**
- Centralized error handler middleware
- Log all errors with stack traces
- Return user-friendly error messages
- Track error rates and patterns

### 10.3 Performance Monitoring

**Metrics to Track:**
- API response times
- Database query performance
- AI API call latency
- Request throughput
- Error rates

**Tools:**
- Railway built-in metrics
- Vercel Analytics
- Custom logging and monitoring

---

## 11. Scalability Considerations

### 11.1 Horizontal Scaling

**Backend:**
- Railway supports horizontal scaling
- Load balancing across multiple instances
- Stateless application design

**Database:**
- Supabase handles scaling automatically
- Connection pooling for optimal performance
- Read replicas for read-heavy workloads

### 11.2 Caching Strategy

**Cache Layers:**
- Application-level caching for frequently accessed data
- Redis (optional) for distributed caching
- Cache competency/skill hierarchies
- Cache user profiles (with TTL)

### 11.3 Database Optimization

**Query Optimization:**
- Use indexes effectively
- Optimize complex queries
- Use EXPLAIN ANALYZE for query analysis
- Monitor slow queries

**Connection Pooling:**
- Configure appropriate pool size
- Monitor connection usage
- Handle connection errors gracefully

---

## 12. Future Enhancements

### 12.1 Planned Features

- WebSocket support for real-time updates
- GraphQL API (optional)
- Advanced caching with Redis
- Message queue for async processing
- Event-driven architecture

### 12.2 Performance Improvements

- Implement response caching
- Optimize database queries
- Add CDN for static assets
- Implement request batching

### 12.3 Security Enhancements

- Implement OAuth 2.0
- Add API key management
- Implement request signing
- Add DDoS protection

---

**Next Steps:**
- Review architecture with team
- Set up development environment
- Configure CI/CD pipeline
- Deploy to staging environment
- Begin implementation

