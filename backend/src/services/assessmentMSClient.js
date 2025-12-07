/**
 * Assessment MS API Client
 *
 * Handles communication with Assessment MS with fallback to mock data.
 */

const { createAPIClient } = require('../utils/apiClient');

const assessmentClient = createAPIClient({
  baseURL: process.env.ASSESSMENT_SERVICE_URL || 'http://localhost:3002',
  mockFile: 'assessment_ms_exam_results.json',
  apiName: 'Assessment MS'
});

/**
 * Request baseline exam for user
 * @param {string} userId - User ID
 * @param {string} userName - User name
 * @param {Array} competenciesWithMGS - Array of competencies with their MGS
 * @param {string|null} companyId - Company ID (optional)
 * @returns {Promise<Object>} Exam request response
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
 *
 * Outbound contract (Skills Engine -> Assessment MS):
 * {
 *   "user_id": "<USER_ID>",
 *   "user_name": "<USER_NAME>",
 *   "company_id": "<COMPANY_ID or null>",
 *   "exam_type": "baseline exam",
 *   "competencies": [
 *     {
 *       "competency_id": "<COMPETENCY_ID or null>",
 *       "competency_name": "Software Development",
 *       "mgs": [
 *         { "skill_id": "skill_mgs_001", "skill_name": "JavaScript Variables" },
 *         { "skill_id": "skill_mgs_002", "skill_name": "React Hooks" }
 *       ]
 *     }
 *   ]
 * }
 */
async function requestBaselineExam(userId, userName, competenciesWithMGS, companyId = null) {
  try {
    const list = competenciesWithMGS || [];

    // Array form: each competency carries its id, name, and MGS list.
    const outboundCompetencies = list.map((comp) => ({
      competency_id: comp.competency_id || null,
      competency_name: comp.competency_name,
      mgs: comp.mgs || []
    }));

    const response = await assessmentClient.post(
      '/api/exams/baseline',
      {
        user_id: userId,
        user_name: userName,
        company_id: companyId || null,
        exam_type: 'baseline exam',
        competencies: outboundCompetencies
      },
      {
        Authorization: `Bearer ${process.env.ASSESSMENT_SERVICE_TOKEN || ''}`
      }
    );

    return response;
  } catch (error) {
    // Fallback is handled by apiClient
    throw error;
  }
}

/**
 * Get exam results from Assessment MS
 * @param {string} examId - Exam ID
 * @returns {Promise<Object>} Exam results
 */
async function getExamResults(examId) {
  try {
    const response = await assessmentClient.get(`/api/exams/${examId}/results`, {
      Authorization: `Bearer ${process.env.ASSESSMENT_SERVICE_TOKEN || ''}`
    });

    return response;
  } catch (error) {
    // Fallback is handled by apiClient
    throw error;
  }
}

module.exports = {
  requestBaselineExam,
  getExamResults
};

