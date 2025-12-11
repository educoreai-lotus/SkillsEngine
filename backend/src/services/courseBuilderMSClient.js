/**
 * Course Builder MS API Client (via Coordinator)
 *
 * Handles communication with Course Builder MS indirectly by sending
 * signed requests to the Coordinator, which then routes to Course Builder.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Get skills for competency via Coordinator
 * @param {string} competencyName - Competency name
 * @returns {Promise<Object>} Skills data envelope from Coordinator
 */
async function getSkillsForCompetency(competencyName) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Get MGS/skills list for a given competency for Course Builder MS',
      competency_name: competencyName
    },
    response: {
      answer: {
        competency_id: null,
        competency_name: '',
        mgs_list: [],
        discovered: false
      }
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/course-builder/competency-skills'
  });
}

module.exports = {
  getSkillsForCompetency
};

