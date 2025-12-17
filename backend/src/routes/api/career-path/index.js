/**
 * Career Path API Routes
 * 
 * REST endpoints for career path operations.
 */

const express = require('express');
const router = express.Router();
const careerPathController = require('../../../controllers/careerPathController');

// Search competencies by name substring (must come before /:userId routes)
router.get('/search/competencies', careerPathController.searchCompetencies.bind(careerPathController));

// Get all career paths for a user
router.get('/:userId', careerPathController.getCareerPaths.bind(careerPathController));

// Get current (latest) career path for a user
router.get('/:userId/current', careerPathController.getCurrentCareerPath.bind(careerPathController));

// Calculate gap analysis for user's career paths
router.get('/:userId/gap', careerPathController.calculateGap.bind(careerPathController));

// Add a career path for a user
router.post('/', careerPathController.addCareerPath.bind(careerPathController));

// Remove a career path for a user
router.delete('/:userId/:competencyId', careerPathController.removeCareerPath.bind(careerPathController));

module.exports = router;

