/**
 * Learner AI MS Handler
 * 
 * Handles requests from Learner AI MS.
 * 
 * Current behavior:
 * - Learner AI sends a list of competency names and expects leaf skills (MGS) for each.
 */

const competencyService = require('../../services/competencyService');

class LearnerAIHandler {
  /**
   * Process Learner AI MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      // Validate payload structure
      if (!payload || typeof payload !== 'object') {
        return { message: 'Invalid payload structure' };
      }

      const { action, description, competencies } = payload || {};

      // Log full incoming Learner AI request for debugging
      console.log(
        '[LearnerAIHandler] Incoming Learner AI MS request - full payload:',
        JSON.stringify(payload, null, 2)
      );

      if (!Array.isArray(competencies) || competencies.length === 0) {
        console.warn('[LearnerAIHandler] Invalid competencies array:', { competencies });
        return { message: 'competencies must be a non-empty array of competency names' };
      }

      console.log('[LearnerAIHandler] Processing MGS request for competencies:', {
        competencyCount: competencies.length,
        competencies: competencies
      });

      const breakdown = {};
      let totalMGS = 0;

      for (const name of competencies) {
        if (typeof name !== 'string' || !name.trim()) {
          console.warn('[LearnerAIHandler] Skipping invalid competency name:', { name, type: typeof name });
          continue;
        }

        const competencyName = name.trim();
        console.log(`[LearnerAIHandler] Fetching MGS for competency: "${competencyName}"`);

        try {
          const mgs = await competencyService.getRequiredMGSByName(competencyName);
          console.log(`[LearnerAIHandler] Retrieved MGS for competency "${competencyName}":`, {
            competencyName,
            mgsCount: mgs.length,
            mgsSkills: mgs.map(skill => ({
              skill_id: skill.skill_id,
              skill_name: skill.skill_name
            }))
          });

          // Only include skill_id and skill_name for each skill
          const mgsArray = mgs.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name
          }));

          breakdown[competencyName] = mgsArray;
          totalMGS += mgsArray.length;
        } catch (err) {
          // If one competency is not found, capture the error instead of failing the whole request
          console.error(`[LearnerAIHandler] Error fetching MGS for competency "${competencyName}":`, {
            competencyName,
            error: err.message,
            stack: err.stack
          });
          breakdown[competencyName] = {
            error: err.message
          };
        }
      }

      // Build response with MGS breakdown
      const response = {
        ...(responseTemplate || {}),
        competencies: breakdown
      };

      // Log what Skills Engine is sending back to Learner AI
      console.log('[LearnerAIHandler] Sending response to Learner AI MS:', {
        competencyCount: Object.keys(breakdown).length,
        totalMGS: totalMGS,
        breakdown: Object.keys(breakdown).reduce((acc, compName) => {
          const mgs = breakdown[compName];
          if (Array.isArray(mgs)) {
            acc[compName] = {
              mgsCount: mgs.length,
              skills: mgs.slice(0, 5).map(s => s.skill_name) // Show first 5 skill names
            };
          } else {
            acc[compName] = mgs; // Error object
          }
          return acc;
        }, {}),
        fullResponse: JSON.stringify(response, null, 2)
      });

      return response;
    } catch (error) {
      console.error('[LearnerAIHandler] Unexpected error processing request:', {
        error: error.message,
        stack: error.stack,
        payload: payload
      });
      return { message: error.message };
    }
  }
}

module.exports = new LearnerAIHandler();


