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
   * @param {Object} data - { user_id, competency_id, root_career_path_competency_id? }
   * @returns {Promise<UserCareerPath>}
   */
  async create(data) {
    const model = new UserCareerPath(data);
    const validation = model.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const insertData = {
      user_id: model.user_id,
      competency_id: model.competency_id
    };

    // Include root_career_path_competency_id if provided
    if (model.root_career_path_competency_id) {
      insertData.root_career_path_competency_id = model.root_career_path_competency_id;
    }

    const { data: result, error } = await this.getClient()
      .from('user_career_path')
      .insert(insertData)
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
      .select('user_id, competency_id, root_career_path_competency_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch competency details separately for each career path
    const results = [];
    for (const row of data || []) {
      let competencyName = null;
      let competencyDescription = null;

      if (row.competency_id) {
        const { data: comp } = await this.getClient()
          .from('competencies')
          .select('competency_name, description')
          .eq('competency_id', row.competency_id)
          .single();

        if (comp) {
          competencyName = comp.competency_name;
          competencyDescription = comp.description;
        }
      }

      results.push({
        ...new UserCareerPath(row).toJSON(),
        competency_name: competencyName,
        competency_description: competencyDescription
      });
    }

    return results;
  }

  /**
   * Find the latest career path for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async findLatestByUser(userId) {
    const { data, error } = await this.getClient()
      .from('user_career_path')
      .select('user_id, competency_id, root_career_path_competency_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    // Fetch competency details separately
    let competencyName = null;
    let competencyDescription = null;

    if (data.competency_id) {
      const { data: comp } = await this.getClient()
        .from('competencies')
        .select('competency_name, description')
        .eq('competency_id', data.competency_id)
        .single();

      if (comp) {
        competencyName = comp.competency_name;
        competencyDescription = comp.description;
      }
    }

    return {
      ...new UserCareerPath(data).toJSON(),
      competency_name: competencyName,
      competency_description: competencyDescription
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

