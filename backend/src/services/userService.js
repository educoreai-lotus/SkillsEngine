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
    console.log(
      '[UserService.buildInitialProfile] Start',
      JSON.stringify(
        {
          userId,
          competenciesCount: (normalizedData && Array.isArray(normalizedData.competencies))
            ? normalizedData.competencies.length
            : 0
        },
        null,
        2
      )
    );

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
    const inputCompetencies = normalizedData.competencies || [];
    for (let i = 0; i < inputCompetencies.length; i++) {
      const comp = inputCompetencies[i];
      if (i === 0 || (i + 1) % 25 === 0) {
        console.log(
          '[UserService.buildInitialProfile] Processing normalized competency',
          { index: i, total: inputCompetencies.length, name: comp.normalized_name || comp.name || null }
        );
      }
      let competencyId = comp.taxonomy_id || null;

      // If not found in taxonomy or taxonomy_id is missing, try to find/create by name
      if (!comp.found_in_taxonomy || !competencyId) {
        // First try exact match (includes alias lookup)
        let existing = await competencyRepository.findByName(comp.normalized_name);

        // If not found, try semantic duplicate detection
        if (!existing) {
          const competencyService = require('./competencyService');
          existing = await competencyService.findSemanticDuplicate(comp.normalized_name);
        }

        if (existing) {
          competencyId = existing.competency_id;
        } else {
          // Create new competency if not exists (let DB generate UUID)
          const newComp = await competencyRepository.create(
            new (require('../models/Competency'))({
              competency_name: comp.normalized_name,
              description: comp.description || null,
              parent_competency_id: null,
              // Mark competencies created from user raw data ingestion
              // so we can distinguish them from manually curated taxonomy.
              source: comp.source || 'profile_raw_data'
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
    console.log(
      '[UserService.buildInitialProfile] Creating/updating userCompetencies',
      { userId, count: competencyMappings.length }
    );

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

    console.log(
      '[UserService.buildInitialProfile] Loaded userCompetencies after upsert',
      { userId, count: userCompetencies ? userCompetencies.length : 0 }
    );

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

    console.log(
      '[UserService.buildInitialProfile] Finished building competency hierarchy',
      { userId, rootCount: roots.length }
    );

    // Step 11: Build final payload
    const payload = {
      userId: userId,
      relevanceScore: 0,
      competencies: competencies
    };

    // Note: When called from Directory handler via unified endpoint,
    // the profile is returned in response.answer field (no separate POST needed).
    // Assessment MS will request baseline exam skills via unified endpoint when ready.

    console.log(
      '[UserService.buildInitialProfile] Completed',
      { userId, competenciesCount: competencies.length }
    );

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
   * Get a batch of full user profiles (user + competencies only) using
   * cursor-based pagination over the users table.
   *
   * This is used by the Learning Analytics MS batch ingestion flow.
   *
   * NOTE: Per current data model, user skills are not populated in userskill.
   * All profile information is derived from:
   *   - users table (user metadata)
   *   - usercompetency table (competencies)
   *
   * @param {Object} options
   * @param {string|null} [options.cursor] - Last seen user_id (null for first page)
   * @param {number} [options.pageSize=1000] - Max profiles to return
   * @param {string|null} [options.companyId] - Optional company_id filter
   * @returns {Promise<{ totalCount: number, profiles: Array<{ user: Object, competencies: Object[] }>, nextCursor: string|null }>}
   */
  async getFullUserProfilesBatch(options = {}) {
    const {
      cursor = null,
      pageSize = 1000,
      companyId = null
    } = options;

    // 1) Fetch a page of users and the total count of all matching users
    const { users, totalCount } = await userRepository.findAllPaginated({
      cursor,
      limit: pageSize,
      companyId
    });

    if (!users || users.length === 0) {
      return {
        totalCount,
        profiles: [],
        nextCursor: null
      };
    }

    const userIds = users.map(u => u.user_id);

    // 2) Fetch all competencies for these users in a single query
    const allCompetencies = await userCompetencyRepository.findByUsers(userIds);

    const competenciesByUser = new Map();
    for (const uc of allCompetencies) {
      const key = uc.user_id;
      if (!competenciesByUser.has(key)) {
        competenciesByUser.set(key, []);
      }
      competenciesByUser.get(key).push(uc.toJSON());
    }

    // 3) Build profile objects (user + competencies only)
    const profiles = users.map(user => ({
      user: user.toJSON(),
      competencies: competenciesByUser.get(user.user_id) || []
    }));

    // 4) nextCursor is the last user_id in this page (or null if this is the last page)
    const lastUser = users[users.length - 1];
    const nextCursor = users.length === pageSize ? lastUser.user_id : null;

    return {
      totalCount,
      profiles,
      nextCursor
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


