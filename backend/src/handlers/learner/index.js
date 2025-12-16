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
      const { competencies } = payload || {};

      if (!Array.isArray(competencies) || competencies.length === 0) {
        return { message: 'competencies must be a non-empty array of competency names' };
      }

      const breakdown = {};
      const allNodes = [];

      for (const name of competencies) {
        if (typeof name !== 'string' || !name.trim()) {
          continue;
        }

        try {
          const mgs = await competencyService.getRequiredMGSByName(name.trim());
          breakdown[name] = mgs;

          // Also push into global nodes list (flattened view)
          for (const skill of mgs) {
            allNodes.push(skill);
          }
        } catch (err) {
          // If one competency is not found, capture the error instead of failing the whole request
          breakdown[name] = {
            error: err.message
          };
        }
      }

      return {
        ...(responseTemplate || {}),
        nodes: allNodes,
        competencies: breakdown
      };
    } catch (error) {
      return { message: error.message };
    }
  }
}

module.exports = new LearnerAIHandler();


