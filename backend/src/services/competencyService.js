/**
 * Competency Service
 * 
 * Business logic layer for competency structure management.
 * Handles competency operations, skill mappings, MGS aggregation, and career path hierarchies.
 */

const competencyRepository = require('../repositories/competencyRepository');
const skillRepository = require('../repositories/skillRepository');
const aiService = require('./aiService');
const Competency = require('../models/Competency');

class CompetencyService {
  /**
   * Create a new competency with parent validation
   * @param {Object} competencyData - Competency data
   * @returns {Promise<Competency>}
   */
  async createCompetency(competencyData) {
    const competency = new Competency(competencyData);

    // Validate competency data
    const validation = competency.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // If parent is specified, validate it exists
    if (competency.parent_competency_id) {
      const parent = await competencyRepository.findById(competency.parent_competency_id);
      if (!parent) {
        throw new Error(`Parent competency with ID ${competency.parent_competency_id} not found`);
      }

      // Check if parent already has a parent (2-layer max)
      if (parent.parent_competency_id) {
        throw new Error('Cannot create child competency: maximum hierarchy depth (2 layers) exceeded');
      }
    }

    return await competencyRepository.create(competency);
  }

  /**
   * Add a child competency to a parent
   * @param {string} parentCompetencyId - Parent competency ID
   * @param {Object} childCompetencyData - Child competency data
   * @returns {Promise<Competency>}
   */
  async addChildCompetency(parentCompetencyId, childCompetencyData) {
    // Validate parent exists and is a parent (not a child)
    const parent = await competencyRepository.findById(parentCompetencyId);
    if (!parent) {
      throw new Error(`Parent competency with ID ${parentCompetencyId} not found`);
    }

    if (parent.parent_competency_id) {
      throw new Error(`Competency ${parentCompetencyId} is already a child competency. Cannot add children to child competencies.`);
    }

    // Set parent relationship
    childCompetencyData.parent_competency_id = parentCompetencyId;

    return await this.createCompetency(childCompetencyData);
  }

  /**
   * Link L1 skills to a competency
   * @param {string} competencyId - Competency ID
   * @param {string[]} skillIds - Array of L1 skill IDs
   * @returns {Promise<boolean>}
   */
  async linkSkills(competencyId, skillIds) {
    const competency = await competencyRepository.findById(competencyId);
    if (!competency) {
      throw new Error(`Competency with ID ${competencyId} not found`);
    }

    // Validate all skills exist and are L1 (root) skills
    for (const skillId of skillIds) {
      const skill = await skillRepository.findById(skillId);
      if (!skill) {
        throw new Error(`Skill with ID ${skillId} not found`);
      }

      if (!skill.isRoot()) {
        throw new Error(`Skill ${skillId} is not a root (L1) skill. Only L1 skills can be linked to competencies.`);
      }

      await competencyRepository.linkSkill(competencyId, skillId);
    }

    return true;
  }

  /**
   * Get all skills directly linked to a competency
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Array>}
   */
  async getLinkedSkills(competencyId) {
    const competency = await competencyRepository.findById(competencyId);
    if (!competency) {
      throw new Error(`Competency with ID ${competencyId} not found`);
    }

    const linked = await competencyRepository.getLinkedSkills(competencyId);
    return linked.map(skill => (skill.toJSON ? skill.toJSON() : skill));
  }

  /**
   * Unlink a skill from a competency
   * @param {string} competencyId - Competency ID
   * @param {string} skillId - Skill ID
   * @returns {Promise<boolean>}
   */
  async unlinkSkill(competencyId, skillId) {
    return await competencyRepository.unlinkSkill(competencyId, skillId);
  }

