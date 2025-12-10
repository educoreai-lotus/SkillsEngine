/**
 * Directory MS API Client (via Coordinator)
 * 
 * Handles communication with Directory MS indirectly by sending
 * unified-protocol style envelopes to the Coordinator.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Send initial profile to Directory MS via Coordinator
 * @param {string} userId - User ID
 * @param {Object} profile - Initial profile payload
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendInitialProfile(userId, profile) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Send initial competency profile to Directory MS',
      user_id: userId,
      ...profile
    },
    response: {
      status: 'success',
      message: '',
      data: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/directory/initial-profile'
  });
}

/**
 * Get user data from Directory MS via Coordinator
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function getUserData(userId) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Get user data from Directory MS',
      user_id: userId
    },
    response: {
      status: 'success',
      message: '',
      data: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/directory/get-user-data'
  });
}

module.exports = {
  sendInitialProfile,
  getUserData
};

