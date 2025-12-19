/**
 * User Career Path Routes
 * 
 * API endpoints for managing user career paths.
 * 
 * Domain Rules:
 * - company_id = company ID (company performing the edit) - used for authorization only
 * - learnerId = learner (whose career path is edited) - used for all API operations
 * - All career path APIs operate on the learner (learnerId), never the company
 * - Authorization: The learner's company_id must match the company_id parameter
 * 
 * Note: These endpoints receive userId (learner) in the request.
 * The company ID (company_id) is handled by the frontend for authorization.
 */

const express = require('express');
const router = express.Router();
const userCareerPathController = require('../../controllers/userCareerPathController');

/**
 * @route   POST /api/user-career-path
 * @desc    Add a career path to a user (learner)
 * @body    { user_id: string, competency_id: string } OR { user_id: string, competency_name: string }
 * @note    user_id must be the learner's ID, not the HR's ID
 */
router.post('/', userCareerPathController.addCareerPath.bind(userCareerPathController));

/**
 * @route   GET /api/user-career-path/:userId
 * @desc    Get current (latest) career path for a user (learner)
 * @param   userId - The learner's user ID
 * @note    userId must be the learner's ID, not the HR's ID
 */
router.get('/:userId', userCareerPathController.getCurrentCareerPath.bind(userCareerPathController));

/**
 * @route   GET /api/user-career-path/:userId/all
 * @desc    Get all career paths for a user (learner) (history)
 * @param   userId - The learner's user ID
 * @note    userId must be the learner's ID, not the HR's ID
 */
router.get('/:userId/all', userCareerPathController.getAllCareerPaths.bind(userCareerPathController));

/**
 * @route   DELETE /api/user-career-path/:userId/:competencyId
 * @desc    Delete a specific career path entry for a user (learner)
 * @param   userId - The learner's user ID
 * @param   competencyId - The competency ID to remove
 * @note    userId must be the learner's ID, not the HR's ID
 */
router.delete('/:userId/:competencyId', userCareerPathController.deleteCareerPath.bind(userCareerPathController));

/**
 * @route   DELETE /api/user-career-path/:userId
 * @desc    Delete all career paths for a user (learner)
 * @param   userId - The learner's user ID
 * @note    userId must be the learner's ID, not the HR's ID
 */
router.delete('/:userId', userCareerPathController.deleteAllCareerPaths.bind(userCareerPathController));

module.exports = router;

