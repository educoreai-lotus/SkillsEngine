const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { registerService } = require('./registration/register');

// Global error handlers for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

const app = express();
// Railway (and most PaaS providers) inject a PORT env var that we must respect.
// Default to 3000 only if PORT is not set (e.g. local dev without .env).
const PORT = process.env.PORT || 3000;

// Behind Railway's reverse proxy, trust the X-Forwarded-* headers so
// express-rate-limit can identify clients correctly.
app.set('trust proxy', 1);

// CORS Configuration
const FRONTEND_URL = process.env.FRONTEND_URL;
let corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// NOTE: For now, allow all origins (including production) to avoid CORS blocking.
// If you want to lock this down later, reintroduce an allowed-origins list here.
console.log(`⚠️  CORS: Allowing all origins (FRONTEND_URL=${FRONTEND_URL || 'not set'})`);

// Middleware
app.use(cors(corsOptions));

// Body parser with size limits and error handling
// NOTE: We skip JSON parsing for the unified endpoint and handle it manually there.
const jsonParser = express.json({
  limit: '10mb', // Limit request body size
  verify: (req, res, buf, encoding) => {
    // Check if request was aborted
    if (req.aborted) {
      throw new Error('Request aborted');
    }
  }
});

app.use((req, res, next) => {
  // Leave /api/fill-content-metrics/ body unparsed (handled as raw text in its route)
  if (req.path === '/api/fill-content-metrics/' && req.method === 'POST') {
    return next();
  }
  return jsonParser(req, res, next);
});

// Handle JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      response: {
        status: 'error',
        message: 'Invalid JSON in request body',
        data: {}
      }
    });
  }
  next(err);
});

// Rate limiting
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

// Favicon placeholder to avoid 404 noise in logs/browsers
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Health check endpoint (required by Railway)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'skills-engine-backend',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Skills Engine Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      skills: '/api/skills',
      competencies: '/api/competencies',
      user: '/api/user'
    }
  });
});

// API Routes
const skillsRoutes = require('./routes/api/skills');
const competenciesRoutes = require('./routes/api/competencies');
const userRoutes = require('./routes/api/user');
const userCompetencyRoutes = require('./routes/api/user-competency');
const userSkillRoutes = require('./routes/api/user-skill');
const competencySkillRoutes = require('./routes/api/competency-skill');
const competencySubCompetencyRoutes = require('./routes/api/competency-subcompetency');
const sourceDiscoveryRoutes = require('./routes/api/source-discovery');
const competencyDiscoveryRoutes = require('./routes/api/competency-discovery');
const webExtractionRoutes = require('./routes/api/web-extraction');
const unifiedEndpointHandler = require('./handlers/unifiedEndpointHandler');
const sourceDiscoveryService = require('./services/sourceDiscoveryService');
const webExtractionService = require('./services/webExtractionService');

app.use('/api/skills', skillsRoutes);
app.use('/api/competencies', competenciesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user-competency', userCompetencyRoutes);
app.use('/api/user-skill', userSkillRoutes);
app.use('/api/competency-skill', competencySkillRoutes);
app.use('/api/competency-subcompetency', competencySubCompetencyRoutes);
app.use('/api/source-discovery', sourceDiscoveryRoutes);
app.use('/api/competency-discovery', competencyDiscoveryRoutes);
app.use('/api/web-extraction', webExtractionRoutes);

// Unified Data Exchange Protocol endpoint
// This endpoint receives the entire body as a stringified JSON and is parsed manually.
const unifiedTextBodyParser = express.text({
  type: '*/*',
  limit: '10mb'
});
app.post(
  '/api/fill-content-metrics/',
  unifiedTextBodyParser,
  unifiedEndpointHandler.handle.bind(unifiedEndpointHandler)
);

// Error handling middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

// Start server - bind explicitly to 0.0.0.0 so Railway can reach the container
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Skills Engine Backend running on port ${PORT} (process.env.PORT=${process.env.PORT || 'undefined'})`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`📚 API endpoints:`);
  console.log(`   - Skills: http://localhost:${PORT}/api/skills`);
  console.log(`   - Competencies: http://localhost:${PORT}/api/competencies`);
  console.log(`   - User: http://localhost:${PORT}/api/user`);
  console.log(`\n💡 If you see database connection errors, check:`);
  console.log(`   1. DATABASE_URL in backend/.env`);
  console.log(`   2. Supabase project is active`);
  console.log(`   3. Run: node check-connection.js`);

  // Non-blocking registration with Coordinator
  if (process.env.ENABLE_COORDINATOR_REGISTRATION === 'true') {
    registerService().catch((err) => {
      console.error('Registration error (non-blocking):', err && err.message);
    });
  }

  // Kick off source discovery + web extraction asynchronously on each system load.
  /*   (async () => {
      try {
        console.log('🔎 [startup] Running initial source discovery in background...');
        const result = await sourceDiscoveryService.discoverAndStoreSources();
        console.log('✅ [startup] Source discovery completed:', {
          inserted: result.inserted,
          skipped: result.skipped,
          totalDiscovered: result.totalDiscovered,
        });
  
        console.log('🌐 [startup] Running initial web extraction for discovered sources in background...');
        const extractionResult = await webExtractionService.extractFromOfficialSources();
        console.log('✅ [startup] Web extraction completed:', {
          competenciesInserted: extractionResult.stats?.competencies ?? 0,
          skillsInserted: extractionResult.stats?.skills ?? 0,
          sourceCount: extractionResult.sources?.length ?? 0,
        }); 
      } catch (err) {
        console.error('⚠️  [startup] Initialization pipeline failed (discovery or extraction):', err.message || err);
      }
    })(); */
});

module.exports = app;