  /**
   * Get all MGS (Most Granular Skills) required for a competency
   * Aggregates MGS from all linked skills and child competencies
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Array>} Array of MGS skill objects
   */
  async getRequiredMGS(competencyId) {
    const competency = await competencyRepository.findById(competencyId);
    if (!competency) {
      throw new Error(`Competency with ID ${competencyId} not found`);
    }

    const allMGS = new Set();

    // Get MGS from child competencies (if any)
    const children = await competencyRepository.findChildren(competencyId);
    for (const child of children) {
      const childMGS = await this.getRequiredMGS(child.competency_id);
      childMGS.forEach(mgs => allMGS.add(mgs.skill_id));
    }

    // Get linked L1 skills
    const linkedSkills = await competencyRepository.getLinkedSkills(competencyId);

    // For each L1 skill, get all MGS
    for (const skill of linkedSkills) {
      const mgs = await skillRepository.findMGS(skill.skill_id);
      mgs.forEach(m => allMGS.add(m.skill_id));
    }

    // Return full MGS objects
    const mgsArray = [];
    for (const mgsId of allMGS) {
      const mgsSkill = await skillRepository.findById(mgsId);
      if (mgsSkill) {
        mgsArray.push(mgsSkill.toJSON());
      }
    }

    return mgsArray;
  }

  /**
   * Get all required MGS for a competency by its name (case-insensitive exact match)
   * Convenience wrapper used by external microservices that send competency_name only.
   * @param {string} competencyName - Competency name
   * @returns {Promise<Array>} Array of MGS skill objects
   */
  async getRequiredMGSByName(competencyName) {
    if (!competencyName || typeof competencyName !== 'string') {
      throw new Error('competency_name is required and must be a string');
    }

    const competency = await competencyRepository.findByName(competencyName);
    if (!competency) {
      throw new Error(`Competency with name "${competencyName}" not found`);
    }

    return this.getRequiredMGS(competency.competency_id);
  }

  /**
   * Count total MGS required for a competency
   * @param {string} competencyId - Competency ID
   * @returns {Promise<number>}
   */
  async countRequiredMGS(competencyId) {
    const mgs = await this.getRequiredMGS(competencyId);
    return mgs.length;
  }

  /**
   * Get competency hierarchy with linked skills
   * @param {string} parentCompetencyId - Parent competency ID
   * @returns {Promise<Object>}
   */
  async getCompetencyHierarchy(parentCompetencyId) {
    const hierarchy = await competencyRepository.getHierarchy(parentCompetencyId);
    if (!hierarchy) {
      return null;
    }

    // Add linked skills to parent
    const linkedSkills = await competencyRepository.getLinkedSkills(parentCompetencyId);
    hierarchy.linkedSkills = linkedSkills;

    // Add linked skills to children
    if (hierarchy.children && hierarchy.children.length > 0) {
      for (const child of hierarchy.children) {
        const childSkills = await competencyRepository.getLinkedSkills(child.competency_id);
        child.linkedSkills = childSkills;
      }
    }

    return hierarchy;
  }

  /**
   * Get complete competency hierarchy with skills and subskills
   * Returns: Competencies → Sub-competencies → Skills → Subskills
   * @param {string} parentCompetencyId - Parent competency ID
   * @returns {Promise<Object>}
   */
  async getCompleteHierarchy(parentCompetencyId) {
    const hierarchy = await competencyRepository.getHierarchy(parentCompetencyId);
    if (!hierarchy) {
      return null;
    }

    // Helper function to get skill tree with all subskills
    const getSkillWithSubskills = async (skillId) => {
      const skillTree = await skillRepository.traverseHierarchy(skillId);
      return skillTree;
    };

    // Add linked skills with their subskills to parent competency
    const linkedSkills = await competencyRepository.getLinkedSkills(parentCompetencyId);
    hierarchy.skills = await Promise.all(
      linkedSkills.map(skill => getSkillWithSubskills(skill.skill_id))
    );

    // Add linked skills with their subskills to each sub-competency
    if (hierarchy.children && hierarchy.children.length > 0) {
      for (const child of hierarchy.children) {
        const childSkills = await competencyRepository.getLinkedSkills(child.competency_id);
        child.skills = await Promise.all(
          childSkills.map(skill => getSkillWithSubskills(skill.skill_id))
        );
      }
    }

    return hierarchy;
  }

