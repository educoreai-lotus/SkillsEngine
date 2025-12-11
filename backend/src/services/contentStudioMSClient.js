/**
 * Content Studio MS API Client (via Coordinator)
 *
 * Handles communication with Content Studio MS indirectly by sending
 * signed requests to the Coordinator, which then routes to Content Studio.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Send skills data to Content Studio MS via Coordinator
 * @param {string} competencyId - Competency ID
 * @param {Array} skills - Skills array
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendSkillsData(competencyId, skills) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Send skills data for competency to Content Studio MS',
      competency_id: competencyId,
      skills
    },
    response: {
      answer: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/content-studio/competency-skills'
  });
}

module.exports = {
  sendSkillsData
};

