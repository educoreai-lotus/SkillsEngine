# Baseline Exam Skills Request Examples

## Overview

This document provides example request bodies for fetching baseline exam skills from the Skills Engine.

## Endpoint

**POST** `/api/fill-content-metrics/`

## Request Format

All requests must follow the Unified Data Exchange Protocol format:

```json
{
  "requester_service": "assessment-service",
  "payload": {
    "action": "fetch-baseline-skills",
    "competency_name": "string"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {}
  }
}
```

## Example Request Bodies

### Example 1: Fetch Skills for "React"

```json
{
  "requester_service": "assessment-service",
  "payload": {
    "action": "fetch-baseline-skills",
    "competency_name": "react"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {}
  }
}
```

### Example 2: Fetch Skills for "Node.js"

```json
{
  "requester_service": "assessment-service",
  "payload": {
    "action": "fetch-baseline-skills",
    "competency_name": "node.js"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {}
  }
}
```

### Example 3: Fetch Skills for "Fullstack Development"

```json
{
  "requester_service": "assessment-service",
  "payload": {
    "action": "fetch-baseline-skills",
    "competency_name": "fullstack development"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {}
  }
}
```

### Example 4: Using Alias (e.g., "reactjs" → finds "react")

```json
{
  "requester_service": "assessment-service",
  "payload": {
    "action": "fetch-baseline-skills",
    "competency_name": "reactjs"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {}
  }
}
```

## cURL Examples

### Fetch React Skills

```bash
curl -X POST http://localhost:8080/api/fill-content-metrics/ \
  -H "Content-Type: application/json" \
  -d '{
    "requester_service": "assessment-service",
    "payload": {
      "action": "fetch-baseline-skills",
      "competency_name": "react"
    },
    "response": {
      "status": "success",
      "message": "",
      "data": {}
    }
  }'
```

### Fetch Node.js Skills

```bash
curl -X POST http://localhost:8080/api/fill-content-metrics/ \
  -H "Content-Type: application/json" \
  -d '{
    "requester_service": "assessment-service",
    "payload": {
      "action": "fetch-baseline-skills",
      "competency_name": "node.js"
    },
    "response": {
      "status": "success",
      "message": "",
      "data": {}
    }
  }'
```

## Expected Response Format

```json
{
  "requester_service": "assessment-service",
  "payload": {
    "action": "fetch-baseline-skills",
    "competency_name": "react"
  },
  "response": {
    "status": "success",
    "message": "",
    "data": {
      "competency_name": "react",
      "skills": [
        {
          "skill_id": "skill-uuid-1",
          "skill_name": "React Components"
        },
        {
          "skill_id": "skill-uuid-2",
          "skill_name": "React Hooks"
        },
        {
          "skill_id": "skill-uuid-3",
          "skill_name": "JSX Syntax"
        }
      ]
    }
  }
}
```

## Field Descriptions

### Request Fields

- **requester_service** (string, required): Must be `"assessment-service"` or `"assessment-ms"`
- **payload.action** (string, required): Must be `"fetch-baseline-skills"`
- **payload.competency_name** (string, required): The name of the competency/topic to fetch skills for
- **response** (object, required): Response template (can be empty, will be filled by handler)

### Response Fields

- **competency_name** (string): The competency name that was requested
- **skills** (array): Array of MGS (Most Granular Skills) objects
  - **skill_id** (string): UUID of the skill
  - **skill_name** (string): Name of the skill

## Notes

1. **Alias Support**: The system supports aliases. For example, if "reactjs" is an alias for "react", searching for "reactjs" will return skills for "react".

2. **Case Insensitive**: Competency names are normalized to lowercase, so "React", "react", and "REACT" are treated the same.

3. **Auto-Creation**: If a competency doesn't exist, it will be automatically created as a core-competency (if needed).

4. **MGS Only**: The response contains only MGS (leaf skills), not intermediate skill levels.

5. **Logging**: The system logs:
   - When the fetch starts
   - Which competency was found (with ID)
   - The complete final list of skills retrieved

