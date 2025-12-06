const axios = require('axios');
const Logger = require('../utils/logger');
const { generateSignature } = require('../utils/signature');

// Service configuration (driven by environment variables)
const SERVICE_NAME = process.env.SERVICE_NAME || 'skills-engine-service';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const SERVICE_DESCRIPTION =
  process.env.SERVICE_DESCRIPTION || 'Skills Engine Backend API service';

const METADATA = {
  team: process.env.SERVICE_TEAM || 'Skills Engine Team',
  owner: process.env.SERVICE_OWNER || 'system',
  capabilities: process.env.SERVICE_CAPABILITIES
    ? process.env.SERVICE_CAPABILITIES.split(',').map((c) => c.trim())
    : ['skills-engine']
};

const logger = new Logger('CoordinatorRegistration');

/**
 * Exponential backoff delay calculator
 */
function getBackoffDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 16000);
}

/**
 * Register service with Coordinator
 * @returns {Promise<{success: boolean, serviceId?: string, status?: string, error?: string}>}
 */
async function registerWithCoordinator() {
  const coordinatorUrl = process.env.COORDINATOR_URL;

  // In your Railway vars you used SKILLS_ENGINE_DOMIN for the public URL
  // Treat this as our SERVICE_ENDPOINT if SERVICE_ENDPOINT is not explicitly set.
  const serviceEndpoint =
    process.env.SERVICE_ENDPOINT || process.env.SKILLS_ENGINE_DOMIN;

  // This is our service's private key used to sign requests to Coordinator
  const privateKey =
    process.env.COORDINATOR_PRIVATE_KEY || process.env.SKILLS_ENGINE_PRIVATE_KEY;

  // Validate required environment variables
  if (!coordinatorUrl) {
    const error = 'COORDINATOR_URL environment variable is required';
    logger.error(`Registration failed: ${error}`);
    return { success: false, error };
  }

  if (!serviceEndpoint) {
    const error =
      'SERVICE_ENDPOINT (or SKILLS_ENGINE_DOMIN) environment variable is required';
    logger.error(`Registration failed: ${error}`);
    return { success: false, error };
  }

  if (!privateKey) {
    const error =
      'COORDINATOR_PRIVATE_KEY (or SKILLS_ENGINE_PRIVATE_KEY) is required for ECDSA signing';
    logger.error(`Registration failed: ${error}`);
    return { success: false, error };
  }

  // Clean URLs (remove trailing slashes)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  const cleanServiceEndpoint = serviceEndpoint.replace(/\/$/, '');

  const registrationUrl = `${cleanCoordinatorUrl}/register`;

  // Build registration payload (using full format)
  const registrationPayload = {
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    endpoint: cleanServiceEndpoint,
    healthCheck: '/health',
    description: SERVICE_DESCRIPTION,
    metadata: METADATA
  };

  // Generate ECDSA signature for authentication
  let signature;
  try {
    signature = generateSignature(SERVICE_NAME, privateKey, registrationPayload);
  } catch (signatureError) {
    const error = `Failed to generate ECDSA signature: ${signatureError.message}`;
    logger.error(`Registration failed: ${error}`, signatureError);
    return { success: false, error };
  }

  // Retry logic with exponential backoff (up to 5 attempts)
  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Service-Name': SERVICE_NAME,
        'X-Signature': signature
      };

      const response = await axios.post(registrationUrl, registrationPayload, {
        headers: requestHeaders,
        timeout: 10000 // 10 seconds timeout
      });

      // Check if registration was successful
      if (response.status >= 200 && response.status < 300) {
        const serviceId =
          (response.data && (response.data.serviceId || response.data.id)) ||
          'unknown';
        const status = (response.data && response.data.status) ||
          'pending_migration';

        logger.info('Registered with Coordinator', {
          serviceId,
          status,
          attempt: attempt + 1
        });

        return {
          success: true,
          serviceId,
          status
        };
      }

      throw new Error(`Unexpected status code: ${response.status}`);
    } catch (error) {
      lastError = error;

      // Determine error type and create friendly message
      let errorMessage = 'Unknown error';
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
          errorMessage =
            'Unauthorized: Authentication failed. Please verify private key and service name.';
        } else if (status === 404) {
          errorMessage = 'Not found: Registration endpoint not available.';
        } else {
          errorMessage = `HTTP ${status}: ${
            (data && data.message) || error.response.statusText
          }`;
        }
      } else if (error.request) {
        errorMessage = 'No response from Coordinator service';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }

      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        logger.error(
          `Registration failed after ${maxAttempts} attempts: ${errorMessage}`,
          error
        );
      } else {
        const delay = getBackoffDelay(attempt);
        logger.warn(
          `Registration attempt ${attempt + 1}/${maxAttempts} failed: ${errorMessage}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  return {
    success: false,
    error: (lastError && lastError.message) ||
      'Registration failed after all retry attempts'
  };
}

/**
 * Register service on startup
 * This function is non-blocking and will not crash the service if registration fails
 */
async function registerService() {
  try {
    const result = await registerWithCoordinator();

    if (!result.success) {
      logger.warn('Service registration failed, but continuing startup...', {
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Unexpected error during service registration', error);
    // Do not throw - allow service to continue
  }
}

module.exports = {
  registerService,
  registerWithCoordinator
};


