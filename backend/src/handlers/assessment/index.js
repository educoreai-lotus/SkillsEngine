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
        return { message: 'Invalid payload structure' };
      }

      const { user_id, exam_type } = payload;

      // Normalize exam results object:
      // New shape (preferred):
      //   payload = { user_id, exam_type, exam_status, course_name, skills: [...] }
      // Legacy shapes:
      //   - payload.results.{ skills: [...] }
      //   - payload.exam_results.{ skills / verified_skills / verifiedSkills }
      //   - payload.examResults.{ ... }
      //
      // We pass a single "exam_results" object into VerificationService that
      // always has the exam metadata + skills array on it.
      let exam_results = null;

      if (payload && typeof payload === 'object') {
        // Start with the whole payload so examResults.course_name, examResults.exam_status, etc. work.
        exam_results = { ...payload };

        // If nested legacy containers exist, merge them in (they may hold the skills array).
        const nested =
          payload.results ||
          payload.exam_results ||
          payload.examResults ||
          null;
        if (nested && typeof nested === 'object') {
          exam_results = { ...exam_results, ...nested };
        }
      }

      if (!user_id || !exam_results) {
        return { message: 'user_id and exam_results are required' };
      }

      // Validate exam_results is an object
      if (typeof exam_results !== 'object' || exam_results === null) {
        return { message: 'exam_results must be an object' };
      }

      // Process exam results
      let result;
      if (exam_type === 'baseline') {
        result = await verificationService.processBaselineExamResults(user_id, exam_results);
      } else if (exam_type === 'post-course') {
        result = await verificationService.processPostCourseExamResults(user_id, exam_results);
      } else {
        return { message: 'Invalid exam_type. Must be "baseline" or "post-course"' };
      }

      // Validate result structure
      if (!result || typeof result !== 'object') {
        console.error(
          '[AssessmentHandler] Verification service returned invalid result',
          { user_id, exam_type, resultType: typeof result }
        );
        return { message: 'Failed to process exam results' };
      }

      // On success, return only the business result shape (merged with template).
      return {
        ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
        ...result
      };
    } catch (error) {
      // Log error for debugging
      console.error('[AssessmentHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        payload: payload
      });

      return {
        message: error.message || 'Internal server error'
      };
    }
  }
}

module.exports = new AssessmentHandler();


