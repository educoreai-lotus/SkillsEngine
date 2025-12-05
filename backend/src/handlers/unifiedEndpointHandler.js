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

// Service to handler mapping
const HANDLER_MAP = {
  'directory-ms': directoryHandler,
  'assessment-ms': assessmentHandler,
  'course-builder-ms': courseBuilderHandler,
  'content-studio-ms': contentStudioHandler,
  'learner-ai-ms': learnerAIHandler,
  'learning-analytics-ms': analyticsHandler,
  'rag-ms': ragHandler
};

class UnifiedEndpointHandler {
  /**
   * Route request to appropriate handler
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handle(req, res) {
    try {
      // Validate request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          response: {
            status: 'error',
            message: 'Request body is required',
            data: {}
          }
        });
      }

      const { requester_service, payload, response: responseTemplate } = req.body;

      // Validate request structure
      if (!requester_service) {
        return res.status(400).json({
          response: {
            status: 'error',
            message: 'requester_service is required',
            data: {}
          }
        });
      }

      // Get handler for this service
      const handler = HANDLER_MAP[requester_service];
      if (!handler) {
        return res.status(400).json({
          response: {
            status: 'error',
            message: `Unknown requester_service: ${requester_service}`,
            data: {}
          }
        });
      }

      // Validate handler has process method
      if (typeof handler.process !== 'function') {
        console.error(
          '[UnifiedEndpointHandler] Handler missing process method',
          { requester_service, handlerType: typeof handler }
        );
        return res.status(500).json({
          response: {
            status: 'error',
            message: 'Handler configuration error',
            data: {}
          }
        });
      }

      // Route to handler
      const result = await handler.process(payload, responseTemplate);

      // Validate result structure
      if (!result || typeof result !== 'object') {
        console.error(
          '[UnifiedEndpointHandler] Handler returned invalid result',
          { requester_service, resultType: typeof result }
        );
        return res.status(500).json({
          response: {
            status: 'error',
            message: 'Handler returned invalid response',
            data: {}
          }
        });
      }

      // Return in unified format
      return res.json({
        requester_service,
        payload,
        response: result
      });
    } catch (error) {
      // Log error for debugging
      console.error('[UnifiedEndpointHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });

      // Ensure response is sent
      if (!res.headersSent) {
        return res.status(500).json({
          response: {
            status: 'error',
            message: error.message || 'Internal server error',
            data: {}
          }
        });
      }
    }
  }
}

module.exports = new UnifiedEndpointHandler();


