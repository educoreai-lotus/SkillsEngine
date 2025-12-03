/**
 * Competency Hierarchy Service
 * 
 * Processes and persists competency hierarchy trees generated from career paths.
 * Handles recursive tree traversal, competency creation, and relationship mapping.
 */

const aiService = require('./aiService');
const competencyRepository = require('../repositories/competencyRepository');
const Competency = require('../models/Competency');

class CompetencyHierarchyService {
  /**
   * Build and persist competency hierarchy from career path
   * @param {string} careerPath - Career path name (e.g., "Backend Development")
   * @returns {Promise<Object>} Statistics about created/updated competencies
   */
  async buildFromCareerPath(careerPath) {
    console.log(`[CompetencyHierarchyService] Building hierarchy for career path: ${careerPath}`);

    // Step 1: Generate hierarchy tree from AI
    const hierarchyTree = await aiService.generateCompetencyHierarchy(careerPath);
    console.log('[CompetencyHierarchyService] Generated hierarchy tree:', JSON.stringify(hierarchyTree, null, 2));

    // Step 2: Extract all nodes from tree
    const nodes = this.extractNodes(hierarchyTree);
    console.log(`[CompetencyHierarchyService] Extracted ${nodes.length} nodes from tree`);

    // Step 3: Process and persist nodes
    const stats = await this.persistHierarchy(nodes);
    console.log('[CompetencyHierarchyService] Persistence complete:', stats);

    return stats;
  }

  /**
   * Extract all nodes from hierarchy tree (flatten tree structure)
   * @param {Object} tree - Hierarchy tree from AI
   * @param {string|null} parentId - Parent competency ID (for recursive calls)
   * @returns {Array} Array of node objects with parent-child relationships
   */
  extractNodes(tree, parentId = null) {
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
        const childNodes = this.extractNodes(subComp, tree.competency);
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
        console.log(`[CompetencyHierarchyService] Found existing competency: ${node.name} (${existingComp.competency_id})`);
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
        console.log(`[CompetencyHierarchyService] Created new competency: ${node.name} (${newComp.competency_id})`);
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
        console.warn(`[CompetencyHierarchyService] Missing ID for relationship: ${node.parentId} -> ${node.name}`);
        continue;
      }

      // Check if relationship already exists
      const existingLinks = await competencyRepository.getSubCompetencyLinks(parentCompId);
      const alreadyLinked = existingLinks.some(link => link.competency_id === childCompId);

      if (alreadyLinked) {
        stats.relationshipsExisting++;
        console.log(`[CompetencyHierarchyService] Relationship already exists: ${node.parentId} -> ${node.name}`);
      } else {
        // Create new relationship
        await competencyRepository.linkSubCompetency(parentCompId, childCompId);
        stats.relationshipsCreated++;
        console.log(`[CompetencyHierarchyService] Created relationship: ${node.parentId} -> ${node.name}`);
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

module.exports = new CompetencyHierarchyService();