  /**
   * Update a competency
   * @param {string} competencyId - Competency ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Competency|null>}
   */
  async updateCompetency(competencyId, updates) {
    const competency = await competencyRepository.findById(competencyId);
    if (!competency) {
      throw new Error(`Competency with ID ${competencyId} not found`);
    }

    // If updating parent, validate hierarchy depth
    if (updates.parent_competency_id !== undefined) {
      if (updates.parent_competency_id) {
        const newParent = await competencyRepository.findById(updates.parent_competency_id);
        if (!newParent) {
          throw new Error(`New parent competency with ID ${updates.parent_competency_id} not found`);
        }

        if (newParent.parent_competency_id) {
          throw new Error('Cannot set parent: maximum hierarchy depth (2 layers) exceeded');
        }
      }
    }

    return await competencyRepository.update(competencyId, updates);
  }

  /**
   * Delete a competency (cascade deletes children and skill links)
   * @param {string} competencyId - Competency ID
   * @returns {Promise<boolean>}
   */
  async deleteCompetency(competencyId) {
    const competency = await competencyRepository.findById(competencyId);
    if (!competency) {
      throw new Error(`Competency with ID ${competencyId} not found`);
    }

    // Cascade delete is handled by database foreign key constraints
    return await competencyRepository.delete(competencyId);
  }

  /**
   * Get all parent competencies
   * @returns {Promise<Competency[]>}
   */
  async getParentCompetencies() {
    return await competencyRepository.findParentCompetencies();
  }

  /**
   * Search competencies by name
   * @param {string} pattern - Search pattern
   * @param {Object} options - Search options
   * @returns {Promise<Competency[]>}
   */
  async searchCompetencies(pattern, options = {}) {
    return await competencyRepository.searchByName(pattern, options);
  }

  /**
   * Get all competencies that require a specific skill
   * @param {string} skillId - Skill ID
   * @returns {Promise<Competency[]>}
   */
  async getCompetenciesBySkill(skillId) {
    return await competencyRepository.findBySkill(skillId);
  }

  /**
   * Get competency by ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Competency|null>}
   */
  async getCompetencyById(competencyId) {
    return await competencyRepository.findById(competencyId);
  }

  /**
   * Get competency by name (case-insensitive exact match)
   * @param {string} competencyName - Competency name
   * @returns {Promise<Competency|null>}
   */
  async getCompetencyByName(competencyName) {
    if (!competencyName || typeof competencyName !== 'string') {
      throw new Error('competency_name is required and must be a string');
    }

    return await competencyRepository.findByName(competencyName);
  }

  /**
   * Get all competencies
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Competency[]>}
   */
  async getAllCompetencies(options = {}) {
    return await competencyRepository.findAll(options);
  }

  /**
   * Build and persist competency hierarchy from career path
   * @param {string} careerPath - Career path name (e.g., "Backend Development")
   * @returns {Promise<Object>} Statistics about created/updated competencies
   */
  async buildHierarchyFromCareerPath(careerPath) {
    console.log(`[CompetencyService] Building hierarchy for career path: ${careerPath}`);

    // Step 1: Generate hierarchy tree from AI
    const hierarchyTree = await aiService.generateCompetencyHierarchy(careerPath);
    console.log('[CompetencyService] Generated hierarchy tree:', JSON.stringify(hierarchyTree, null, 2));

    // Step 2: Extract all nodes from tree
    const nodes = this.extractNodesFromTree(hierarchyTree);
    console.log(`[CompetencyService] Extracted ${nodes.length} nodes from tree`);

    // Step 3: Process and persist nodes
    const stats = await this.persistHierarchy(nodes);
    console.log('[CompetencyService] Persistence complete:', stats);

    return stats;
  }

