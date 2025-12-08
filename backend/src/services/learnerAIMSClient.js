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
 * @param {Object} gapAnalysis - Gap analysis data
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendGapAnalysis(userId, gapAnalysis) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      user_id: userId,
      user_name: gapAnalysis.user_name,
      company_id: gapAnalysis.company_id,
      course_name: gapAnalysis.course_name,
      missing_mgs: gapAnalysis.missing_mgs,
      exam_status: gapAnalysis.exam_status,
      company_name: gapAnalysis.company_name
    },
    response: {
      status: 'success',
      message: '',
      data: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/learner-ai/gap-analysis'
  });
}

module.exports = {
  sendGapAnalysis
};

