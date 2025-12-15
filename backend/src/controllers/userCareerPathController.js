/**
 * User Career Path Controller
 * 
 * Handles HTTP requests for user career path operations.
 */

const userCareerPathRepository = require('../repositories/userCareerPathRepository');
const competencyService = require('../services/competencyService');

class UserCareerPathController {
  /**
   * Add a career path to a user
   * POST /api/user-career-path
   * Body: { user_id: string, competency_id: string }
   * OR
   * Body: { user_id: string, competency_name: string }
   */
  async addCareerPath(req, res) {
    try {
      const { user_id, competency_id, competency_name } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'user_id is required'
        });
      }

      let resolvedCompetencyId = competency_id;

      // If competency_name is provided instead of ID, resolve it
      if (!resolvedCompetencyId && competency_name) {
        const competency = await competencyService.getCompetencyByName(competency_name);
        if (!competency) {
          return res.status(404).json({
            success: false,
            error: `Competency with name "${competency_name}" not found`
          });
        }
        resolvedCompetencyId = competency.competency_id;
      }

      if (!resolvedCompetencyId) {
        return res.status(400).json({
          success: false,
          error: 'Either competency_id or competency_name is required'
        });
      }

      // Verify competency exists
      const competency = await competencyService.getCompetencyById(resolvedCompetencyId);
      if (!competency) {
        return res.status(404).json({
          success: false,
          error: `Competency with ID "${resolvedCompetencyId}" not found`
        });
      }

      const careerPath = await userCareerPathRepository.create({
        user_id,
        competency_id: resolvedCompetencyId
      });

      res.status(201).json({
        success: true,
        data: careerPath,
        message: 'Career path added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get current career path for a user
   * GET /api/user-career-path/:userId
   */
  async getCurrentCareerPath(req, res) {
    try {
      const { userId } = req.params;

      const careerPath = await userCareerPathRepository.findLatestByUser(userId);

      if (!careerPath) {
        return res.status(404).json({
          success: false,
          error: 'No career path found for this user'
        });
      }

      res.json({
        success: true,
        data: careerPath
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all career paths for a user (history)
   * GET /api/user-career-path/:userId/all
   */
  async getAllCareerPaths(req, res) {
    try {
      const { userId } = req.params;

      const careerPaths = await userCareerPathRepository.findByUser(userId);

      res.json({
        success: true,
        data: careerPaths,
        count: careerPaths.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete a specific career path entry
   * DELETE /api/user-career-path/:userId/:competencyId
   */
  async deleteCareerPath(req, res) {
    try {
      const { userId, competencyId } = req.params;

      await userCareerPathRepository.delete(userId, competencyId);

      res.json({
        success: true,
        message: 'Career path deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete all career paths for a user
   * DELETE /api/user-career-path/:userId
   */
  async deleteAllCareerPaths(req, res) {
    try {
      const { userId } = req.params;

      await userCareerPathRepository.deleteAllByUser(userId);

      res.json({
        success: true,
        message: 'All career paths deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new UserCareerPathController();