  /**
   * Extract all nodes from hierarchy tree (flatten tree structure)
   * @param {Object} tree - Hierarchy tree from AI
   * @param {string|null} parentId - Parent competency ID (for recursive calls)
   * @returns {Array} Array of node objects with parent-child relationships
   */
  extractNodesFromTree(tree, parentId = null) {
    const nodes = [];

    if (!tree || !tree.competency) {
      return nodes;
    }

    // Add current node
    const currentNode = {
      name: tree.competency,
      parentId: parentId,
      isCoreCompetency: tree['core-competency'] === true,
      children: []
    };

    nodes.push(currentNode);

    // Recursively process subcompetencies
    if (tree.subcompetencies && Array.isArray(tree.subcompetencies)) {
      for (const subComp of tree.subcompetencies) {
        // We'll set the parent reference after we know the current node's DB ID
        const childNodes = this.extractNodesFromTree(subComp, tree.competency);
        nodes.push(...childNodes);
      }
    }

    return nodes;
  }

  /**
   * Persist hierarchy nodes to database
   * @param {Array} nodes - Array of node objects
   * @returns {Promise<Object>} Statistics
   */
  async persistHierarchy(nodes) {
    const stats = {
      competenciesCreated: 0,
      competenciesExisting: 0,
      relationshipsCreated: 0,
      relationshipsExisting: 0
    };

    // Map to store competency name -> competency_id
    const competencyIdMap = new Map();

    // Step 1: Create/find all competencies first (without parent relationships)
    for (const node of nodes) {
      const existingComp = await competencyRepository.findByName(node.name);

      if (existingComp) {
        // Competency already exists
        competencyIdMap.set(node.name, existingComp.competency_id);
        stats.competenciesExisting++;
        console.log(`[CompetencyService] Found existing competency: ${node.name} (${existingComp.competency_id})`);
      } else {
        // Create new competency
        const newComp = await competencyRepository.create(
          new Competency({
            competency_name: node.name,
            description: node.isCoreCompetency ? 'Core competency (high-level skill)' : null,
            parent_competency_id: null, // Will be set later via junction table
            source: 'career_path_ai'
          })
        );
        competencyIdMap.set(node.name, newComp.competency_id);
        stats.competenciesCreated++;
        console.log(`[CompetencyService] Created new competency: ${node.name} (${newComp.competency_id})`);
      }
    }

    // Step 2: Create parent-child relationships in competency_subcompetency table
    for (const node of nodes) {
      if (!node.parentId) {
        // Root node, no parent relationship
        continue;
      }

      const parentCompId = competencyIdMap.get(node.parentId);
      const childCompId = competencyIdMap.get(node.name);

      if (!parentCompId || !childCompId) {
        console.warn(`[CompetencyService] Missing ID for relationship: ${node.parentId} -> ${node.name}`);
        continue;
      }

      // Check if relationship already exists
      const existingLinks = await competencyRepository.getSubCompetencyLinks(parentCompId);
      const alreadyLinked = existingLinks.some(link => link.competency_id === childCompId);

      if (alreadyLinked) {
        stats.relationshipsExisting++;
        console.log(`[CompetencyService] Relationship already exists: ${node.parentId} -> ${node.name}`);
      } else {
        // Create new relationship
        await competencyRepository.linkSubCompetency(parentCompId, childCompId);
        stats.relationshipsCreated++;
        console.log(`[CompetencyService] Created relationship: ${node.parentId} -> ${node.name}`);
      }
    }

    return stats;
  }

  /**
   * Validate hierarchy tree structure
   * @param {Object} tree - Hierarchy tree
   * @returns {boolean}
   */
  validateHierarchyTree(tree) {
    if (!tree || typeof tree !== 'object') {
      return false;
    }

    if (!tree.competency || typeof tree.competency !== 'string') {
      return false;
    }

    // If it has subcompetencies, validate them recursively
    if (tree.subcompetencies) {
      if (!Array.isArray(tree.subcompetencies)) {
        return false;
      }

      for (const subComp of tree.subcompetencies) {
        if (!this.validateHierarchyTree(subComp)) {
          return false;
        }
      }
    }

    // Core competencies should not have subcompetencies
    if (tree['core-competency'] === true && tree.subcompetencies && tree.subcompetencies.length > 0) {
      return false;
    }

    return true;
  }
}

module.exports = new CompetencyService();

