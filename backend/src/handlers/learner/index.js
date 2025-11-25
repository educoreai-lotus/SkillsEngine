/**
 * Learner AI MS Handler
 * 
 * Handles requests from Learner AI MS.
 */

const gapAnalysisService = require('../../services/gapAnalysisService');
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
      const { user_id, competency_id, competency_name } = payload;

      if (!user_id) {
        return {
          status: 'error',
          message: 'user_id is required',
          data: {}
        };
      }

      // If only competency_name is provided, resolve it to an ID for gap analysis
      let resolvedCompetencyId = competency_id;
      if (!resolvedCompetencyId && competency_name) {
        const competency = await competencyService.getCompetencyByName(competency_name);
        resolvedCompetencyId = competency ? competency.competency_id : null;
      }

      // Calculate gap analysis (optionally scoped to a specific competency)
      const gaps = await gapAnalysisService.calculateGapAnalysis(user_id, resolvedCompetencyId);

      // Send to Learner AI MS (with fallback to mock data)
      const learnerAIMSClient = require('../../services/learnerAIMSClient');
      try {
        await learnerAIMSClient.sendGapAnalysis(user_id, gaps);
      } catch (error) {
        // Fallback is handled by apiClient
        console.warn('Failed to send gap analysis to Learner AI MS, using mock data:', error.message);
      }

      // If competency specified, get related skills (MGS)
      let relatedSkills = [];
      if (resolvedCompetencyId) {
        relatedSkills = await competencyService.getRequiredMGS(resolvedCompetencyId);
      }

      return {
        status: 'success',
        message: 'Gap analysis calculated',
        data: {
          ...responseTemplate?.data,
          user_id,
          competency_id: resolvedCompetencyId || null,
          competency_name: competency_name || null,
          gaps: gaps,
          related_skills: relatedSkills
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

module.exports = new LearnerAIHandler();


