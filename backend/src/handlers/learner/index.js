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
      const { action } = payload || {};

      // Action: request_skills_breakdown
      // Learner AI sends a list of competency names and expects leaf skills (MGS)
      if (action === 'request_skills_breakdown') {
        const { competencies } = payload;

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
          ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
          nodes: allNodes,
          competencies: breakdown
        };
      }

      // Default action: run gap analysis and push to Learner AI MS
      const { user_id, competency_id, competency_name } = payload;

      if (!user_id) {
        return { message: 'user_id is required' };
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
        ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
        user_id,
        competency_id: resolvedCompetencyId || null,
        competency_name: competency_name || null,
        gaps,
        related_skills: relatedSkills
      };
    } catch (error) {
      return { message: error.message };
    }
  }
}

module.exports = new LearnerAIHandler();


