/**
 * Career Path Controller
 * 
 * Handles HTTP requests for career path operations.
 * Uses CareerPathService for business logic.
 */

const careerPathService = require('../services/careerPathService');

class CareerPathController {
    /**
     * Get all career paths for a user
     * GET /api/career-path/:userId
     */
    async getCareerPaths(req, res) {
        try {
            const { userId } = req.params;
            const careerPaths = await careerPathService.getCareerPaths(userId);

            res.json({
                success: true,
                data: careerPaths
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get current (latest) career path for a user
     * GET /api/career-path/:userId/current
     */
    async getCurrentCareerPath(req, res) {
        try {
            const { userId } = req.params;
            const careerPath = await careerPathService.getCurrentCareerPath(userId);

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
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Add a career path for a user
     * POST /api/career-path
     * Body: { user_id: string, competency_id?: string, competency_name?: string }
     */
    async addCareerPath(req, res) {
        try {
            const { user_id, competency_id, competency_name } = req.body;

            const careerPath = await careerPathService.addCareerPath(
                user_id,
                competency_id,
                competency_name
            );

            res.status(201).json({
                success: true,
                data: careerPath
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Remove a career path for a user
     * DELETE /api/career-path/:userId/:competencyId
     */
    async removeCareerPath(req, res) {
        try {
            const { userId, competencyId } = req.params;

            await careerPathService.removeCareerPath(userId, competencyId);

            res.json({
                success: true,
                message: 'Career path removed successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Search competencies by name substring
     * GET /api/career-path/search/competencies?query=...&limit=20&offset=0
     */
    async searchCompetencies(req, res) {
        try {
            const { query, limit, offset } = req.query;

            const results = await careerPathService.searchCompetencies(query, limit, offset);

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Calculate gap analysis for user's career paths
     * GET /api/career-path/:userId/gap
     */
    async calculateGap(req, res) {
        try {
            const { userId } = req.params;

            const gapAnalysis = await careerPathService.calculateGap(userId);

            res.json(gapAnalysis);
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Calculate gap analysis and send to Learner AI
     * POST /api/career-path/:userId/calculate-and-send
     */
    async calculateGapAndSend(req, res) {
        try {
            const { userId } = req.params;

            const gapAnalysis = await careerPathService.calculateGapAndSend(userId);

            res.json({
                success: true,
                data: gapAnalysis,
                message: 'Gap analysis calculated and sent to Learner AI'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Add career path, calculate gap, and send to Learner AI
     * POST /api/career-path/add-and-analyze
     * Body: { user_id: string, competency_id?: string, competency_name?: string }
     */
    async addCareerPathAndAnalyze(req, res) {
        try {
            const { user_id, competency_id, competency_name } = req.body;

            const result = await careerPathService.addCareerPathAndSendGap(
                user_id,
                competency_id,
                competency_name
            );

            res.status(201).json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new CareerPathController();

