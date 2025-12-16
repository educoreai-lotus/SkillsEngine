/**
 * Unified Data Exchange Protocol Handler
 * 
 * Single endpoint for all microservice communications.
 * POST /api/fill-content-metrics/
 */

const directoryHandler = require('./directory/index');
const assessmentHandler = require('./assessment/index');
const courseBuilderHandler = require('./courses/index');
const contentStudioHandler = require('./content/index');
const learnerAIHandler = require('./learner/index');
const analyticsHandler = require('./analytics/index');
const ragHandler = require('./rag/index');
const careerPathHandler = require('./career-path/index');
const aiQueryBuilderService = require('../services/aiQueryBuilderService');

// Service to handler mapping
const HANDLER_MAP = {
  // Core service keys used by the backend internally
  'directory-service': directoryHandler,
  'assessment-service': assessmentHandler,
  'course-builder': courseBuilderHandler,
  'content-studio': contentStudioHandler,
  'learnerAI': learnerAIHandler,
  'LearningAnalytics': analyticsHandler,
  'rag': ragHandler,
  'career-path': careerPathHandler,

  // Backwards-compatible aliases that match external MS names
  /* 'directory-ms': directoryHandler,
  'assessment-ms': assessmentHandler,
  'course-builder-ms': courseBuilderHandler,
  'content-studio-ms': contentStudioHandler,
  'learner-ai-ms': learnerAIHandler,
  'analytics-ms': analyticsHandler,
  'rag-ms': ragHandler */
};

class UnifiedEndpointHandler {
  /**
   * Route request to appropriate handler.
   *
   * This endpoint expects the raw HTTP body to be a JSON-stringified object:
   * {
   *   "requester_service": "string",
   *   "payload": { ... },
   *   "response": {}
   * }
   *
   * The handler fills the response field and we always return the full object
   * as a stringified JSON in the HTTP response.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handle(req, res) {
    try {
      // Step 1: Read raw body (stringified JSON)
      let rawBody = req.body;
      if (typeof rawBody !== 'string') {
        rawBody = rawBody ? String(rawBody) : '';
      }

      // Step 2: Parse using JSON.parse
      let envelope;
      try {
        envelope = JSON.parse(rawBody);
      } catch (parseError) {
        const errorEnvelope = {
          requester_service: null,
          payload: null,
          response: {
            message: `Failed to parse JSON body: ${parseError.message}`
          }
        };
        return res
          .status(400)
          .type('application/json')
          .send(JSON.stringify(errorEnvelope));
      }

      if (!envelope || typeof envelope !== 'object') {
        const errorEnvelope = {
          requester_service: null,
          payload: null,
          response: {
            message: 'Request body must be a JSON object'
          }
        };
        return res
          .status(400)
          .type('application/json')
          .send(JSON.stringify(errorEnvelope));
      }

      const { requester_service, payload, response } = envelope;
      const responseTemplate = response || {};

      // Ensure response object exists and preserve structure
      envelope.response = envelope.response || {};

      // Log full incoming unified request for debugging/traceability
      try {
        console.log(
          '[UnifiedEndpointHandler] Incoming unified request',
          JSON.stringify(
            {
              requester_service,
              payload,
              response: envelope.response
            },
            null,
            2
          )
        );
      } catch (logErr) {
        console.warn('[UnifiedEndpointHandler] Failed to log incoming request', {
          error: logErr.message
        });
      }

      if (!requester_service) {
        envelope.response = { message: 'requester_service is required' };
        return res
          .status(400)
          .type('application/json')
          .send(JSON.stringify(envelope));
      }

      // Step 3: Route based on requester_service
      const handler = HANDLER_MAP[requester_service];
      if (!handler) {
        envelope.response = { message: `Unknown requester_service: ${requester_service}` };
        return res
          .status(400)
          .type('application/json')
          .send(JSON.stringify(envelope));
      }

      if (typeof handler.process !== 'function') {
        console.error(
          '[UnifiedEndpointHandler] Handler missing process method',
          { requester_service, handlerType: typeof handler }
        );
        envelope.response = { message: 'Handler configuration error' };
        return res
          .status(500)
          .type('application/json')
          .send(JSON.stringify(envelope));
      }

      // Step 4: Call handler
      const result = await handler.process(payload, responseTemplate, {
        aiQueryBuilder: aiQueryBuilderService
      });

      // Step 5: Store result directly in response
      // Result should be a JSON object, not a double-stringified blob.
      if (typeof result === 'string') {
        // Wrap plain strings into a standard object shape.
        envelope.response = { message: result };
      } else {
        envelope.response = result || {};
      }

      // Step 6: Return full object as stringified JSON
      return res
        .status(200)
        .type('application/json')
        .send(JSON.stringify(envelope));
    } catch (error) {
      // Log error for debugging
      console.error('[UnifiedEndpointHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      if (!res.headersSent) {
        const errorEnvelope = {
          requester_service: null,
          payload: null,
          response: {
            message: error.message || 'Internal server error'
          }
        };
        return res
          .status(500)
          .type('application/json')
          .send(JSON.stringify(errorEnvelope));
      }
    }
  }
}

module.exports = new UnifiedEndpointHandler();


