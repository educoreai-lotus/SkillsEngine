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
  'directory': directoryHandler,
  'assessment': assessmentHandler,
  'course-builder': courseBuilderHandler,
  'content-studio': contentStudioHandler,
  'learner-ai': learnerAIHandler,
  'learning-analytics': analyticsHandler,
  'rag': ragHandler
};

class UnifiedEndpointHandler {
  /**
   * Route request to appropriate handler
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handle(req, res) {
    // Check if request was aborted
    if (req.aborted) {
      console.warn('[UnifiedEndpointHandler] Request aborted before processing');
      return;
    }

    // Set up request timeout (30 seconds)
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          response: {
            status: 'error',
            message: 'Request timeout',
            data: {}
          }
        });
      }
    }, 30000);

    try {
      // Check if request was aborted during body parsing
      if (req.aborted) {
        clearTimeout(timeout);
        return;
      }

      // Validate request body exists
      if (!req.body || typeof req.body !== 'object') {
        clearTimeout(timeout);
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
        clearTimeout(timeout);
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
        clearTimeout(timeout);
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
        clearTimeout(timeout);
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
        clearTimeout(timeout);
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

      // Clear timeout on success
      clearTimeout(timeout);

      // Check if request was aborted before sending response
      if (req.aborted) {
        console.warn('[UnifiedEndpointHandler] Request aborted before sending response');
        return;
      }

      // Return in unified format
      return res.json({
        requester_service,
        payload,
        response: result
      });
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeout);

      // Handle aborted requests gracefully
      if (error.message === 'request aborted' || error.message?.includes('aborted') || req.aborted) {
        console.warn('[UnifiedEndpointHandler] Request aborted during processing');
        return; // Don't send response if request was aborted
      }

      // Log error for debugging
      console.error('[UnifiedEndpointHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      // Ensure response is sent (only if not aborted)
      if (!res.headersSent && !req.aborted) {
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


