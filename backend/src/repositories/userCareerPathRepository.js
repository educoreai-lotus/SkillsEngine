/**
 * User Career Path Repository
 *
 * Data access layer for user_career_path table.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const UserCareerPath = require('../models/UserCareerPath');

class UserCareerPathRepository {
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
   * Create a new user career path entry
   * @param {Object} data - { user_id, competency_id }
   * @returns {Promise<UserCareerPath>}
   */
  async create(data) {
    const model = new UserCareerPath(data);
    const validation = model.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { data: result, error } = await this.getClient()
      .from('user_career_path')
      .insert({
        user_id: model.user_id,
        competency_id: model.competency_id
      })
      .select()
      .single();

    if (error) throw error;
    return new UserCareerPath(result);
  }

  /**
   * Find all career paths for a user
   * @param {string} userId - User ID
   * @returns {Promise<UserCareerPath[]>}
   */
  async findByUser(userId) {
    const { data, error } = await this.getClient()
      .from('user_career_path')
      .select(`
        user_id,
        competency_id,
        created_at,
        competencies (
          competency_id,
          competency_name,
          description
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({
      ...new UserCareerPath(row).toJSON(),
      competency_name: row.competencies?.competency_name || null,
      competency_description: row.competencies?.description || null
    }));
  }

  /**
   * Find the latest career path for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async findLatestByUser(userId) {
    const { data, error } = await this.getClient()
      .from('user_career_path')
      .select(`
        user_id,
        competency_id,
        created_at,
        competencies (
          competency_id,
          competency_name,
          description
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      ...new UserCareerPath(data).toJSON(),
      competency_name: data.competencies?.competency_name || null,
      competency_description: data.competencies?.description || null
    };
  }

  /**
   * Delete a career path entry
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<boolean>}
   */
  async delete(userId, competencyId) {
    const { error } = await this.getClient()
      .from('user_career_path')
      .delete()
      .eq('user_id', userId)
      .eq('competency_id', competencyId);

    if (error) throw error;
    return true;
  }

  /**
   * Delete all career paths for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async deleteAllByUser(userId) {
    const { error } = await this.getClient()
      .from('user_career_path')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }
}

module.exports = new UserCareerPathRepository();

