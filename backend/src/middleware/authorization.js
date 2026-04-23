/**
 * Authorization Middleware
 * 
 * Checks user permissions based on employee_type.
 */
const userRepository = require('../repositories/userRepository');

/**
 * Require trainer role
 */
const requireTrainer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.employee_type !== 'trainer') {
    return res.status(403).json({
      success: false,
      error: 'Trainer access required'
    });
  }

  next();
};

/**
 * Require HR access for Skills Engine protected flows.
 * Runs after authenticate middleware and relies on req.user.
 */
const authorizeHR = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const primaryRole = (req.user.primary_role || '').toString().trim();
  const configuredRoles = (process.env.NAUTH_HR_ALLOWED_PRIMARY_ROLES || '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);

  if (configuredRoles.length === 0) {
    return res.status(403).json({
      success: false,
      error: 'HR authorization is not configured'
    });
  }

  console.log('[Authorization Debug] Role evaluation', {
    primary_role: primaryRole,
    configured_allowed_primary_roles: configuredRoles
  });

  if (configuredRoles.includes(primaryRole)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'HR access required'
  });
};

function extractTargetUserId(req, lookupOrder = []) {
  for (const source of lookupOrder) {
    if (source === 'params.userId' && req.params?.userId) {
      return req.params.userId;
    }
    if (source === 'body.user_id' && req.body?.user_id) {
      return req.body.user_id;
    }
  }
  return null;
}

const authorizeCompanyScope = (lookupOrder = ['params.userId', 'body.user_id']) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const targetUserId = extractTargetUserId(req, lookupOrder);
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Target user ID is required for company-scope authorization'
      });
    }

    const requesterOrganizationId = req.user.organization_id;
    if (!requesterOrganizationId) {
      return res.status(403).json({
        success: false,
        error: 'Token organization scope is missing'
      });
    }

    try {
      const targetUser = await userRepository.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'Target user not found'
        });
      }

      const targetCompanyId = targetUser.company_id;
      const isSameOrganization = Boolean(targetCompanyId) && targetCompanyId === requesterOrganizationId;
      console.log('[Authorization Debug] Organization scope evaluation', {
        requester_organization_id: requesterOrganizationId,
        target_user_id: targetUserId,
        target_company_id: targetCompanyId || null,
        is_same_organization: isSameOrganization
      });

      if (!targetCompanyId || targetCompanyId !== requesterOrganizationId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: target user is outside your organization scope'
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to evaluate organization scope'
      });
    }
  };
};

/**
 * Require regular employee role
 */
const requireRegular = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.employee_type !== 'regular') {
    return res.status(403).json({
      success: false,
      error: 'Regular employee access required'
    });
  }

  next();
};

/**
 * Check if user owns the resource
 */
const requireOwnership = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const resourceUserId = req.params[userIdParam];

    // Trainers can access any resource
    if (req.user.employee_type === 'trainer') {
      return next();
    }

    // Regular users can only access their own resources
    if (req.user.user_id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

module.exports = {
  authorizeHR,
  authorizeCompanyScope,
  requireTrainer,
  requireRegular,
  requireOwnership
};

