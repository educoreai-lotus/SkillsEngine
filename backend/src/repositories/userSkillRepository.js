/**
 * User Skill Repository
 *
 * Data access layer for userskill table.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const UserSkill = require('../models/UserSkill');

class UserSkillRepository {
  constructor() {
    this.supabase = null;
  }

  /**
   * Get Supabase client instance
   */
  getClient() {
    if (!this.supabase) {
      this.supabase = getSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * Create a new user skill
   * @param {UserSkill} userSkill - UserSkill model instance
   * @returns {Promise<UserSkill>}
   */
  async create(userSkill) {
    const validation = userSkill.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { data, error } = await this.getClient()
      .from('userskill')
      .insert({
        user_id: userSkill.user_id,
        skill_id: userSkill.skill_id,
        skill_name: userSkill.skill_name,
        verified: userSkill.verified,
        source: userSkill.source
      })
      .select()
      .single();

    if (error) throw error;
    return new UserSkill(data);
  }

  /**
   * Find user skill by user ID and skill ID
   * @param {string} userId - User ID
   * @param {string} skillId - Skill ID
   * @returns {Promise<UserSkill|null>}
   */
  async findByUserAndSkill(userId, skillId) {
    const { data, error } = await this.getClient()
      .from('userskill')
      .select('*')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new UserSkill(data);
  }

  /**
   * Find all skills for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<UserSkill[]>}
   */
  async findByUser(userId, options = {}) {
    const { verified = null, source = null } = options;

    let query = this.getClient()
      .from('userskill')
      .select('*')
      .eq('user_id', userId);

    if (verified !== null) {
      query = query.eq('verified', verified);
    }

    if (source) {
      query = query.eq('source', source);
    }

    query = query.order('skill_name');

    const { data, error } = await query;

    if (error) throw error;
    return data.map(row => new UserSkill(row));
  }

  /**
   * Find all users for a skill
   * @param {string} skillId - Skill ID
   * @returns {Promise<UserSkill[]>}
   */
  async findBySkill(skillId) {
    const { data, error } = await this.getClient()
      .from('userskill')
      .select('*')
      .eq('skill_id', skillId)
      .order('user_id');

    if (error) throw error;
    return data.map(row => new UserSkill(row));
  }

  /**
   * Update a user skill
   * @param {string} userId - User ID
   * @param {string} skillId - Skill ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<UserSkill|null>}
   */
  async update(userId, skillId, updates) {
    const allowedFields = ['skill_name', 'verified', 'source'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        updateData[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    updateData.last_update = new Date().toISOString();

    const { data, error } = await this.getClient()
      .from('userskill')
      .update(updateData)
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new UserSkill(data);
  }

  /**
   * Delete a user skill
   * @param {string} userId - User ID
   * @param {string} skillId - Skill ID
   * @returns {Promise<boolean>}
   */
  async delete(userId, skillId) {
    const { error } = await this.getClient()
      .from('userskill')
      .delete()
      .eq('user_id', userId)
      .eq('skill_id', skillId);

    if (error) throw error;
    return true;
  }

  /**
   * Upsert user skill
   * @param {UserSkill} userSkill - UserSkill model instance
   * @returns {Promise<UserSkill>}
   */
  async upsert(userSkill) {
    // Use the model's internal field names for lookups
    const existing = await this.findByUserAndSkill(userSkill.user_id, userSkill.skill_id);
    if (existing) {
      return await this.update(
        userSkill.user_id,
        userSkill.skill_id,
        {
          skill_name: userSkill.skill_name,
          verified: userSkill.verified,
          source: userSkill.source
        }
      );
    }
    return await this.create(userSkill);
  }
}

module.exports = new UserSkillRepository();


