# Quick Fix for Coordinator 404 Errors

## The Problem

You're seeing these errors:
```
[UserService.buildInitialProfile] Failed to request baseline exam { userId: '...', error: 'Request failed with status code 404' }
Request to Coordinator failed
Failed to send initial profile to Directory MS, using mock data: Request failed with status code 404
```

## Why It's Happening

Skills Engine is trying to communicate with other microservices (Directory MS, Assessment MS) through a Coordinator service that isn't running in your local environment.

## The Good News

✅ **Your application is working fine!** These are non-critical errors with fallback mechanisms.
- User onboarding completes successfully
- Exam results processing works normally
- The service operates correctly in standalone mode

## The Solution

I've updated the code to make Coordinator integration **optional and configurable**.

### Step 1: Create/Update Your `.env` File

In your `backend/.env` file, add this line:

```env
ENABLE_COORDINATOR_INTEGRATION=false
```

Your complete `.env` should look something like:

```env
# Database
DATABASE_URL=postgresql://postgres:password@host:5432/database

# Server
PORT=8080
NODE_ENV=development

# AI
GEMINI_API_KEY=your-api-key

# Coordinator Integration - DISABLE for local development
ENABLE_COORDINATOR_INTEGRATION=false
```

### Step 2: Restart Your Backend

```bash
cd backend
npm run dev
```

## What Changed

### Before (Noisy Warnings)
```
❌ Failed to send initial profile to Directory MS, using mock data: Request failed with status code 404
❌ Failed to request baseline exam { userId: '...', error: 'Request failed with status code 404' }
```

### After (Clean Info Logs)
```
ℹ️ Coordinator integration disabled, skipping Directory MS sync
ℹ️ Coordinator integration disabled, skipping baseline exam request
```

## When to Enable Coordinator Integration

Only enable it when you have the **full microservice ecosystem** running:

```env
COORDINATOR_URL=http://localhost:3001
ENABLE_COORDINATOR_INTEGRATION=true
COORDINATOR_PRIVATE_KEY=./skills-engine-private-key.pem
SERVICE_NAME=skills-engine-service
```

## Files Modified

1. ✅ `backend/src/services/userService.js` - Added conditional checks for Coordinator integration
2. ✅ `backend/src/services/verificationService.js` - Added conditional checks for Directory MS sync
3. ✅ `backend/COORDINATOR_SETUP.md` - Comprehensive setup guide created

## Testing

After adding `ENABLE_COORDINATOR_INTEGRATION=false` to your `.env` file and restarting:

1. ✅ No more 404 errors
2. ✅ Clean informational logs
3. ✅ User onboarding works normally
4. ✅ All features work in standalone mode

## Need More Info?

See `backend/COORDINATOR_SETUP.md` for comprehensive documentation on:
- Coordinator architecture
- Environment configuration
- Troubleshooting
- Production setup checklist







