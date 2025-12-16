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
        return { message: 'competencies must be a non-empty array of competency names' };
      }

      const breakdown = {};

      for (const name of competencies) {
        if (typeof name !== 'string' || !name.trim()) {
          continue;
        }

        try {
          const mgs = await competencyService.getRequiredMGSByName(name.trim());
          // Only include skill_id and skill_name for each skill
          breakdown[name] = mgs.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name
          }));
        } catch (err) {
          // If one competency is not found, capture the error instead of failing the whole request
          breakdown[name] = {
            error: err.message
          };
        }
      }

      return {
        ...(responseTemplate || {}),
        competencies: breakdown
      };
    } catch (error) {
      return { message: error.message };
    }
  }
}

module.exports = new LearnerAIHandler();


