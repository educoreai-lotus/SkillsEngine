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

    // Step 4: Fetch stored user skills (for backward compatibility with existing skill-competency mappings)
    const userSkills = await userSkillRepository.findByUser(userId);

    // Step 5-8: Build profile payload
    const competencies = [];
    const competencyIds = new Set(userCompetencies.map(uc => uc.competency_id));

    for (const compId of competencyIds) {
      const competency = await competencyRepository.findById(compId);
      if (!competency) continue;

      // Get required skills for this competency
      const requiredSkills = await competencyRepository.getLinkedSkills(compId);
      const requiredSkillIds = new Set(requiredSkills.map(s => s.skill_id));

      // Match user skills with required skills
      const matchedSkills = userSkills
        .filter(us => requiredSkillIds.has(us.skill_id))
        .map(us => ({
          skillId: us.skill_id,
          status: us.verified ? 'verified' : 'unverified'
        }));

      competencies.push({
        competencyId: compId,
        level: 'undefined',
        coverage: 0,
        skills: matchedSkills
      });
    }

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


