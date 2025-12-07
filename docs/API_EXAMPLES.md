# API Usage Examples

Practical examples for using the Skills Engine API.

---

## Authentication

All API requests require a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.example.com/api/user/user123/profile
```

---

## User Profile

### Get User Profile

```bash
GET /api/user/{userId}/profile
```

**Example:**
```bash
curl http://localhost:8080/api/user/550e8400-e29b-41d4-a716-446655440000/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_name": "John Doe",
      "employee_type": "regular",
      "relevance_score": 75.5
    },
    "competencies": [
      {
        "competency_id": "comp_001",
        "coverage_percentage": 80.5,
        "proficiency_level": "ADVANCED"
      }
    ],
    "skills": [
      {
        "skill_id": "skill_001",
        "skill_name": "JavaScript",
        "verified": true
      }
    ]
  }
}
```

---

## Competencies

### Get All Parent Competencies

```bash
GET /api/competencies/parents
```

**Example:**
```bash
curl http://localhost:8080/api/competencies/parents
```

### Get Competency by ID

```bash
GET /api/competencies/{competencyId}
```

**Example:**
```bash
curl http://localhost:8080/api/competencies/comp_001
```

### Get Competency Hierarchy

```bash
GET /api/competencies/{competencyId}/hierarchy
```

**Example:**
```bash
curl http://localhost:8080/api/competencies/comp_001/hierarchy
```

### Import CSV (Trainer Only)

```bash
POST /api/competencies/import
Content-Type: multipart/form-data
```

**Example:**
```bash
curl -X POST \
     -H "Authorization: Bearer TRAINER_TOKEN" \
     -F "csv=@competencies.csv" \
     http://localhost:8080/api/competencies/import
```

**CSV Format:**
```csv
name,type,description,parent_id
JavaScript,skill,Programming language,
React,skill,UI library,skill_js_001
Web Development,competency,Full-stack development,
```

---

## Skills

### Get Root Skills (L1)

```bash
GET /api/skills/roots
```

**Example:**
```bash
curl http://localhost:8080/api/skills/roots
```

### Get Skill by ID

```bash
GET /api/skills/{skillId}
```

**Example:**
```bash
curl http://localhost:8080/api/skills/skill_001
```

### Get Skill Tree

```bash
GET /api/skills/{skillId}/tree
```

**Example:**
```bash
curl http://localhost:8080/api/skills/skill_001/tree
```

### Get MGS for Skill

```bash
GET /api/skills/{skillId}/mgs
```

**Example:**
```bash
curl http://localhost:8080/api/skills/skill_001/mgs
```

---

## Unified Data Exchange Protocol

### Single Endpoint for All Microservices

```bash
POST /api/fill-content-metrics/
```

**Request Format:**
```json
{
  "requester_service": "directory-ms",
  "payload": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "action": "get_profile"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {}
  }
}
```

**Example - Directory MS:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer MICROSERVICE_TOKEN" \
     -d '{
       "requester_service": "directory-ms",
       "payload": {"user_id": "550e8400-e29b-41d4-a716-446655440000"},
       "response": {"status": "success", "message": "", "data": {}}
     }' \
     http://localhost:8080/api/fill-content-metrics/
```

**Example - Assessment MS:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "requester_service": "assessment-ms",
       "payload": {
         "user_id": "550e8400-e29b-41d4-a716-446655440000",
         "exam_type": "baseline",
         "skills": [
           {"skill_id": "skill_001", "score": 85, "passed": true}
         ]
       },
       "response": {"status": "success", "message": "", "data": {}}
     }' \
     http://localhost:8080/api/fill-content-metrics/
```

---

## Error Handling

All API responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API has rate limiting enabled:
- **General API:** 100 requests per 15 minutes per IP
- **Auth endpoints:** 5 requests per 15 minutes per IP
- **Import endpoints:** 10 requests per hour per IP

---

## JavaScript/TypeScript Examples

### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get user profile
const profile = await api.get('/api/user/550e8400-e29b-41d4-a716-446655440000/profile');

// Import CSV
const formData = new FormData();
formData.append('csv', file);
const result = await api.post('/api/competencies/import', formData);
```

### Using Fetch

```javascript
// Get user profile
const response = await fetch('http://localhost:8080/api/user/550e8400-e29b-41d4-a716-446655440000/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

For complete API documentation, see `docs/step_6_api_design_contracts.md`.

