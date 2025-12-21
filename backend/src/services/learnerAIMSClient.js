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
      action: 'update_skills_gap to learnerAI-service',
      description:'Send skills gap analysis to Learner AI MS for user in order to create learn path for the learner',
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

  // Log request body before sending
  console.log(
    '[LearnerAIMSClient.sendGapAnalysis] Sending POST request to Learner AI MS',
    JSON.stringify(envelope, null, 2)
  );

  // Use default unified endpoint /api/fill-content-metrics/
  // Default timeout is now 5 minutes (300 seconds) for all Coordinator requests
  try {
    return await coordinatorClient.post(envelope);
  } catch (error) {
    // Enhanced error logging with full context
    const errorContext = {
      userId,
      analysisType,
      competencyTargetName,
      gapCompetencyCount: Object.keys(gap).length,
      totalMissingSkills: Object.values(gap).reduce((sum, skills) => sum + skills.length, 0)
    };

    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      errorContext.status = status;
      errorContext.statusText = error.response.statusText;
      errorContext.responseData = error.response.data;

      if (status === 502) {
        console.error('[learnerAIMSClient] Coordinator returned 502 Bad Gateway:', {
          message: 'Coordinator received request but cannot reach Learner AI MS',
          ...errorContext,
          coordinatorError: error.response.data || error.message,
          possibleCauses: [
            'Learner AI MS is not running',
            'Learner AI MS is not registered with Coordinator',
            'Network connectivity issue between Coordinator and Learner AI MS'
          ]
        });
      } else if (status === 404) {
        console.error('[learnerAIMSClient] Coordinator returned 404 Not Found:', {
          message: 'Coordinator endpoint or service not found',
          ...errorContext
        });
      } else if (status === 401 || status === 403) {
        console.error('[learnerAIMSClient] Coordinator returned authentication error:', {
          message: 'Authentication or authorization failed',
          status,
          ...errorContext
        });
      } else {
        console.error('[learnerAIMSClient] Coordinator returned error:', {
          message: `HTTP ${ status } error from Coordinator`,
          ...errorContext
        });
      }
    } else if (error.request) {
      // Request made but no response
      console.error('[learnerAIMSClient] No response from Coordinator:', {
        message: 'Request sent but no response received',
        ...errorContext,
        possibleCauses: [
          'Coordinator service is down',
          'Network timeout',
          'Coordinator URL is incorrect'
        ]
      });
    } else {
      // Request setup error
      console.error('[learnerAIMSClient] Request setup error:', {
        message: error.message,
        ...errorContext
      });
    }

    throw error;
  }
}

module.exports = {
  sendGapAnalysis
};

