/**
 * Directory MS Handler
 * 
 * Handles requests from Directory MS.
 */

class DirectoryHandler {
  /**
   * Process Directory MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    // TODO: Implement Directory MS specific logic
    // For now, just echo the requested answer template (business result only)
    return (responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {};
  }
}

module.exports = new DirectoryHandler();


