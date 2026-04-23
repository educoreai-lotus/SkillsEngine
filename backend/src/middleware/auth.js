/**
 * Authentication Middleware
 *
 * Validates end-user Bearer tokens through Coordinator -> nAuth.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();
let hasLoggedAuthContractKeys = false;

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { error: 'Authentication required. Please provide a Bearer token.' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Invalid Authorization header format. Expected Bearer token.' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { error: 'Authentication required. Please provide a Bearer token.' };
  }

  return { token };
}

async function validateAccessTokenViaCoordinator(req, accessToken) {
  const envelope = {
    requester_service: 'skills-engine-service',
    payload: {
      action: 'Validate access token via nAuth',
      access_token: accessToken,
      route: req.originalUrl,
      method: req.method
    },
    response: {}
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/request'
  });
}

function extractValidationResult(coordinatorResponse) {
  const answer = coordinatorResponse?.response?.answer;
  const payload = coordinatorResponse?.payload;

  return (
    answer ||
    coordinatorResponse?.response ||
    payload ||
    coordinatorResponse ||
    {}
  );
}

function normalizeValidationResult(rawValidation) {
  const validation = rawValidation || {};
  return {
    valid: validation.valid === true || validation.is_valid === true,
    directory_user_id:
      validation.directory_user_id ||
      validation.directoryUserId ||
      validation.user_id ||
      null,
    organization_id:
      validation.organization_id ||
      validation.organizationId ||
      validation.company_id ||
      null,
    primary_role:
      validation.primary_role ||
      validation.primaryRole ||
      validation.role ||
      null,
    is_system_admin:
      validation.is_system_admin === true || validation.isSystemAdmin === true,
    new_access_token:
      validation.new_access_token ||
      validation.newAccessToken ||
      null,
    raw: validation
  };
}

/**
 * Authenticate request using Bearer token + Coordinator token validation.
 */
const authenticate = async (req, res, next) => {
  console.log('[Auth Debug] Authorization header present', {
    hasAuthorizationHeader: Boolean(req.headers?.authorization),
    route: req.originalUrl,
    method: req.method
  });

  const { token, error } = getBearerToken(req);
  if (error) {
    return res.status(401).json({
      success: false,
      error
    });
  }

  try {
    const coordinatorResponse = await validateAccessTokenViaCoordinator(req, token);
    const rawValidation = extractValidationResult(coordinatorResponse);
    const validation = normalizeValidationResult(rawValidation);

    if (!hasLoggedAuthContractKeys) {
      hasLoggedAuthContractKeys = true;
      console.log('[Auth Contract Debug] Coordinator response keys', {
        responseKeys: Object.keys(coordinatorResponse || {}),
        validationKeys: Object.keys(rawValidation || {}),
        hasValid: Object.prototype.hasOwnProperty.call(rawValidation || {}, 'valid'),
        hasDirectoryUserId:
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'directory_user_id') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'directoryUserId') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'user_id'),
        hasOrganizationId:
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'organization_id') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'organizationId') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'company_id'),
        hasPrimaryRole:
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'primary_role') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'primaryRole') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'role'),
        hasNewAccessToken:
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'new_access_token') ||
          Object.prototype.hasOwnProperty.call(rawValidation || {}, 'newAccessToken')
      });
    }

    if (validation.valid !== true) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = {
      directory_user_id: validation.directory_user_id,
      organization_id: validation.organization_id,
      primary_role: validation.primary_role,
      is_system_admin: validation.is_system_admin,
      access_token: token,
      auth_source: 'coordinator-nauth',
      raw: validation.raw
    };

    console.log('[Auth Contract Debug] Sanitized req.user auth fields', {
      directory_user_id: req.user.directory_user_id,
      organization_id: req.user.organization_id,
      primary_role: req.user.primary_role,
      is_system_admin: req.user.is_system_admin
    });

    if (validation.new_access_token) {
      res.setHeader('X-New-Access-Token', validation.new_access_token);
    }

    return next();
  } catch (coordinatorError) {
    return res.status(401).json({
      success: false,
      error: 'Authentication validation failed'
    });
  }
};

/**
 * Optional authentication - ignores missing/invalid tokens.
 */
const optionalAuth = async (req, res, next) => {
  const { token } = getBearerToken(req);
  if (!token) {
    return next();
  }

  try {
    const coordinatorResponse = await validateAccessTokenViaCoordinator(req, token);
    const rawValidation = extractValidationResult(coordinatorResponse);
    const validation = normalizeValidationResult(rawValidation);
    if (validation.valid === true) {
      req.user = {
        directory_user_id: validation.directory_user_id,
        organization_id: validation.organization_id,
        primary_role: validation.primary_role,
        is_system_admin: validation.is_system_admin,
        access_token: token,
        auth_source: 'coordinator-nauth',
        raw: validation.raw
      };
      if (validation.new_access_token) {
        res.setHeader('X-New-Access-Token', validation.new_access_token);
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }

  return next();
};

module.exports = {
  authenticate,
  optionalAuth
};

