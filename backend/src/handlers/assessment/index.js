/**
 * Assessment MS Handler
 * 
 * Handles requests from Assessment MS (exam results).
 */

const verificationService = require('../../services/verificationService');

class AssessmentHandler {
  /**
   * Process Assessment MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      // Validate payload structure
      if (!payload || typeof payload !== 'object') {
        return {
          status: 'error',
          message: 'Invalid payload structure',
          data: {}
        };
      }

      const { user_id, exam_type, exam_results } = payload;

      if (!user_id || !exam_results) {
        return {
          status: 'error',
          message: 'user_id and exam_results are required',
          data: {}
        };
      }

      // Validate exam_results is an object
      if (typeof exam_results !== 'object' || exam_results === null) {
        return {
          status: 'error',
          message: 'exam_results must be an object',
          data: {}
        };
      }

      // Process exam results
      let result;
      if (exam_type === 'baseline') {
        result = await verificationService.processBaselineExamResults(user_id, exam_results);
      } else if (exam_type === 'post-course') {
        result = await verificationService.processPostCourseExamResults(user_id, exam_results);
      } else {
        return {
          status: 'error',
          message: 'Invalid exam_type. Must be "baseline" or "post-course"',
          data: {}
        };
      }

      // Validate result structure
      if (!result || typeof result !== 'object') {
        console.error(
          '[AssessmentHandler] Verification service returned invalid result',
          { user_id, exam_type, resultType: typeof result }
        );
        return {
          status: 'error',
          message: 'Failed to process exam results',
          data: {}
        };
      }

      return {
        status: 'success',
        message: 'Exam results processed successfully',
        data: {
          ...responseTemplate?.data,
          ...result
        }
      };
    } catch (error) {
      // Log error for debugging
      console.error('[AssessmentHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        payload: payload
      });

      return {
        status: 'error',
        message: error.message || 'Internal server error',
        data: {}
      };
    }
  }
}

module.exports = new AssessmentHandler();


