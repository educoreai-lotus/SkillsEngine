/**
 * Content Studio MS Handler
 * 
 * Handles requests from Content Studio MS.
 */

const competencyService = require('../../services/competencyService');

class ContentStudioHandler {
  /**
   * Process Content Studio MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      const { competency_id, competency_name } = payload;

      if (!competency_id && !competency_name) {
        return {
          status: 'error',
          message: 'Either competency_id or competency_name is required',
          data: {}
        };
      }

      // Get all related skills (MGS) for this competency
      const skills = competency_id
        ? await competencyService.getRequiredMGS(competency_id)
        : await competencyService.getRequiredMGSByName(competency_name);

      return {
        status: 'success',
        message: 'Skills retrieved successfully',
        data: {
          ...responseTemplate?.data,
          competency_id: competency_id || null,
          competency_name: competency_name || null,
          skills: skills
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        data: {}
      };
    }
  }
}

module.exports = new ContentStudioHandler();


