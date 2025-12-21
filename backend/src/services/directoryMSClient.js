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
    requester_service: 'skills-engine-service',
    payload: {
      action: 'Send initial competency profile to Directory MS',
      user_id: userId,
      ...profile
    },
    response: {}
  };

  // Log request body before sending
  console.log(
    '[DirectoryMSClient.sendInitialProfile] Sending POST request to Directory MS',
    JSON.stringify(envelope, null, 2)
  );

  // Use default unified endpoint /api/fill-content-metrics/
  return coordinatorClient.post(envelope);
}

/**
 * Send updated profile to Directory MS via Coordinator
 * (Called after exam results processing to sync updated competencies)
 * @param {string} userId - User ID
 * @param {Object} profile - Updated profile payload with user competencies
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendUpdatedProfile(userId, profile) {
  const envelope = {
    requester_service: 'skills-engine-service',
    payload: {
      action: 'Update user profile',
      description: 'This request to Directory servier is to update the employee profile',
      user_id: userId,
      ...profile
    },
    response: {}
  };

  // Log request body before sending
  console.log(
    '[DirectoryMSClient.sendUpdatedProfile] Sending POST request to Directory MS',
    JSON.stringify(envelope, null, 2)
  );

  // Use default unified endpoint /api/fill-content-metrics/
  const response = await coordinatorClient.post(envelope);

  // Log response after sending
  console.log(
    '[DirectoryMSClient.sendUpdatedProfile] Successfully received response from Directory MS',
    {
      userId,
      responseStatus: response?.status || 'unknown',
      responseData: response ? JSON.stringify(response, null, 2) : 'no response'
    }
  );

  return response;
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
    response: {}
  };

  // Log request body before sending
  console.log(
    '[DirectoryMSClient.getUserData] Sending POST request to Directory MS',
    JSON.stringify(envelope, null, 2)
  );

  // Use default unified endpoint /api/fill-content-metrics/
  return coordinatorClient.post(envelope);
}

/**
 * Send career path competencies to Directory MS via Coordinator
 * (Called after career path submission to sync chosen competencies)
 * @param {string} userId - User ID
 * @param {Array} careerPaths - Array of career path objects from user_career_path table
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendCareerPathCompetencies(userId, careerPaths) {
  // Format career paths for Directory MS (only competency_id and competency_name)
  const competencies = careerPaths.map(cp => ({
    competency_id: cp.competency_id,
    competency_name: cp.competency_name || null
  }));

  const envelope = {
    requester_service: 'skills-engine-service',
    payload: {
      action: 'Update user career path competencies',
      description: 'This request to Directory MS is to show the career-path competencies for the employee',
      user_id: userId,
      career_path_competencies: competencies
    },
    response: {}
  };

  // Log request body before sending
  console.log(
    '[DirectoryMSClient.sendCareerPathCompetencies] Sending POST request to Directory MS',
    JSON.stringify(envelope, null, 2)
  );

  // Use default unified endpoint /api/fill-content-metrics/
  return coordinatorClient.post(envelope);
}

module.exports = {
  sendInitialProfile,
  sendUpdatedProfile,
  getUserData,
  sendCareerPathCompetencies
};

