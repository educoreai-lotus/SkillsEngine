/**
 * User Competency Repository
 *
 * Data access layer for usercompetency table.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const UserCompetency = require('../models/UserCompetency');

class UserCompetencyRepository {
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
   * Create a new user competency
   * @param {UserCompetency|Object} userCompetency - UserCompetency model instance or plain object
   * @returns {Promise<UserCompetency>}
   */
  async create(userCompetency) {
    // Ensure we always work with a UserCompetency model instance
    const model = userCompetency instanceof UserCompetency
      ? userCompetency
      : new UserCompetency(userCompetency);

    const validation = model.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { data, error } = await this.getClient()
      .from('usercompetency')
      .insert({
        user_id: model.user_id,
        competency_id: model.competency_id,
        coverage_percentage: model.coverage_percentage,
        proficiency_level: model.proficiency_level,
        verifiedskills: model.verifiedSkills
      })
      .select()
      .single();

    if (error) throw error;
    return new UserCompetency(data);
  }

  /**
   * Find user competency by user ID and competency ID
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<UserCompetency|null>}
   */
  async findByUserAndCompetency(userId, competencyId) {
    const { data, error } = await this.getClient()
      .from('usercompetency')
      .select(`
        user_id,
        competency_id,
        coverage_percentage,
        proficiency_level,
        verifiedskills,
        created_at,
        updated_at,
        competencies (competency_name)
      `)
      .eq('user_id', userId)
      .eq('competency_id', competencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new UserCompetency(data);
  }

  /**
   * Find all competencies for a user
   * @param {string} userId - User ID
   * @returns {Promise<UserCompetency[]>}
   */
  async findByUser(userId) {
    const { data, error } = await this.getClient()
      .from('usercompetency')
      .select(`
        user_id,
        competency_id,
        coverage_percentage,
        proficiency_level,
        verifiedskills,
        created_at,
        updated_at,
        competencies (competency_name)
      `)
      .eq('user_id', userId)
      .order('competency_id');

    if (error) throw error;
    return data.map(row => new UserCompetency(row));
  }

  /**
   * Find competencies for multiple users in a single query.
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise<UserCompetency[]>}
   */
  async findByUsers(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.getClient()
      .from('usercompetency')
      .select(`
        user_id,
        competency_id,
        coverage_percentage,
        proficiency_level,
        verifiedskills,
        created_at,
        updated_at,
        competencies (competency_name)
      `)
      .in('user_id', userIds)
      .order('user_id')
      .order('competency_id');

    if (error) throw error;
    return (data || []).map(row => new UserCompetency(row));
  }

  /**
   * Find all users for a competency
   * @param {string} competencyId - Competency ID
   * @returns {Promise<UserCompetency[]>}
   */
  async findByCompetency(competencyId) {
    const { data, error } = await this.getClient()
      .from('usercompetency')
      .select(`
        user_id,
        competency_id,
        coverage_percentage,
        proficiency_level,
        verifiedskills,
        created_at,
        updated_at,
        competencies (competency_name)
      `)
      .eq('competency_id', competencyId)
      .order('user_id');

    if (error) throw error;
    return data.map(row => new UserCompetency(row));
  }

  /**
   * Update a user competency
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<UserCompetency|null>}
   */
  async update(userId, competencyId, updates) {
    const allowedFields = ['coverage_percentage', 'proficiency_level', 'verifiedSkills'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        // Map verifiedSkills to verifiedskills for database
        const dbField = field === 'verifiedSkills' ? 'verifiedskills' : field;
        updateData[dbField] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.getClient()
      .from('usercompetency')
      .update(updateData)
      .eq('user_id', userId)
      .eq('competency_id', competencyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new UserCompetency(data);
  }

  /**
   * Delete a user competency
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<boolean>}
   */
  async delete(userId, competencyId) {
    const { error } = await this.getClient()
      .from('usercompetency')
      .delete()
      .eq('user_id', userId)
      .eq('competency_id', competencyId);

    if (error) throw error;
    return true;
  }

  /**
   * Upsert user competency
   * @param {UserCompetency} userCompetency - UserCompetency model instance
   * @returns {Promise<UserCompetency>}
   */
  async upsert(userCompetency) {
    const existing = await this.findByUserAndCompetency(userCompetency.user_id, userCompetency.competency_id);
    if (existing) {
      return await this.update(
        userCompetency.user_id,
        userCompetency.competency_id,
        {
          coverage_percentage: userCompetency.coverage_percentage,
          proficiency_level: userCompetency.proficiency_level,
          verifiedSkills: userCompetency.verifiedSkills
        }
      );
    }
    return await this.create(userCompetency);
  }
}

module.exports = new UserCompetencyRepository();
