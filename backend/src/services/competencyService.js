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
const Skill = require('../models/Skill');
const crypto = require('crypto');

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
   * Note: This method does NOT auto-generate skill trees. Use generateAndLinkSkillTree() explicitly if needed.
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
    for (const skill of linkedSkills || []) {
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
   * Generate and link skill tree for a last-level competency
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Object>} Stats about created skills
   */
  async generateAndLinkSkillTree(competencyId) {
    const competency = await competencyRepository.findById(competencyId);
    if (!competency) {
      throw new Error(`Competency with ID ${competencyId} not found`);
    }

    // Check if competency is a leaf node (no children)
    const children = await competencyRepository.findChildren(competencyId);
    if (children && children.length > 0) {
      console.log(`[CompetencyService.generateAndLinkSkillTree] Competency ${competencyId} has children; skipping skill tree generation`);
      return { skillsCreated: 0, skillsLinked: 0 };
    }

    // Check if competency already has skills linked
    const linkedSkills = await competencyRepository.getLinkedSkills(competencyId);
    if (linkedSkills && linkedSkills.length > 0) {
      console.log(`[CompetencyService.generateAndLinkSkillTree] Competency ${competencyId} already has skills linked; skipping skill tree generation`);
      return { skillsCreated: 0, skillsLinked: 0 };
    }

    // Generate skill tree using AI
    console.log(`[CompetencyService.generateAndLinkSkillTree] Generating skill tree for competency: ${competency.competency_name}`);
    const skillTree = await aiService.generateSkillTreeForCompetency(competency.competency_name);

    // Validate skill tree structure
    if (!skillTree || typeof skillTree !== 'object') {
      console.warn(`[CompetencyService.generateAndLinkSkillTree] Invalid skill tree: not an object for competency ${competencyId}`);
      return { skillsCreated: 0, skillsLinked: 0 };
    }

    if (!skillTree.Skills || !Array.isArray(skillTree.Skills)) {
      console.warn(`[CompetencyService.generateAndLinkSkillTree] Invalid skill tree structure: missing or invalid Skills array for competency ${competencyId}`);
      // Log structure for debugging without full JSON dump
      const keys = skillTree ? Object.keys(skillTree) : [];
      console.warn(`[CompetencyService.generateAndLinkSkillTree] Skill tree keys:`, keys.join(', '));
      return { skillsCreated: 0, skillsLinked: 0 };
    }

    const stats = { skillsCreated: 0, skillsLinked: 0 };

    // Process each skill (L2 level) from the tree
    for (const skillNode of skillTree.Skills) {
      // Skip null, undefined, or empty objects
      if (!skillNode || (typeof skillNode === 'object' && Object.keys(skillNode).length === 0)) {
        console.warn(`[CompetencyService.generateAndLinkSkillTree] Skipping invalid skill node:`, skillNode);
        continue;
      }

      const skillName = typeof skillNode === 'string' ? skillNode : (skillNode && skillNode.name || '');
      if (!skillName || typeof skillName !== 'string') {
        console.warn(`[CompetencyService.generateAndLinkSkillTree] Skipping skill node with invalid name:`, skillNode);
        continue;
      }

      // Check if skill already exists
      let skill = await skillRepository.findByName(skillName.toLowerCase().trim());

      if (!skill) {
        // Create L2 skill
        const skillModel = new Skill({
          skill_id: crypto.randomUUID(),
          skill_name: skillName,
          parent_skill_id: null, // L2 skills have no parent
          description: typeof skillNode === 'object' ? skillNode.description : null,
          source: 'ai_generated'
        });
        skill = await skillRepository.create(skillModel);
        stats.skillsCreated++;
      }

      // Link L2 skill to competency
      try {
        await competencyRepository.linkSkill(competencyId, skill.skill_id);
        stats.skillsLinked++;
      } catch (err) {
        console.warn(`[CompetencyService.generateAndLinkSkillTree] Failed to link skill ${skill.skill_id} to competency ${competencyId}:`, err.message);
      }

      // Process subskills recursively
      if (typeof skillNode === 'object' && skillNode.Subskills) {
        await this._processSkillHierarchy(skillNode.Subskills, skill.skill_id, stats);
      }
    }

    console.log(`[CompetencyService.generateAndLinkSkillTree] Completed for competency ${competencyId}:`, stats);
    return stats;
  }

  /**
   * Internal helper: process skill hierarchy recursively
   * @param {Array} skillNodes - Array of skill nodes
   * @param {string} parentSkillId - Parent skill ID
   * @param {Object} stats - Stats object to update
   * @returns {Promise<void>}
   */
  async _processSkillHierarchy(skillNodes, parentSkillId, stats) {
    if (!Array.isArray(skillNodes)) {
      console.warn(`[CompetencyService._processSkillHierarchy] Expected array, got:`, typeof skillNodes);
      return;
    }

    for (const node of skillNodes) {
      // Skip null, undefined, or empty objects
      if (!node || (typeof node === 'object' && Object.keys(node).length === 0)) {
        console.warn(`[CompetencyService._processSkillHierarchy] Skipping invalid node:`, node);
        continue;
      }

      const nodeName = typeof node === 'string' ? node : (node && node.name || '');
      if (!nodeName || typeof nodeName !== 'string') {
        console.warn(`[CompetencyService._processSkillHierarchy] Skipping node with invalid name:`, node);
        continue;
      }

      // Check if skill already exists
      let skill = await skillRepository.findByName(nodeName.toLowerCase().trim());

      if (!skill) {
        // Create skill
        const skillModel = new Skill({
          skill_id: crypto.randomUUID(),
          skill_name: nodeName,
          parent_skill_id: parentSkillId,
          description: typeof node === 'object' ? node.description : null,
          source: 'ai_generated'
        });
        skill = await skillRepository.create(skillModel);
        stats.skillsCreated++;
      }

      // Link to parent in skill_subskill table
      if (parentSkillId) {
        try {
          await skillRepository.linkSubSkill(parentSkillId, skill.skill_id);
        } catch (err) {
          // Ignore duplicate link errors
          if (!err.message.includes('duplicate') && !err.message.includes('unique')) {
            console.warn(`[CompetencyService._processSkillHierarchy] Failed to link subskill:`, err.message);
          }
        }
      }

      // Process children recursively
      const obj = typeof node === 'object' ? node : {};
      const childKeys = ['Subskills', 'Microskills', 'Nanoskills'];
      for (const key of childKeys) {
        if (Array.isArray(obj[key])) {
          await this._processSkillHierarchy(obj[key], skill.skill_id, stats);
        }
      }
    }
  }

  /**
   * Get all required MGS for a competency by its name (case-insensitive exact match)
   * Convenience wrapper used by external microservices that send competency_name only.
   * If the competency doesn't exist, it will be created automatically as a core-competency
   * and a skill tree will be generated for it.
   * @param {string} competencyName - Competency name
   * @returns {Promise<Array>} Array of MGS skill objects
   */
  async getRequiredMGSByName(competencyName) {
    if (!competencyName || typeof competencyName !== 'string') {
      throw new Error('competency_name is required and must be a string');
    }

    let competency = await competencyRepository.findByName(competencyName);

    // If competency doesn't exist, check for semantic duplicates (including aliases) before creating
    if (!competency) {
      console.log(`[CompetencyService.getRequiredMGSByName] Competency "${competencyName}" not found; checking for semantic duplicates`);

      try {
        // Use createCompetencyWithAlias to check for semantic duplicates first
        // This will find existing competencies via aliases or similar names
        competency = await this.createCompetencyWithAlias({
          competency_name: competencyName,
          description: `Core competency: ${competencyName}`,
          parent_competency_id: null, // Core-competency (no parent)
          source: 'auto_created'
        });

        if (competency.competency_name.toLowerCase().trim() !== competencyName.toLowerCase().trim()) {
          // Found existing competency via alias/semantic duplicate
          console.log(`[CompetencyService.getRequiredMGSByName] Found existing competency via alias/semantic match: ${competency.competency_name} (${competency.competency_id})`);
        } else {
          // Created new competency
          console.log(`[CompetencyService.getRequiredMGSByName] Created new competency: ${competency.competency_id} (${competency.competency_name})`);
        }
      } catch (err) {
        console.error(`[CompetencyService.getRequiredMGSByName] Failed to create/find competency "${competencyName}":`, err.message);
        throw new Error(`Failed to create/find competency "${competencyName}": ${err.message}`);
      }
    }

    // Check if it's a leaf node with no skills, then generate skill tree
    const children = await competencyRepository.findChildren(competency.competency_id);
    const linkedSkills = await competencyRepository.getLinkedSkills(competency.competency_id);

    // If no skills linked and this is a leaf node, generate skill tree
    if ((!linkedSkills || linkedSkills.length === 0) && (!children || children.length === 0)) {
      console.log(`[CompetencyService.getRequiredMGSByName] Leaf competency ${competency.competency_id} has no skills; generating skill tree`);
      try {
        await this.generateAndLinkSkillTree(competency.competency_id);
      } catch (err) {
        console.error(`[CompetencyService.getRequiredMGSByName] Failed to generate skill tree for competency ${competency.competency_id}:`, err.message);
      }
    }

    // Get MGS
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
   * For MGS (leaf skills), we traverse up the skill hierarchy to find
   * any ancestor skills that are linked to competencies via competency_skill.
   * The L2 → L3 → L4 relations are stored in the skill_subSkill junction table,
   * which is accessed via SkillRepository.findParent().
   * @param {string} skillId - Skill ID (can be MGS or any level)
   * @returns {Promise<Competency[]>}
   */
  async getCompetenciesBySkill(skillId) {
    if (!skillId) {
      return [];
    }

    const visitedSkillIds = new Set();
    const competencyMap = new Map(); // competency_id -> Competency

    let currentSkillId = skillId;

    // Traverse up the skill hierarchy: MGS -> parent skill -> L1 skill
    // At each level, find competencies linked to that skill via competency_skill.
    while (currentSkillId && !visitedSkillIds.has(currentSkillId)) {
      visitedSkillIds.add(currentSkillId);

      // 1. Find competencies directly linked to this skill_id
      try {
        const comps = await competencyRepository.findBySkill(currentSkillId);
        for (const comp of comps) {
          competencyMap.set(comp.competency_id, comp);
        }
      } catch (error) {
        console.error(
          '[CompetencyService.getCompetenciesBySkill] Error finding competencies for skill',
          { skillId: currentSkillId, error: error.message }
        );
        // If this level fails, try the parent skill (if any)
      }

      // 2. Move up to parent skill (uses skill_subSkill via SkillRepository.findParent)
      try {
        const parentSkill = await skillRepository.findParent(currentSkillId);
        if (!parentSkill) {
          break; // Reached top of skill hierarchy
        }
        currentSkillId = parentSkill.skill_id;
      } catch (error) {
        console.error(
          '[CompetencyService.getCompetenciesBySkill] Error loading skill parent',
          { skillId: currentSkillId, error: error.message }
        );
        break;
      }
    }

    return Array.from(competencyMap.values());
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
    // Reduced logging - only log structure summary to prevent rate limits
    if (hierarchyTree && typeof hierarchyTree === 'object') {
      const keys = Object.keys(hierarchyTree);
      console.log('[CompetencyService] Generated hierarchy tree structure:', keys.length > 0 ? keys.join(', ') : 'empty');
    } else {
      console.warn('[CompetencyService] Generated hierarchy tree is not an object');
    }

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
   * Note: This method only creates competencies and relationships. It does NOT generate skill trees.
   * Skill tree generation is handled separately when getRequiredMGS is called (and only if skipAutoGenerate is false).
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

    // Step 1: Create/find all competencies first (and set parent_competency_id where possible)
    for (const node of nodes) {
      const existingComp = await competencyRepository.findByName(node.name);

      if (existingComp) {
        // Competency already exists
        competencyIdMap.set(node.name, existingComp.competency_id);
        stats.competenciesExisting++;
        console.log(`[CompetencyService] Found existing competency: ${node.name} (${existingComp.competency_id})`);
      } else {
        // Resolve parent_competency_id by name if parent already processed
        let parentCompetencyId = null;
        if (node.parentId) {
          parentCompetencyId = competencyIdMap.get(node.parentId) || null;
        }

        // Create new competency
        const newComp = await competencyRepository.create(
          new Competency({
            competency_name: node.name,
            description: node.isCoreCompetency ? 'Core competency (high-level skill)' : null,
            // Also store parent in the competencies table hierarchy
            parent_competency_id: parentCompetencyId,
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

  /**
   * Detect and merge semantic duplicates (e.g., "react", "reactjs", "react js")
   * Uses fuzzy matching and common synonym patterns
   * @param {string} competencyName - Competency name to check
   * @returns {Promise<Competency|null>} Existing competency if found, null otherwise
   */
  async findSemanticDuplicate(competencyName) {
    if (!competencyName || typeof competencyName !== 'string') {
      return null;
    }

    const normalized = competencyName.toLowerCase().trim();

    // Remove common separators and normalize
    const normalizedForMatch = normalized
      .replace(/[._-]/g, ' ')  // Replace dots, underscores, dashes with spaces
      .replace(/\s+/g, ' ')     // Collapse multiple spaces
      .trim();

    // Try exact match first
    let existing = await competencyRepository.findByName(normalized);
    if (existing) return existing;

    // Try normalized version (without separators)
    existing = await competencyRepository.findByName(normalizedForMatch);
    if (existing) {
      // Add the original as an alias
      await competencyRepository.addAlias(existing.competency_id, normalized);
      return existing;
    }

    // Search for similar names using pattern matching
    const client = competencyRepository.getClient();
    const { data: similar, error } = await client
      .from('competencies')
      .select('*')
      .or(`competency_name.ilike.%${normalizedForMatch}%,competency_name.ilike.%${normalized}%`)
      .limit(10);

    if (error || !similar || similar.length === 0) {
      return null;
    }

    // Find the best match using simple similarity
    let bestMatch = null;
    let bestScore = 0;

    for (const comp of similar) {
      const compName = comp.competency_name.toLowerCase().trim();
      const compNormalized = compName.replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();

      // Calculate similarity score
      let score = 0;
      if (compNormalized === normalizedForMatch) {
        score = 100; // Exact match after normalization
      } else if (compNormalized.includes(normalizedForMatch) || normalizedForMatch.includes(compNormalized)) {
        score = 80; // One contains the other
      } else {
        // Simple character overlap
        const set1 = new Set(normalizedForMatch.split(''));
        const set2 = new Set(compNormalized.split(''));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        score = (intersection.size / Math.max(set1.size, set2.size)) * 60;
      }

      if (score > bestScore && score >= 80) {
        bestScore = score;
        bestMatch = comp;
      }
    }

    if (bestMatch) {
      // Add as alias
      await competencyRepository.addAlias(bestMatch.competency_id, normalized);
      return new (require('../models/Competency'))(bestMatch);
    }

    return null;
  }

  /**
   * Create competency with alias support
   * Checks for semantic duplicates before creating
   * @param {Object} competencyData - Competency data
   * @returns {Promise<Competency>}
   */
  async createCompetencyWithAlias(competencyData) {
    // First check for semantic duplicates
    const existing = await this.findSemanticDuplicate(competencyData.competency_name);
    if (existing) {
      // Add the new name as an alias if it's different
      const normalized = (competencyData.competency_name || '').toLowerCase().trim();
      if (normalized !== existing.competency_name.toLowerCase().trim()) {
        await competencyRepository.addAlias(existing.competency_id, normalized);
      }
      return existing;
    }

    // No duplicate found, create new competency
    return this.createCompetency(competencyData);
  }
}

module.exports = new CompetencyService();

