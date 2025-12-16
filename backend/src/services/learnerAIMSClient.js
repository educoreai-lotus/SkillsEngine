/**
 * Learner AI MS API Client (via Coordinator)
 *
 * Handles communication with Learner AI MS indirectly by sending
 * signed requests to the Coordinator, which then routes to Learner AI.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Send gap analysis to Learner AI MS via Coordinator
 * @param {string} userId - User ID
 * @param {Object} gaps - Gap analysis data (competency_name -> missing_skills array)
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendGapAnalysis(userId, gaps) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Send gap analysis results',
      user_id: userId,
      missing_mgs: gaps
    },
    response: {}
  };

  // Use default unified endpoint /api/fill-content-metrics/
  return coordinatorClient.post(envelope);
}

module.exports = {
  sendGapAnalysis
};

