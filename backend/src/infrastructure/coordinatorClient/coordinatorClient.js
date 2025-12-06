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
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
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
  const timeout = options.timeout || 30000;

  try {
    // Generate ECDSA signature for the entire envelope
    const signature = generateSignature(SERVICE_NAME, privateKey, envelope);

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
    logger.error('Request to Coordinator failed', {
      error: error.message,
      status: error.response && error.response.status,
      responseData: error.response && error.response.data
    });

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


