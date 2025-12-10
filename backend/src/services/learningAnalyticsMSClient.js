/**
 * Learning Analytics MS API Client (via Coordinator)
 *
 * Handles communication with Learning Analytics MS indirectly by sending
 * signed requests to the Coordinator, which then routes to Analytics MS.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Send user profile data to Learning Analytics MS via Coordinator
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendUserProfile(userId, profileData) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Send user profile data to Learning Analytics MS',
      user_id: userId,
      ...profileData
    },
    response: {
      status: 'success',
      message: '',
      data: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/analytics/user-profile'
  });
}

module.exports = {
  sendUserProfile
};

