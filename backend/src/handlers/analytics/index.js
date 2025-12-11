/**
 * Learning Analytics MS Handler
 * 
 * Handles requests from Learning Analytics MS.
 */

const userService = require('../../services/userService');
const userCompetencyRepository = require('../../repositories/userCompetencyRepository');

class AnalyticsHandler {
  /**
   * Process Learning Analytics MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      const { user_id, company_id } = payload;

      if (user_id) {
        // Get user profile data
        const profile = await userService.getFullUserProfile(user_id);
        return {
          ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
          ...profile
        };
      }

      if (company_id) {
        // Get company-wide analytics
        // TODO: Implement company-wide aggregation
        return {
          ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
          company_id
        };
      }

      return { message: 'user_id or company_id is required' };
    } catch (error) {
      return { message: error.message };
    }
  }
}

module.exports = new AnalyticsHandler();


