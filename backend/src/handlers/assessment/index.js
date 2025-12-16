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

      // Log full incoming assessment request body for debugging
      console.log(
        '[AssessmentHandler] Incoming Assessment MS request - full payload:',
        JSON.stringify(payload, null, 2)
      );

      const { user_id, exam_type, action } = payload;

      // Action: request_baseline_exam_skills
      // Assessment MS requests the list of skills for baseline exam creation
      if (action === 'fetch-baseline-skills') {
        return await this.handleBaselineExamSkillsRequest(payload, responseTemplate);
      }

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
        ...(responseTemplate || {}),
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

  /**
   * Handle baseline exam skills request from Assessment MS
   * @param {Object} payload - Request payload with user_id
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Competencies with MGS for baseline exam
   */
  async handleBaselineExamSkillsRequest(payload, responseTemplate) {
    const { user_id } = payload;

    if (!user_id) {
      return { message: 'user_id is required' };
    }

    try {
      const userCompetencyRepository = require('../../repositories/userCompetencyRepository');
      const competencyService = require('../../services/competencyService');

      // Get all user competencies
      const userCompetencies = await userCompetencyRepository.findByUser(user_id);

      if (!userCompetencies || userCompetencies.length === 0) {
        return {
          ...(responseTemplate || {}),
          user_id,
          message: 'No competencies found for user'
        };
      }

      // Build competencies with MGS list as a map (competency_name -> MGS array)
      const competenciesMap = {};
      for (const userComp of userCompetencies) {
        try {
          const competency = await competencyService.getCompetencyById(userComp.competency_id);
          const competencyName = competency?.competency_name || 'Unknown';
          const mgs = await competencyService.getRequiredMGS(userComp.competency_id);

          // Use competency name as key, array of MGS skills as value
          competenciesMap[competencyName] = mgs.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name
          }));
        } catch (err) {
          console.warn(
            '[AssessmentHandler.handleBaselineExamSkillsRequest] Failed to get MGS for competency',
            { user_id, competency_id: userComp.competency_id, error: err.message }
          );
        }
      }

      console.log(
        '[AssessmentHandler.handleBaselineExamSkillsRequest] Returning baseline exam skills',
        { user_id, competencyCount: Object.keys(competenciesMap).length }
      );

      return {
        ...(responseTemplate || {}),
        user_id,
        skills: competenciesMap
      };
    } catch (error) {
      console.error(
        '[AssessmentHandler.handleBaselineExamSkillsRequest] Error:',
        { user_id, error: error.message }
      );
      return { message: error.message };
    }
  }
}

module.exports = new AssessmentHandler();


