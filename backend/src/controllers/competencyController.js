/**
 * Competency Controller
 * 
 * Handles HTTP requests for competency operations.
 */

const competencyService = require('../services/competencyService');

class CompetencyController {
  /**
   * Get all competencies
   * GET /api/competencies
   */
  async getAllCompetencies(req, res) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };
      const competencies = await competencyService.getAllCompetencies(options);
      res.json({ success: true, data: competencies, count: competencies.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get competency by ID
   * GET /api/competencies/:competencyId
   */
  async getCompetencyById(req, res) {
    try {
      const { competencyId } = req.params;
      const competency = await competencyService.getCompetencyById(competencyId);
      
      if (!competency) {
        return res.status(404).json({ success: false, error: 'Competency not found' });
      }

      res.json({ success: true, data: competency });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get competency by name
   * POST /api/competencies/by-name
   * Body: { competency_name: string }
   */
  async getCompetencyByName(req, res) {
    try {
      const { competency_name } = req.body;

      if (!competency_name || typeof competency_name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'competency_name is required and must be a string'
        });
      }

      const competency = await competencyService.getCompetencyByName(competency_name);

      if (!competency) {
        return res.status(404).json({
          success: false,
          error: 'Competency not found'
        });
      }

      res.json({ success: true, data: competency });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Create a new competency
   * POST /api/competencies
   */
  async createCompetency(req, res) {
    try {
      const competency = await competencyService.createCompetency(req.body);
      res.status(201).json({ success: true, data: competency });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Update a competency
   * PUT /api/competencies/:competencyId
   */
  async updateCompetency(req, res) {
    try {
      const { competencyId } = req.params;
      const competency = await competencyService.updateCompetency(competencyId, req.body);
      
      if (!competency) {
        return res.status(404).json({ success: false, error: 'Competency not found' });
      }

      res.json({ success: true, data: competency });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Delete a competency
   * DELETE /api/competencies/:competencyId
   */
  async deleteCompetency(req, res) {
    try {
      const { competencyId } = req.params;
      const deleted = await competencyService.deleteCompetency(competencyId);
      
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Competency not found' });
      }

      res.json({ success: true, message: 'Competency deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Get competency hierarchy
   * GET /api/competencies/:competencyId/hierarchy
   */
  async getCompetencyHierarchy(req, res) {
    try {
      const { competencyId } = req.params;
      const hierarchy = await competencyService.getCompetencyHierarchy(competencyId);

      if (!hierarchy) {
        return res.status(404).json({ success: false, error: 'Competency not found' });
      }

      res.json({ success: true, data: hierarchy });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get complete competency hierarchy with skills and subskills
   * GET /api/competencies/:competencyId/complete-hierarchy
   */
  async getCompleteHierarchy(req, res) {
    try {
      const { competencyId } = req.params;
      const hierarchy = await competencyService.getCompleteHierarchy(competencyId);

      if (!hierarchy) {
        return res.status(404).json({ success: false, error: 'Competency not found' });
      }

      res.json({ success: true, data: hierarchy });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Link skills to competency
   * POST /api/competencies/:competencyId/skills
   */
  async linkSkills(req, res) {
    try {
      const { competencyId } = req.params;
      const { skillIds } = req.body;

      if (!Array.isArray(skillIds)) {
        return res.status(400).json({ success: false, error: 'skillIds must be an array' });
      }

      await competencyService.linkSkills(competencyId, skillIds);
      res.json({ success: true, message: 'Skills linked successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Get skills linked to competency
    * GET /api/competencies/:competencyId/skills
   */
  async getLinkedSkills(req, res) {
    try {
      const { competencyId } = req.params;
      const skills = await competencyService.getLinkedSkills(competencyId);
      res.json({ success: true, data: skills });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get required MGS for competency
   * GET /api/competencies/:competencyId/mgs
   */
  async getRequiredMGS(req, res) {
    try {
      const { competencyId } = req.params;
      const mgs = await competencyService.getRequiredMGS(competencyId);
      res.json({ success: true, data: mgs, count: mgs.length });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Get required MGS for competency by name
   * POST /api/competencies/mgs/by-name
   * Body: { competency_name: string }
   */
  async getRequiredMGSByName(req, res) {
    try {
      const { competency_name } = req.body;

      if (!competency_name || typeof competency_name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'competency_name is required and must be a string'
        });
      }

      const mgs = await competencyService.getRequiredMGSByName(competency_name);
      res.json({ success: true, data: mgs, count: mgs.length });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Search competencies
   * GET /api/competencies/search?q=pattern
   */
  async searchCompetencies(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ success: false, error: 'Search query is required' });
      }

      const competencies = await competencyService.searchCompetencies(q, {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      });

      res.json({ success: true, data: competencies });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new CompetencyController();


