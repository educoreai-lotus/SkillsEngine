/**
 * Learner AI MS API Client (via Coordinator)
 *
 * Handles communication with Learner AI MS indirectly by sending
 * signed requests to the Coordinator, which then routes to Learner AI.
 */

const { getCoordinatorClient } = require('../infrastructure/coordinatorClient/coordinatorClient');
const userService = require('./userService');

const coordinatorClient = getCoordinatorClient();

/**
 * Send gap analysis to Learner AI MS via Coordinator
 * @param {string} userId - User ID
 * @param {Object} gap - Gap analysis data (competency_name -> missing_skills array)
 * @param {string} analysisType - Analysis type: "broad" (career path) or "narrow" (course-specific)
 * @param {string} [courseName] - Course name (required for narrow analysis)
 * @param {string} [examStatus] - Exam status: "pass" or "fail" (for post-course exams)
 * @returns {Promise<Object>} Response envelope from Coordinator
 */
async function sendGapAnalysis(userId, gap, analysisType, courseName = null, examStatus = null) {
  let competencyTargetName = null;
  let userName = null;
  let companyId = null;
  let companyName = null;
  let preferredLanguage = null;

  // Get user profile to extract user_name, company_id, company_name, preferred_language, and path_career
  try {
    const profile = await userService.getUserProfile(userId);
    const user = profile?.user || profile;
    userName = user?.user_name || null;
    companyId = user?.company_id || null;
    companyName = user?.company_name || null;
    preferredLanguage = user?.preferred_language || 'en';

    if (analysisType === 'broad') {
      // For broad analysis, get user's path_career from profile
      competencyTargetName = user?.path_career || user?.career_path_goal || null;
    } else if (analysisType === 'narrow') {
      // For narrow analysis, use course name
      competencyTargetName = courseName;
    }
  } catch (error) {
    console.error('[learnerAIMSClient] Error fetching user profile:', error.message);
    // Default preferred_language to 'en' if user profile fetch fails
    preferredLanguage = 'en';
  }

  const envelope = {
    requester_service: 'skills-engine-service',
    payload: {
      action: 'update_skills_gap',
      user_id: userId,
      user_name: userName,
      company_id: companyId,
      company_name: companyName,
      competency_target_name: competencyTargetName,
      exam_status: examStatus,
      preferred_language: preferredLanguage,
      gap: gap
    },
    response: {}
  };

  // Use default unified endpoint /api/fill-content-metrics/
  try {
    return await coordinatorClient.post(envelope);
  } catch (error) {
    // Provide more context for 502 errors (Bad Gateway - Coordinator can't reach Learner AI MS)
    if (error.response && error.response.status === 502) {
      console.error('[learnerAIMSClient] Coordinator returned 502 Bad Gateway:', {
        message: 'Coordinator received request but cannot reach Learner AI MS',
        userId,
        analysisType,
        coordinatorError: error.response.data || error.message
      });
    }
    throw error;
  }
}

module.exports = {
  sendGapAnalysis
};

