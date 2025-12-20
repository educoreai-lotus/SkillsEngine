/**
 * Competencies API Routes
 */

const express = require('express');
const router = express.Router();
const competencyController = require('../../../controllers/competencyController');
const { controller: importController, upload } = require('../../../controllers/importController');

// CSV Import (trainer only)
router.post('/import', upload, importController.importCSV.bind(importController));
router.post('/import/validate', upload, importController.validateCSV.bind(importController));

// Get all competencies (must be before /:competencyId route)
router.get('/', competencyController.getAllCompetencies.bind(competencyController));

// Search competencies by name (case-insensitive, ?q=pattern)
router.get('/search', competencyController.searchCompetencies.bind(competencyController));

// Get single competency info by name (body: { competency_name })
router.post('/by-name', competencyController.getCompetencyByName.bind(competencyController));

// Get MGS (leaf skills) for a competency by name (body: { competency_name })
router.post('/mgs/by-name', competencyController.getRequiredMGSByName.bind(competencyController));

// Get complete competency hierarchy with skills and subskills (must be before /:competencyId)
router.get('/:competencyId/complete-hierarchy', competencyController.getCompleteHierarchy.bind(competencyController));

// Get competency hierarchy (parent with children competencies only, no skills)
router.get('/:competencyId/hierarchy', competencyController.getCompetencyHierarchy.bind(competencyController));

// Get skills directly linked to a competency (child skills)
router.get('/:competencyId/skills', competencyController.getLinkedSkills.bind(competencyController));

// Get required MGS for competency by ID
router.get('/:competencyId/mgs', competencyController.getRequiredMGS.bind(competencyController));

// Get competency by ID
router.get('/:competencyId', competencyController.getCompetencyById.bind(competencyController));

// Create competency
router.post('/', competencyController.createCompetency.bind(competencyController));

// Update competency
router.put('/:competencyId', competencyController.updateCompetency.bind(competencyController));

// Delete competency
router.delete('/:competencyId', competencyController.deleteCompetency.bind(competencyController));

module.exports = router;


