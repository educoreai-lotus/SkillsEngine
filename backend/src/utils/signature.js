const crypto = require('crypto');
const Logger = require('./logger');

// Use a shared logger instance for infra-level logs
const logger = new Logger('Signature');

/**
 * Build message for ECDSA signing
 * Format: "educoreai-{serviceName}-{payloadHash}"
 * @param {string} serviceName - Service name
 * @param {Object} payload - Payload object to sign (optional)
 * @returns {string} Message string for signing
 */
function buildMessage(serviceName, payload) {
  let message = `educoreai-${serviceName}`;

  if (payload) {
    // CRITICAL: Use JSON.stringify (not custom stable stringify) to match Coordinator
    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .digest('hex');
    message = `${message}-${payloadHash}`;
  }

  return message;
}

/**
 * Normalize a base64-encoded EC private key into a PEM string if needed.
 * If the key already looks like PEM (starts with -----BEGIN), it is returned as-is.
 * Otherwise we wrap the raw base64 with EC PRIVATE KEY headers.
 *
 * @param {string} key - Raw or PEM-formatted private key
 * @returns {string} PEM-formatted private key
 */
function normalizePrivateKeyToPem(key) {
  if (!key) return null;

  const trimmed = key.trim();

  // Already PEM
  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed;
  }

  // Assume base64 and wrap as EC PRIVATE KEY
  const wrapped = trimmed.replace(/\s+/g, '');

  const pem =
    '-----BEGIN EC PRIVATE KEY-----\n' +
    wrapped +
    '\n-----END EC PRIVATE KEY-----';

  logger.info('Normalized EC private key to PEM format');
  return pem;
}

/**
 * Normalize a base64-encoded EC public key into a PEM string if needed.
 * If the key already looks like PEM (starts with -----BEGIN), it is returned as-is.
 *
 * @param {string} key - Raw or PEM-formatted public key
 * @returns {string} PEM-formatted public key
 */
function normalizePublicKeyToPem(key) {
  if (!key) return null;

  const trimmed = key.trim();

  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed;
  }

  const wrapped = trimmed.replace(/\s+/g, '');

  const pem =
    '-----BEGIN PUBLIC KEY-----\n' +
    wrapped +
    '\n-----END PUBLIC KEY-----';

  logger.info('Normalized EC public key to PEM format');
  return pem;
}

/**
 * Generate ECDSA P-256 signature
 * @param {string} serviceName - Service name
 * @param {string} privateKeyInput - Private key (raw base64 or PEM)
 * @param {Object} payload - Payload object to sign
 * @returns {string} Base64-encoded signature
 */
function generateSignature(serviceName, privateKeyInput, payload) {
  if (!privateKeyInput || typeof privateKeyInput !== 'string') {
    throw new Error('Private key is required and must be a string');
  }

  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('Service name is required and must be a string');
  }

  try {
    // Normalize key to PEM so Node's crypto can parse it
    const privateKeyPem = normalizePrivateKeyToPem(privateKeyInput);

    // Build message for signing
    const message = buildMessage(serviceName, payload);

    // Create private key object from PEM string
    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem,
      format: 'pem'
    });

    // Sign the message using ECDSA P-256
    const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363' // Coordinator expects IEEE P1363 encoding
    });

    // Return Base64-encoded signature
    return signature.toString('base64');
  } catch (error) {
    logger.error('Signature generation failed', error);
    throw new Error(`Signature generation failed: ${error.message}`);
  }
}

/**
 * Verify ECDSA P-256 signature (optional)
 * @param {string} serviceName - Service name
 * @param {string} publicKeyInput - Public key (raw base64 or PEM)
 * @param {Object} payload - Payload object that was signed
 * @param {string} signature - Base64-encoded signature to verify
 * @returns {boolean} True if signature is valid
 */
function verifySignature(serviceName, publicKeyInput, payload, signature) {
  if (!publicKeyInput || !signature) {
    return false;
  }

  try {
    const publicKeyPem = normalizePublicKeyToPem(publicKeyInput);
    const message = buildMessage(serviceName, payload);
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem'
    });

    const signatureBuffer = Buffer.from(signature, 'base64');
    return crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      {
        key: publicKey,
        dsaEncoding: 'ieee-p1363'
      },
      signatureBuffer
    );
  } catch (error) {
    logger.warn('Signature verification failed', { error: error.message });
    return false;
  }
}

module.exports = {
  buildMessage,
  generateSignature,
  verifySignature,
  normalizePrivateKeyToPem,
  normalizePublicKeyToPem
};


