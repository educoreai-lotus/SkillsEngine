/**
 * Assessment MS API Client (via Coordinator)
 *
 * Handles communication with Assessment MS indirectly by sending
 * signed requests to the Coordinator, which then routes to Assessment MS.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');

const coordinatorClient = getCoordinatorClient();

/**
 * Request baseline exam for user via Coordinator
 * @param {string} userId - User ID
 * @param {string} userName - User name
 * @param {Array} competenciesWithMGS - Array of competencies with their MGS
 * @param {string|null} companyId - Company ID (optional)
 * @returns {Promise<Object>} Exam request response envelope from Coordinator
 *
 * Expected structure for competenciesWithMGS:
 * [
 *   {
 *     competency_id: "comp_001",
 *     competency_name: "Software Development",
 *     mgs: [
 *       { skill_id: "skill_mgs_001", skill_name: "JavaScript Variables" },
 *       { skill_id: "skill_mgs_002", skill_name: "React Hooks" }
 *     ]
 *   }
 * ]
 */
async function requestBaselineExam(userId, userName, competenciesWithMGS, companyId = null) {
  const list = competenciesWithMGS || [];

  // Array form: each competency carries its id, name, and MGS list.
  const outboundCompetencies = list.map((comp) => ({
    competency_id: comp.competency_id || null,
    competency_name: comp.competency_name,
    mgs: comp.mgs || []
  }));

  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Create baseline exam for user',
      user_id: userId,
      user_name: userName,
      company_id: companyId || null,
      exam_type: 'baseline exam',
      competencies: outboundCompetencies
    },
    response: {
      status: 'success',
      message: '',
      data: {
        exam_id: null
      }
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/assessment/baseline-exam'
  });
}

/**
 * Get exam results from Assessment MS via Coordinator
 * @param {string} examId - Exam ID
 * @returns {Promise<Object>} Exam results envelope from Coordinator
 */
async function getExamResults(examId) {
  const envelope = {
    requester_service: 'skills-engine',
    payload: {
      action: 'Get exam results for assessment exam',
      exam_id: examId
    },
    response: {
      status: 'success',
      message: '',
      data: {}
    }
  };

  return coordinatorClient.post(envelope, {
    endpoint: '/api/events/assessment/get-exam-results'
  });
}

module.exports = {
  requestBaselineExam,
  getExamResults
};

