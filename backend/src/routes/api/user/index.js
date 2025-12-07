/**
 * User API Routes
 */

const express = require('express');
const router = express.Router();
const userController = require('../../../controllers/userController');

// Extract from raw data
router.post('/:userId/extract', userController.extractFromRawData.bind(userController));

// Normalize data
router.post('/:userId/normalize', userController.normalizeData.bind(userController));

// Full pipeline: extract -> normalize -> build initial profile
router.post('/:userId/ingest', userController.ingestFromRawData.bind(userController));

// Build initial profile (writes user skills & competencies and sends payload)
router.post('/:userId/initial-profile', userController.buildInitialProfile.bind(userController));

// Manually trigger baseline exam request for a user (testing/ops)
router.post('/:userId/request-baseline-exam', userController.requestBaselineExam.bind(userController));

// One-shot onboarding: save basic profile + full pipeline
router.post('/onboard', userController.onboardAndIngest.bind(userController));

// Get user basic profile (no skills/competencies)
router.get('/:userId', userController.getUserProfile.bind(userController));

// Create or update user
router.post('/', userController.createOrUpdateUser.bind(userController));

// Update user
router.put('/:userId', userController.updateUser.bind(userController));

module.exports = router;