# Coordinator Integration Setup Guide

## Overview

Skills Engine communicates with other microservices (Directory MS, Assessment MS, Learner AI MS) through a **Coordinator** service that acts as a message broker and router.

## Development vs Production

### Development Mode (Local)
In local development, you typically don't have the full microservice ecosystem running. The Coordinator integration is **optional** and Skills Engine will work without it using fallback mechanisms.

### Production Mode
In production, the Coordinator enables communication between all microservices for features like:
- Sending user profiles to Directory MS
- Requesting baseline exams from Assessment MS
- Sending gap analysis to Learner AI MS

---

## Configuration

### Environment Variables

Add these to your `backend/.env` file:

```env
# Coordinator Integration (Optional for local dev)
COORDINATOR_URL=http://localhost:3001
ENABLE_COORDINATOR_INTEGRATION=false

# Coordinator Authentication (Required if integration is enabled)
COORDINATOR_PRIVATE_KEY=./skills-engine-private-key.pem
COORDINATOR_PUBLIC_KEY=./coordinator-public-key.pem
SKILLS_ENGINE_PRIVATE_KEY=./skills-engine-private-key.pem
SERVICE_NAME=skills-engine-service
```

### Configuration Options

#### Option 1: Disable Coordinator Integration (Recommended for Local Dev)
```env
# Don't set COORDINATOR_URL or set ENABLE_COORDINATOR_INTEGRATION=false
ENABLE_COORDINATOR_INTEGRATION=false
```

**Behavior:**
- ✅ User onboarding works normally
- ✅ Exam results processing works normally
- ℹ️ Profiles are NOT sent to Directory MS (logged as info)
- ℹ️ Baseline exam requests are NOT sent to Assessment MS (logged as info)
- ℹ️ Gap analysis is NOT sent to Learner AI MS (logged as info)

#### Option 2: Enable Coordinator Integration (Production)
```env
COORDINATOR_URL=https://coordinator.educora.ai
ENABLE_COORDINATOR_INTEGRATION=true
COORDINATOR_PRIVATE_KEY=./skills-engine-private-key.pem
COORDINATOR_PUBLIC_KEY=./coordinator-public-key.pem
SERVICE_NAME=skills-engine-service
```

**Behavior:**
- ✅ User onboarding works and sends profile to Directory MS
- ✅ Baseline exam requests sent to Assessment MS
- ✅ Gap analysis sent to Learner AI MS
- ⚠️ If Coordinator is unavailable, operations fall back gracefully

---

## Endpoints

When Coordinator integration is enabled, Skills Engine sends requests to:

### Directory MS
- **Initial Profile:** `POST /api/events/directory/initial-profile`
  - Sent after user onboarding
  - Contains user competencies hierarchy
  
- **Updated Profile:** `POST /api/events/directory/updated-profile`
  - Sent after exam results are processed
  - Contains updated competencies with new coverage/proficiency

### Assessment MS
- **Baseline Exam Request:** `POST /api/events/assessment/baseline-exam`
  - Automatically triggered after user onboarding
  - Contains user competencies with MGS (Most Granular Skills)

### Learner AI MS
- **Gap Analysis:** `POST /api/events/learner-ai/gap-analysis`
  - Sent after exam results and gap analysis
  - Contains learning gaps and recommended actions

---

## Troubleshooting

### Error: "Request failed with status code 404"

**Cause:** Coordinator URL is set but the endpoint doesn't exist or Coordinator isn't running.

**Solution:**
1. **For local development:** Disable Coordinator integration
   ```env
   ENABLE_COORDINATOR_INTEGRATION=false
   ```

2. **For production:** Verify:
   - Coordinator service is running
   - COORDINATOR_URL is correct
   - Coordinator has the required endpoints registered
   - Skills Engine is registered with Coordinator

### Error: "COORDINATOR_URL environment variable is required"

**Cause:** Code is trying to use Coordinator but URL isn't configured.

**Solution:** Either set the URL or disable integration:
```env
# Option 1: Set URL
COORDINATOR_URL=http://localhost:3001

# Option 2: Disable integration
ENABLE_COORDINATOR_INTEGRATION=false
```

### Error: "COORDINATOR_PRIVATE_KEY environment variable is required"

**Cause:** Coordinator integration is enabled but authentication keys are missing.

**Solution:** Generate ECDSA key pair:
```bash
# Generate private key
openssl ecparam -genkey -name secp256k1 -out skills-engine-private-key.pem

# Extract public key
openssl ec -in skills-engine-private-key.pem -pubout -out skills-engine-public-key.pem
```

---

## Logging

### When Integration is Disabled
```
[UserService.buildInitialProfile] Coordinator integration disabled, skipping Directory MS sync
[UserService.buildInitialProfile] Coordinator integration disabled, skipping baseline exam request
[VerificationService.processBaselineExamResults] Coordinator integration disabled, skipping Directory MS sync
```

### When Integration is Enabled (Success)
```
[UserService.buildInitialProfile] Successfully sent initial profile to Directory MS
[UserService.buildInitialProfile] Successfully requested baseline exam from Assessment MS
[VerificationService.processBaselineExamResults] Successfully sent updated profile to Directory MS
```

### When Integration is Enabled (Failure)
```
[UserService.buildInitialProfile] Failed to send initial profile to Directory MS: Request failed with status code 404
[UserService.buildInitialProfile] Failed to request baseline exam { userId: '...', error: 'Request failed with status code 404' }
```

---

## Testing

### Test Coordinator Connection
```bash
curl -X POST http://localhost:3001/health \
  -H "Content-Type: application/json"
```

### Test Skills Engine with Coordinator Disabled
```bash
# Set in backend/.env
ENABLE_COORDINATOR_INTEGRATION=false

# Start backend
cd backend && npm run dev

# Test user onboarding - should work without errors
curl -X POST http://localhost:8080/api/user/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "test_user",
    "company_id": "company_123",
    "raw_data": {
      "resume": "Software Engineer with 5 years of experience..."
    }
  }'
```

---

## Production Checklist

Before enabling Coordinator integration in production:

- [ ] Coordinator service is deployed and running
- [ ] COORDINATOR_URL environment variable is set
- [ ] ECDSA key pair is generated and configured
- [ ] Skills Engine is registered with Coordinator
- [ ] Directory MS is registered with Coordinator
- [ ] Assessment MS is registered with Coordinator
- [ ] Learner AI MS is registered with Coordinator
- [ ] All services can communicate through Coordinator
- [ ] Monitoring/logging is set up to track integration status

---

## Related Documentation

- **Unified Data Exchange Protocol:** `docs/step_6_api_design_contracts.md`
- **Microservice Integration:** `docs/step_3_feature_specifications.md` (Section 8)
- **Directory MS Profile Structure:** `docs/directory_ms_profile_structure.md`







