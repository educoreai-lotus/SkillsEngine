/**
 * User Service
 * 
 * Business logic layer for user profile management.
 * Handles user creation, profile updates, and initial profile delivery.
 */

const userRepository = require('../repositories/userRepository');
const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const userSkillRepository = require('../repositories/userSkillRepository');
const competencyRepository = require('../repositories/competencyRepository');
const skillRepository = require('../repositories/skillRepository');
const baselineExamService = require('./baselineExamService');
const User = require('../models/User');
const UserCompetency = require('../models/UserCompetency');
const UserSkill = require('../models/UserSkill');

class UserService {
  /**
   * Create basic user profile (Feature 2.1)
   * @param {Object} userData - User data from Directory MS
   * @returns {Promise<User>}
   */
  async createBasicProfile(userData) {
    const user = new User(userData);
    return await userRepository.upsert(user);
  }

  /**
   * Build initial competency profile for Directory MS (Feature 2.4)
   * Note: Skills are now treated as competencies - only competencies array is processed
   * @param {string} userId - User ID
   * @param {Object} normalizedData - Normalized data from Feature 2.3
   * @returns {Promise<Object>} Initial profile payload
   */
  async buildInitialProfile(userId, normalizedData) {
    // Look up user to get metadata (e.g., user_name) for downstream services
    let userForMetadata = null;
    try {
      userForMetadata = await userRepository.findById(userId);
    } catch (err) {
      // Non-fatal: continue without user metadata if lookup fails
      console.warn(
        '[UserService.buildInitialProfile] Failed to load user for metadata',
        { userId, error: err.message }
      );
    }

    // Step 1: Look up taxonomy IDs for competencies (includes both traditional competencies and skills)
    const competencyMappings = [];
    for (const comp of normalizedData.competencies || []) {
      let competencyId = comp.taxonomy_id || null;

      // If not found in taxonomy or taxonomy_id is missing, try to find/create by name
      if (!comp.found_in_taxonomy || !competencyId) {
        const existing = await competencyRepository.findByName(comp.normalized_name);
        if (existing) {
          competencyId = existing.competency_id;
        } else {
          // Create new competency if not exists (let DB generate UUID)
          const newComp = await competencyRepository.create(
            new (require('../models/Competency'))({
              competency_name: comp.normalized_name,
              description: comp.description || null,
              parent_competency_id: null,
              source: comp.source || 'ai'
            })
          );
          competencyId = newComp.competency_id;
        }
      }

      competencyMappings.push({
        original: comp,
        competency_id: competencyId
      });
    }

    // Step 2: Store competencies in user_competencies (includes both traditional competencies and skills)
    for (const mapping of competencyMappings) {
      const userComp = new UserCompetency({
        user_id: userId,
        competency_id: mapping.competency_id,
        coverage_percentage: 0.00,
        proficiency_level: 'undefined',
        verifiedSkills: []
      });
      await userCompetencyRepository.upsert(userComp);
    }

    // Step 3: Fetch stored user competencies
    const userCompetencies = await userCompetencyRepository.findByUser(userId);

    // Step 4-8: Build hierarchical competency payload.
    // Directory now receives ONLY competencies (no skills), in a hierarchy:
    // - Include high-level/core competencies
    // - Include all related sub-competencies that the user owns
    // - Hierarchy is based on competency_subcompetency (via getParentCompetencies)
    const nodes = new Map(); // competency_id -> node {competencyId, competencyName, level, coverage, parentId, children: []}

    // Helper to ensure we have a node for a competency_id (with name loaded once)
    const ensureNode = async (competencyId) => {
      if (!competencyId) return null;
      let node = nodes.get(competencyId);
      if (node) {
        return node;
      }

      const competency = await competencyRepository.findById(competencyId);
      if (!competency) {
        return null;
      }

      node = {
        competencyId: competency.competency_id,
        competencyName: competency.competency_name,
        level: 'undefined',
        coverage: 0,
        parentId: null,
        children: []
      };
      nodes.set(competencyId, node);
      return node;
    };

    // 4.1: Seed nodes with user-owned competencies (coverage/level from userCompetency)
    for (const userComp of userCompetencies) {
      if (!userComp) continue;

      const node = await ensureNode(userComp.competency_id);
      if (!node) continue;

      node.level = userComp.proficiency_level || 'undefined';
      node.coverage = userComp.coverage_percentage || 0;

      // 4.2: Walk up the competency_subcompetency chain and attach parents
      try {
        const parents = await competencyRepository.getParentCompetencies(userComp.competency_id);

        // parents[0] is the immediate parent, then its parent, etc.
        let childId = userComp.competency_id;
        for (const parent of parents) {
          const parentNode = await ensureNode(parent.competency_id);
          const childNode = await ensureNode(childId);

          if (parentNode && childNode && !childNode.parentId) {
            childNode.parentId = parentNode.competencyId;
          }

          childId = parent.competency_id;
        }
      } catch (err) {
        console.warn(
          '[UserService.buildInitialProfile] Failed to load parent competencies',
          { competency_id: userComp.competency_id, error: err.message }
        );
      }
    }

    // 4.3: Build children arrays based on parentId links
    for (const node of nodes.values()) {
      node.children = [];
    }
    for (const node of nodes.values()) {
      if (node.parentId) {
        const parentNode = nodes.get(node.parentId);
        if (parentNode) {
          parentNode.children.push(node);
        }
      }
    }

    // 4.4: Collect root competencies (no parentId) as top-level entries
    const roots = Array.from(nodes.values()).filter(node => !node.parentId);

    const serializeNode = (node) => {
      const base = {
        competencyId: node.competencyId,
        competencyName: node.competencyName,
        level: node.level,
        coverage: node.coverage
      };

      const childNodes = (node.children || []).map(serializeNode);
      if (childNodes.length > 0) {
        base.children = childNodes;
      }

      return base;
    };

    const competencies = roots.map(serializeNode);

    // Step 11: Build final payload
    const payload = {
      userId: userId,
      relevanceScore: 0,
      competencies: competencies
    };

    // Step 12: Send to Directory MS (with fallback to mock data)
    const directoryMSClient = require('./directoryMSClient');
    try {
      await directoryMSClient.sendInitialProfile(userId, payload);
    } catch (error) {
      // Fallback is handled by apiClient, but log if needed
      console.warn('Failed to send initial profile to Directory MS, using mock data:', error.message);
    }

    // After initial competency profile is built and sent to Directory MS,
    // automatically trigger a baseline exam request in Assessment MS.
    // This is fire-and-forget: failures are logged but do not block the response.
    const userName = userForMetadata?.user_name || null;
    const companyId = userForMetadata?.company_id || null;

    if (userName) {
      (async () => {
        try {
          await baselineExamService.requestBaselineExam(userId, userName, companyId);
        } catch (err) {
          console.warn(
            '[UserService.buildInitialProfile] Failed to request baseline exam',
            { userId, error: err.message }
          );
        }
      })();
    } else {
      console.warn(
        '[UserService.buildInitialProfile] Skipping baseline exam request (missing user_name)',
        { userId }
      );
    }

    return payload;
  }

  /**
   * Get user profile with competencies and skills
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return {
      user: user.toJSON()
    };
  }

  /**
   * Get full user profile with competencies and skills
   * (used internally by analytics handlers)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getFullUserProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const userCompetencies = await userCompetencyRepository.findByUser(userId);
    const userSkills = await userSkillRepository.findByUser(userId);

    return {
      user: user.toJSON(),
      competencies: userCompetencies.map(uc => uc.toJSON()),
      skills: userSkills.map(us => us.toJSON())
    };
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<User>}
   */
  async updateUserProfile(userId, updates) {
    return await userRepository.update(userId, updates);
  }
}

module.exports = new UserService();


