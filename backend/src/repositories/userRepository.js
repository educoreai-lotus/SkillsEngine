/**
 * User Repository
 *
 * Data access layer for users table.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const User = require('../models/User');

class UserRepository {
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
   * Create a new user
   * @param {User} user - User model instance
   * @returns {Promise<User>}
   */
  async create(user) {
    const validation = user.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    const { data, error } = await this.getClient()
      .from('users')
      .insert({
        user_id: user.user_id,
        user_name: user.user_name,
        company_id: user.company_id,
        company_name: user.company_name,
        employee_type: user.employee_type,
        path_career: user.path_career,
        raw_data: user.raw_data,
        relevance_score: user.relevance_score,
        preferred_language: user.preferred_language
      })
      .select()
      .single();

    if (error) throw error;
    return new User(data);
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<User|null>}
   */
  async findById(userId) {
    const { data, error } = await this.getClient()
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new User(data);
  }

  /**
   * Find users by company
   * @param {string} companyId - Company ID
   * @param {Object} options - Query options
   * @returns {Promise<User[]>}
   */
  async findByCompany(companyId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.getClient()
      .from('users')
      .select('*')
      .eq('company_id', companyId)
      .order('user_name')
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(row => new User(row));
  }

  /**
   * Find users by employee type
   * @param {string} employeeType - Employee type ('regular' or 'trainer')
   * @param {Object} options - Query options
   * @returns {Promise<User[]>}
   */
  async findByEmployeeType(employeeType, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.getClient()
      .from('users')
      .select('*')
      .eq('employee_type', employeeType)
      .order('user_name')
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(row => new User(row));
  }

  /**
   * Find all users with optional company filter using cursor-based pagination.
   *
   * This is used by Learning Analytics batch ingestion to page through
   * all user profiles in a stable order using user_id as the cursor.
   *
   * @param {Object} options
   * @param {string|null} [options.cursor] - Last seen user_id (null for first page)
   * @param {number} [options.limit=1000] - Max records to return
   * @param {string|null} [options.companyId] - Optional company_id filter
   * @returns {Promise<{ users: User[], totalCount: number }>}
   */
  async findAllPaginated(options = {}) {
    const { cursor = null, limit = 1000, companyId = null } = options;
    const client = this.getClient();

    // 1) Get total count of all matching records (independent of cursor)
    let countQuery = client
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (companyId) {
      countQuery = countQuery.eq('company_id', companyId);
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      throw countError;
    }

    // 2) Fetch one page of data using user_id as the cursor
    let dataQuery = client
      .from('users')
      .select('*')
      .order('user_id', { ascending: true })
      .limit(limit);

    if (companyId) {
      dataQuery = dataQuery.eq('company_id', companyId);
    }

    if (cursor) {
      // Return records strictly after the given cursor (last user_id)
      dataQuery = dataQuery.gt('user_id', cursor);
    }

    const { data, error } = await dataQuery;
    if (error) {
      throw error;
    }

    const users = (data || []).map(row => new User(row));

    return {
      users,
      totalCount: typeof count === 'number' ? count : 0
    };
  }

  /**
   * Update a user
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<User|null>}
   */
  async update(userId, updates) {
    const allowedFields = ['user_name', 'company_id', 'company_name', 'employee_type', 'path_career', 'raw_data', 'relevance_score', 'preferred_language'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        updateData[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.getClient()
      .from('users')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new User(data);
  }

  /**
   * Delete a user (cascade deletes related records)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async delete(userId) {
    const { error } = await this.getClient()
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Upsert user (insert or update)
   * @param {User} user - User model instance
   * @returns {Promise<User>}
   */
  async upsert(user) {
    const existing = await this.findById(user.user_id);
    if (existing) {
      return await this.update(user.user_id, user.toJSON());
    }
    return await this.create(user);
  }
}

module.exports = new UserRepository();


