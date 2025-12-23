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
        '[LearnerAIHandler] Incoming Learner AI MS request - action:',
        action,
        'full payload:',
        JSON.stringify(payload, null, 2)
      );

      // Handle request_skills_breakdown action
      if (action === 'request_skills_breakdown' || action === 'get-mgs-for-competencies') {
        if (!Array.isArray(competencies) || competencies.length === 0) {
          console.warn('[LearnerAIHandler] Invalid competencies array for request_skills_breakdown');
          return { message: 'competencies must be a non-empty array of competency names' };
        }

        console.log('[LearnerAIHandler] Processing request_skills_breakdown for competencies:', {
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
            // Only include skill_id and skill_name for each skill
            const mgsArray = mgs.map(skill => ({
              skill_id: skill.skill_id,
              skill_name: skill.skill_name
            }));

            breakdown[competencyName] = mgsArray;
            totalMGS += mgsArray.length;

            console.log(`[LearnerAIHandler] Retrieved ${mgsArray.length} MGS skills for competency "${competencyName}"`);
          } catch (err) {
            // If one competency is not found, capture the error instead of failing the whole request
            console.error(`[LearnerAIHandler] Error fetching MGS for competency "${competencyName}":`, {
              error: err.message,
              stack: err.stack
            });
            breakdown[competencyName] = {
              error: err.message
            };
          }
        }

        // Fill the response section with MGS breakdown
        const response = {
          ...(responseTemplate || {}),
          competencies: breakdown
        };

        return response;
      }

      // Handle other actions or default behavior
      console.warn('[LearnerAIHandler] Unknown action:', action);
      return { message: `Unknown action: ${action}` };
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
