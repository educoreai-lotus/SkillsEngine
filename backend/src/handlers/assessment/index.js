/**
 * Assessment MS Handler
 * 
 * Handles requests from Assessment MS (exam results).
 */

const verificationService = require('../../services/verificationService');

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
function isValidUUID(uuid) {
  if (typeof uuid !== 'string') {
    return false;
  }
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

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
          ...(responseTemplate || {}),
          answer: {
            message: 'Invalid payload structure'
          }
        };
      }

      // Log incoming assessment request summary (reduced logging to prevent rate limits)
      const payloadKeys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
      console.log(
        '[AssessmentHandler] Incoming Assessment MS request - payload keys:',
        payloadKeys.join(', ')
      );

      const { user_id, exam_type, action } = payload;

      // Normalize exam_type (handle "postcourse" -> "post-course")
      const normalizedExamType = exam_type && typeof exam_type === 'string'
        ? exam_type.toLowerCase().trim().replace(/^postcourse$/, 'postcourse')
        : exam_type;

      // Validate user_id early - must be present, not null, and valid UUID format
      if (user_id === null || user_id === undefined || user_id === '') {
        return {
          ...(responseTemplate || {}),
          answer: {
            error: 'user_id is required and cannot be null or empty'
          }
        };
      }

      // Validate user_id is a valid UUID format
      if (!isValidUUID(user_id)) {
        return {
          ...(responseTemplate || {}),
          answer: {
            error: 'user_id must be a valid UUID format'
          }
        };
      }

      // Action: request_baseline_exam_skills
      // Assessment MS requests the list of skills for baseline exam creation
      if (action === 'fetch-baseline-skills') {
        return await this.handleBaselineExamSkillsRequest(payload, responseTemplate);
      }

      // Normalize exam results object:
      // Preferred format: payload = { user_id, exam_type, exam_status, course_name, final_grade, skills: [...] }
      // The skills field contains the exam results array with per-skill scores
      // Legacy shapes (for backward compatibility):
      //   - payload.results.{ skills: [...] }
      //   - payload.exam_results.{ skills / verified_skills / verifiedSkills }
      //   - payload.examResults.{ ... }
      //
      // We pass a single "exam_results" object into VerificationService that
      // always has the exam metadata + skills array on it.
      let exam_results = null;

      if (payload && typeof payload === 'object') {
        // Start with the whole payload so examResults.course_name, examResults.exam_status, etc. work.
        // The skills field should be directly in the payload
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

        // Ensure skills field is present (either from payload or nested)
        if (!exam_results.skills && !exam_results.verified_skills && !exam_results.verifiedSkills) {
          console.warn(
            '[AssessmentHandler] No skills field found in payload',
            { payloadKeys: Object.keys(payload) }
          );
        }
      }

      // Validate user_id explicitly (redundant check, but kept for safety)
      if (user_id === null || user_id === undefined || user_id === '') {
        return {
          ...(responseTemplate || {}),
          answer: {
            error: 'user_id is required and cannot be null or empty'
          }
        };
      }

      // Validate user_id is a valid UUID format (redundant check, but kept for safety)
      if (!isValidUUID(user_id)) {
        return {
          ...(responseTemplate || {}),
          answer: {
            error: 'user_id must be a valid UUID format'
          }
        };
      }

      // Validate exam_results presence
      if (!exam_results) {
        return {
          ...(responseTemplate || {}),
          answer: {
            error: 'exam_results are required'
          }
        };
      }

      // Validate exam_results is an object
      if (typeof exam_results !== 'object' || exam_results === null) {
        return {
          ...(responseTemplate || {}),
          answer: {
            message: 'exam_results must be an object'
          }
        };
      }

      // Normalize course_name (trim and convert empty string to null)
      if (exam_results && exam_results.course_name !== undefined) {
        const trimmedCourseName = typeof exam_results.course_name === 'string'
          ? exam_results.course_name.trim() || null
          : exam_results.course_name;
        exam_results.course_name = trimmedCourseName;
      }

      // Process exam results
      let result;
      if (normalizedExamType === 'baseline') {
        result = await verificationService.processBaselineExamResults(user_id, exam_results);
      } else if (normalizedExamType === 'postcourse') {
        result = await verificationService.processPostCourseExamResults(user_id, exam_results);
      } else {
        return {
          ...(responseTemplate || {}),
          answer: {
            message: `Invalid exam_type: "${exam_type}". Must be "baseline" or "post-course" (or "postcourse")`
          }
        };
      }

      // Validate result structure
      if (!result || typeof result !== 'object') {
        console.error(
          '[AssessmentHandler] Verification service returned invalid result',
          { user_id, exam_type, resultType: typeof result }
        );
        return {
          ...(responseTemplate || {}),
          answer: {
            message: 'Failed to process exam results'
          }
        };
      }

      // On success, wrap result in answer field
      return {
        ...(responseTemplate || {}),
        answer: result
      };
    } catch (error) {
      // Log error for debugging
      console.error('[AssessmentHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        payload: payload
      });

      return {
        ...(responseTemplate || {}),
        answer: {
          message: error.message || 'Internal server error'
        }
      };
    }
  }

  /**
   * Handle baseline exam skills request from Assessment MS.
   *
   * New behavior:
   *  - Receives a single competency_name (topic name) in the payload.
   *  - Returns ONLY the MGS (leaf skills) for that competency.
   *  - Does NOT depend on user_id and does NOT return all competencies the user owns.
   *
   * @param {Object} payload - Request payload with competency_name
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} MGS skills for the requested competency
   */
  async handleBaselineExamSkillsRequest(payload, responseTemplate) {
    const { competency_name } = payload || {};

    try {
      const competencyService = require('../../services/competencyService');

      // Validate competency_name
      if (!competency_name || typeof competency_name !== 'string') {
        return {
          ...(responseTemplate || {}),
          message: 'competency_name is required and must be a string'
        };
      }

      // Use competency_name to fetch required MGS (leaf skills) for that competency
      try {
        // Log the request
        console.log(
          '[AssessmentHandler.handleBaselineExamSkillsRequest] Fetching baseline exam skills from database',
          {
            competency_name,
            timestamp: new Date().toISOString()
          }
        );

        // Find the competency first to get its ID
        const competencyRepository = require('../../repositories/competencyRepository');
        const competency = await competencyRepository.findByName(competency_name);

        if (competency) {
          console.log(
            '[AssessmentHandler.handleBaselineExamSkillsRequest] Found competency in database',
            {
              competency_name,
              competency_id: competency.competency_id,
              found_via: 'direct_match_or_alias'
            }
          );
        } else {
          console.log(
            '[AssessmentHandler.handleBaselineExamSkillsRequest] Competency not found, will be created if needed',
            { competency_name }
          );
        }

        const mgs = await competencyService.getRequiredMGSByName(competency_name);

        // Map MGS to skills array, ensuring both skill_id and skill_name are included
        const skills = mgs.map(skill => {
          if (!skill || !skill.skill_id) {
            console.warn(
              '[AssessmentHandler.handleBaselineExamSkillsRequest] MGS skill missing skill_id',
              { skill }
            );
            return null;
          }
          return {
            skill_id: skill.skill_id,
            skill_name: skill.skill_name || skill.skillName || 'Unknown'
          };
        }).filter(s => s !== null); // Remove any null entries

        // Log the final list of skills retrieved from database (log summary to avoid formatting issues)
        const logData = {
          competency_name,
          competency_id: competency?.competency_id || 'N/A',
          skills_count: skills.length,
          skill_names: skills.map(s => s.skill_name)
        };
        console.log(
          '[AssessmentHandler.handleBaselineExamSkillsRequest] Final list of skills retrieved from database for baseline exam:',
          JSON.stringify(logData, null, 2)
        );

        // Build response object with skills list wrapped in answer field
        const response = {
          ...(responseTemplate || {}),
          answer: {
            competency_name,
            skills
          }
        };

        // Log response being sent back to Assessment MS (include full skills with IDs)
        console.log(
          '[AssessmentHandler.handleBaselineExamSkillsRequest] Sending response back to Assessment MS',
          JSON.stringify({
            competency_name,
            skills_count: skills.length,
            skills: skills.map(s => ({
              skill_id: s.skill_id,
              skill_name: s.skill_name
            })),
            response_keys: Object.keys(response)
          }, null, 2)
        );

        return response;
      } catch (err) {
        console.error(
          '[AssessmentHandler.handleBaselineExamSkillsRequest] Error fetching MGS by competency_name',
          { competency_name, error: err.message }
        );
        return {
          ...(responseTemplate || {}),
          answer: {
            competency_name,
            message: err.message
          }
        };
      }
    } catch (error) {
      console.error(
        '[AssessmentHandler.handleBaselineExamSkillsRequest] Error:',
        { error: error.message }
      );
      return {
        answer: {
          message: error.message
        }
      };
    }
  }
}

module.exports = new AssessmentHandler();


