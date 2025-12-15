/**
 * Career Path Handler
 *
 * Handles career path operations from coordinator/external services.
 *
 * Supported actions:
 * - get_career_paths: Get all career paths for a user
 * - get_current_career_path: Get the latest career path for a user
 * - add_career_path: Add a career path for a user
 * - remove_career_path: Remove a career path for a user
 * - search_competencies: Search competencies by name substring
 */

const userCareerPathRepository = require('../../repositories/userCareerPathRepository');
const competencyService = require('../../services/competencyService');

class CareerPathHandler {
  /**
   * Process career path requests
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      const { action, user_id, competency_id, competency_name, query, limit, offset } = payload || {};

      if (!action) {
        return { success: false, error: 'action is required' };
      }

      switch (action) {
        case 'get_career_paths':
          return this.getCareerPaths(user_id);

        case 'get_current_career_path':
          return this.getCurrentCareerPath(user_id);

        case 'add_career_path':
          return this.addCareerPath(user_id, competency_id, competency_name);

        case 'remove_career_path':
          return this.removeCareerPath(user_id, competency_id);

        case 'search_competencies':
          return this.searchCompetencies(query, limit, offset);

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      console.error('[CareerPathHandler] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all career paths for a user
   */
  async getCareerPaths(userId) {
    if (!userId) {
      return { success: false, error: 'user_id is required' };
    }

    const careerPaths = await userCareerPathRepository.findByUser(userId);
    return {
      success: true,
      data: careerPaths
    };
  }

  /**
   * Get current (latest) career path for a user
   */
  async getCurrentCareerPath(userId) {
    if (!userId) {
      return { success: false, error: 'user_id is required' };
    }

    const careerPath = await userCareerPathRepository.findLatestByUser(userId);
    return {
      success: true,
      data: careerPath
    };
  }

  /**
   * Add a career path for a user
   */
  async addCareerPath(userId, competencyId, competencyName) {
    if (!userId) {
      return { success: false, error: 'user_id is required' };
    }

    if (!competencyId && !competencyName) {
      return { success: false, error: 'competency_id or competency_name is required' };
    }

    let resolvedCompetencyId = competencyId;

    // If competency_name provided, look up the competency_id
    if (!competencyId && competencyName) {
      const competency = await competencyService.getCompetencyByName(competencyName);
      if (!competency) {
        return { success: false, error: `Competency not found: ${competencyName}` };
      }
      resolvedCompetencyId = competency.competency_id;
    }

    const careerPath = await userCareerPathRepository.create({
      user_id: userId,
      competency_id: resolvedCompetencyId
    });

    return {
      success: true,
      data: careerPath
    };
  }

  /**
   * Remove a career path for a user
   */
  async removeCareerPath(userId, competencyId) {
    if (!userId) {
      return { success: false, error: 'user_id is required' };
    }

    if (!competencyId) {
      return { success: false, error: 'competency_id is required' };
    }

    await userCareerPathRepository.delete(userId, competencyId);
    return {
      success: true,
      message: 'Career path removed successfully'
    };
  }

  /**
   * Search competencies by name substring
   */
  async searchCompetencies(query, limit = 20, offset = 0) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { success: false, error: 'query is required and must be a non-empty string' };
    }

    const results = await competencyService.searchCompetencies(query.trim(), {
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0
    });

    return {
      success: true,
      data: results
    };
  }
}

module.exports = new CareerPathHandler();
