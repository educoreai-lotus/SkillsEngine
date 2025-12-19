/**
 * User Career Path Controller
 * 
 * Handles HTTP requests for user career path operations.
 */

const userCareerPathRepository = require('../repositories/userCareerPathRepository');
const competencyService = require('../services/competencyService');
const competencyRepository = require('../repositories/competencyRepository');
const userRepository = require('../repositories/userRepository');

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

      // Check if this is a core-competency (has no children)
      const hasChildren = await competencyRepository.hasChildren(resolvedCompetencyId);
      const isCore = !hasChildren; // Core-competency has no children

      // Only allow adding leaf nodes (core competencies), not parent competencies
      if (!isCore) {
        return res.status(400).json({
          success: false,
          error: 'Only leaf nodes (core competencies) can be added to career path. Please select a competency with no sub-competencies.'
        });
      }

      let rootCareerPathCompetencyId = null;

      // Get the root career path from user's path_career
      try {
        // Get user's career path name
        const user = await userRepository.findById(user_id);
        if (user && user.path_career) {
          // Find the competency that represents the career path
          const careerPathCompetency = await competencyRepository.findByName(user.path_career.trim());
          if (careerPathCompetency) {
            rootCareerPathCompetencyId = careerPathCompetency.competency_id;
          } else {
            console.warn('[UserCareerPathController] Career path competency not found', {
              path_career: user.path_career,
              userId: user_id
            });
          }
        } else {
          console.warn('[UserCareerPathController] User has no path_career set', { userId: user_id });
        }
      } catch (err) {
        console.warn('[UserCareerPathController] Failed to find root career path from user.path_career', {
          competencyId: resolvedCompetencyId,
          userId: user_id,
          error: err.message
        });
        // Continue without root link if lookup fails
      }

      const careerPath = await userCareerPathRepository.create({
        user_id,
        competency_id: resolvedCompetencyId,
        root_career_path_competency_id: rootCareerPathCompetencyId
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

