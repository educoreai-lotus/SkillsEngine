/**
 * Course Builder MS Handler
 * 
 * Handles requests from Course Builder MS.
 */

const skillDiscoveryService = require('../../services/skillDiscoveryService');

class CourseBuilderHandler {
  /**
   * Process Course Builder MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      const { competency_name, user_id } = payload;

      if (!competency_name) {
        return { message: 'competency_name is required' };
      }

      // Look up competency and get skills
      const result = await skillDiscoveryService.lookupByCompetency(competency_name);

      if (!result) {
        // Trigger external discovery
        const discovered = await skillDiscoveryService.discoverExternal(competency_name);
        return {
          ...(responseTemplate || {}),
          ...discovered
        };
      }

      // On success, return only the business result shape (merged with template).
      return {
        ...(responseTemplate || {}),
        ...result
      };
    } catch (error) {
      return { message: error.message };
    }
  }
}

module.exports = new CourseBuilderHandler();


