/**
 * RAG/Chatbot MS API Client (via Coordinator)
 *
 * Handles communication with RAG MS indirectly by sending
 * signed requests to the Coordinator, which then routes to RAG.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Search skills/competencies for RAG MS via Coordinator
 * @param {string} query - Search query
 * @param {string} type - Search type ('skill', 'competency', or null for both)
 * @returns {Promise<Object>} Search results envelope from Coordinator
 */
async function search(query, type = null) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Search skills and competencies for RAG/Chatbot MS',
      query,
      type: type || null
    },
    response: {
      status: 'success',
      message: '',
      data: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/rag/search'
  });
}

module.exports = {
  search
};

