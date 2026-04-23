/**
 * Career Path API Routes
 * 
 * REST endpoints for career path operations.
 */

const express = require('express');
const router = express.Router();
const careerPathController = require('../../../controllers/careerPathController');
const { authenticate } = require('../../../middleware/auth');
const { authorizeHR, authorizeCompanyScope } = require('../../../middleware/authorization');

router.use(authenticate, authorizeHR);

// Search competencies by name substring (must come before /:userId routes)
router.get('/search/competencies', careerPathController.searchCompetencies.bind(careerPathController));

// Get all career paths for a user
router.get(
  '/:userId',
  authorizeCompanyScope(['params.userId']),
  careerPathController.getCareerPaths.bind(careerPathController)
);

// Get current (latest) career path for a user
router.get(
  '/:userId/current',
  authorizeCompanyScope(['params.userId']),
  careerPathController.getCurrentCareerPath.bind(careerPathController)
);

// Calculate gap analysis for user's career paths
router.get(
  '/:userId/gap',
  authorizeCompanyScope(['params.userId']),
  careerPathController.calculateGap.bind(careerPathController)
);

// Calculate gap analysis and send to Learner AI
router.post(
  '/:userId/calculate-and-send',
  authorizeCompanyScope(['params.userId']),
  careerPathController.calculateGapAndSend.bind(careerPathController)
);

// Add a career path for a user
router.post(
  '/',
  authorizeCompanyScope(['body.user_id']),
  careerPathController.addCareerPath.bind(careerPathController)
);

// Add career path, calculate gap, and send to Learner AI
router.post(
  '/add-and-analyze',
  authorizeCompanyScope(['body.user_id']),
  careerPathController.addCareerPathAndAnalyze.bind(careerPathController)
);

// Remove a career path for a user
router.delete(
  '/:userId/:competencyId',
  authorizeCompanyScope(['params.userId']),
  careerPathController.removeCareerPath.bind(careerPathController)
);

module.exports = router;

