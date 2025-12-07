/**
 * Competency Sub-Competency Controller
 *
 * Handles linking between parent and child competencies (competency_subcompetency table).
 */

const competencyRepository = require('../repositories/competencyRepository');

class CompetencySubCompetencyController {
  /**
   * Get all parent competencies
   * GET /api/competency-subcompetency/parents
   */
  async getAllParents(req, res) {
    try {
      const parents = await competencyRepository.findParentCompetencies();
      const data = parents.map(parent => (parent.toJSON ? parent.toJSON() : parent));
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get direct sub-competencies of a parent
   * GET /api/competency-subcompetency/:parentCompetencyId
   */
  async getSubCompetencies(req, res) {
    try {
      const { parentCompetencyId } = req.params;
      const parent = await competencyRepository.findById(parentCompetencyId);

      if (!parent) {
        return res.status(404).json({ success: false, error: 'Parent competency not found' });
      }

      const children = await competencyRepository.getSubCompetencyLinks(parentCompetencyId);
      const data = children.map(child => (child.toJSON ? child.toJSON() : child));

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Link a child competency to a parent
   * POST /api/competency-subcompetency/:parentCompetencyId
   */
  async addSubCompetency(req, res) {
    try {
      const { parentCompetencyId } = req.params;
      const { child_competency_id: childCompetencyId } = req.body;

      if (!childCompetencyId) {
        return res.status(400).json({ success: false, error: 'child_competency_id is required' });
      }

      if (parentCompetencyId === childCompetencyId) {
        return res.status(400).json({ success: false, error: 'Cannot link competency to itself' });
      }

      const parent = await competencyRepository.findById(parentCompetencyId);
      if (!parent) {
        return res.status(404).json({ success: false, error: 'Parent competency not found' });
      }

      const child = await competencyRepository.findById(childCompetencyId);
      if (!child) {
        return res.status(404).json({ success: false, error: 'Child competency not found' });
      }

      await competencyRepository.linkSubCompetency(parentCompetencyId, childCompetencyId);
      const updated = await competencyRepository.getSubCompetencyLinks(parentCompetencyId);
      const data = updated.map(item => (item.toJSON ? item.toJSON() : item));

      res.json({
        success: true,
        message: 'Sub-competency linked successfully',
        data,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Remove child competency link
   * DELETE /api/competency-subcompetency/:parentCompetencyId
   * Body: { child_competency_id: "string" }
   */
  async removeSubCompetency(req, res) {
    try {
      const { parentCompetencyId } = req.params;
      const { child_competency_id: childCompetencyId } = req.body;

      if (!childCompetencyId) {
        return res.status(400).json({ success: false, error: 'child_competency_id is required in body' });
      }

      const parent = await competencyRepository.findById(parentCompetencyId);
      if (!parent) {
        return res.status(404).json({ success: false, error: 'Parent competency not found' });
      }

      const child = await competencyRepository.findById(childCompetencyId);
      if (!child) {
        return res.status(404).json({ success: false, error: 'Child competency not found' });
      }

      const removed = await competencyRepository.unlinkSubCompetency(parentCompetencyId, childCompetencyId);
      if (!removed) {
        return res.status(404).json({ success: false, error: 'Link not found' });
      }

      res.json({ success: true, message: 'Sub-competency unlinked successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new CompetencySubCompetencyController();


