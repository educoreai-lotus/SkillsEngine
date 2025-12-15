/**
 * User Career Path Routes
 * 
 * API endpoints for managing user career paths.
 */

const express = require('express');
const router = express.Router();
const userCareerPathController = require('../../controllers/userCareerPathController');

/**
 * @route   POST /api/user-career-path
 * @desc    Add a career path to a user
 * @body    { user_id: string, competency_id: string } OR { user_id: string, competency_name: string }
 */
router.post('/', userCareerPathController.addCareerPath.bind(userCareerPathController));

/**
 * @route   GET /api/user-career-path/:userId
 * @desc    Get current (latest) career path for a user
 */
router.get('/:userId', userCareerPathController.getCurrentCareerPath.bind(userCareerPathController));

/**
 * @route   GET /api/user-career-path/:userId/all
 * @desc    Get all career paths for a user (history)
 */
router.get('/:userId/all', userCareerPathController.getAllCareerPaths.bind(userCareerPathController));

/**
 * @route   DELETE /api/user-career-path/:userId/:competencyId
 * @desc    Delete a specific career path entry
 */
router.delete('/:userId/:competencyId', userCareerPathController.deleteCareerPath.bind(userCareerPathController));

/**
 * @route   DELETE /api/user-career-path/:userId
 * @desc    Delete all career paths for a user
 */
router.delete('/:userId', userCareerPathController.deleteAllCareerPaths.bind(userCareerPathController));

module.exports = router;

