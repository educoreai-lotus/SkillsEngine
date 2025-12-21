const axios = require('axios');
const Logger = require('../../utils/logger');
const {
  generateSignature,
  verifySignature
} = require('../../utils/signature');

const SERVICE_NAME = process.env.SERVICE_NAME || 'skills-engine-service';
const logger = new Logger('CoordinatorClient');

/**
 * Post request to Coordinator with ECDSA signature
 * All internal microservice calls should use this helper
 * @param {Object} envelope - Request envelope
 * @param {Object} options - Optional configuration
 * @param {string} options.endpoint - Custom endpoint (default: /api/fill-content-metrics/)
   * @param {number} options.timeout - Request timeout in ms (default: 300000 = 5 minutes)
 * @returns {Promise<Object>} Response data from Coordinator
 * @throws {Error} If request fails
 */
async function postToCoordinator(envelope, options = {}) {
  const coordinatorUrl = process.env.COORDINATOR_URL;

  // Our service private key for signing requests
  const privateKey =
    process.env.COORDINATOR_PRIVATE_KEY || process.env.SKILLS_ENGINE_PRIVATE_KEY;

  // Coordinator's public key for optional response verification
  const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY || null;

  // Validate required environment variables
  if (!coordinatorUrl) {
    throw new Error('COORDINATOR_URL environment variable is required');
  }

  if (!privateKey) {
    throw new Error(
      'COORDINATOR_PRIVATE_KEY (or SKILLS_ENGINE_PRIVATE_KEY) environment variable is required for signing requests'
    );
  }

  // Clean URL (remove trailing slash)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');

  // Default endpoint is /api/fill-content-metrics/ (Coordinator proxy endpoint)
  let endpoint = options.endpoint || '/api/fill-content-metrics/';

  // Normalize endpoint to always end with exactly one slash
  endpoint = endpoint.replace(/\/+$/, '') + '/';

  const url = `${cleanCoordinatorUrl}${endpoint}`;
  // Default timeout: 5 minutes (300 seconds) - configurable via env var or options
  const timeout = options.timeout || parseInt(process.env.COORDINATOR_TIMEOUT || '300000', 10);

  let signature = null;
  try {
    // Generate ECDSA signature for the entire envelope
    signature = generateSignature(SERVICE_NAME, privateKey, envelope);

    // Send POST request with signature headers
    const response = await axios.post(url, envelope, {
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': SERVICE_NAME,
        'X-Signature': signature
      },
      timeout
    });

    // Optional: Verify response signature if Coordinator provides one
    if (coordinatorPublicKey && response.headers['x-service-signature']) {
      const responseSignature = response.headers['x-service-signature'];
      try {
        const isValid = verifySignature(
          'coordinator',
          coordinatorPublicKey,
          response.data,
          responseSignature
        );
        if (!isValid) {
          logger.warn('Response signature verification failed');
        }
      } catch (verifyError) {
        logger.warn(
          'Response signature verification error (non-blocking)',
          verifyError
        );
      }
    }

    return response.data;
  } catch (error) {
    const errorDetails = {
      error: error.message,
      url,
      serviceName: SERVICE_NAME,
      hasSignature: !!signature
    };

    if (error.response) {
      // HTTP error response from Coordinator
      errorDetails.status = error.response.status;
      errorDetails.statusText = error.response.statusText;
      errorDetails.responseData = error.response.data;
      errorDetails.responseHeaders = error.response.headers;
    } else if (error.request) {
      // Request was made but no response received
      errorDetails.requestError = 'No response received from Coordinator';
      errorDetails.requestData = error.request;
    } else {
      // Error setting up the request
      errorDetails.setupError = 'Error setting up request';
    }

    if (error.code) {
      errorDetails.code = error.code;
    }

    // Add timeout-specific details
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorDetails.timeout = true;
      errorDetails.timeoutMs = timeout;
      errorDetails.message = `Request timed out after ${timeout}ms`;
      errorDetails.possibleCauses = [
        'Coordinator is slow to respond',
        'Coordinator is trying to reach target service but it is slow/unavailable',
        'Network latency issues',
        'Target service (Learner AI MS) is overloaded or not responding'
      ];
    }

    logger.error('Request to Coordinator failed', errorDetails);

    // Re-throw the error so callers can handle it
    throw error;
  }
}

/**
 * Get Coordinator client instance
 * @returns {Object} Coordinator client methods
 */
function getCoordinatorClient() {
  return {
    post: postToCoordinator
  };
}

module.exports = {
  postToCoordinator,
  getCoordinatorClient
};


