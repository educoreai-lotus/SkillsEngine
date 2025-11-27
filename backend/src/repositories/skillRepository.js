/**
 * Skill Repository
 *
 * Data access layer for skills table.
 * Handles CRUD operations, hierarchy traversal, and MGS identification.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const Skill = require('../models/Skill');

class SkillRepository {
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
   * Create a new skill
   * @param {Skill|Object} skill - Skill model instance or plain object
   * @returns {Promise<Skill>}
   */
  async create(skill) {
    // Ensure we always work with a Skill model instance
    const model = skill instanceof Skill ? skill : new Skill(skill);

    const validation = model.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Let the database generate the UUID for skill_id if not provided.
    const insertData = {
      skill_name: model.skill_name,
      parent_skill_id: model.parent_skill_id,
      description: model.description,
      source: model.source
    };

    if (model.skill_id) {
      insertData.skill_id = model.skill_id;
    }

    const { data, error } = await this.getClient()
      .from('skills')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return new Skill(data);
  }

  /**
   * Find skill by ID
   * @param {string} skillId - Skill ID
   * @returns {Promise<Skill|null>}
   */
  async findById(skillId) {
    const { data, error } = await this.getClient()
      .from('skills')
      .select('*')
      .eq('skill_id', skillId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new Skill(data);
  }

  /**
   * Find skill by name (case-insensitive)
   * @param {string} skillName - Skill name
   * @returns {Promise<Skill|null>}
   */
  async findByName(skillName) {
    const { data, error } = await this.getClient()
      .from('skills')
      .select('*')
      .ilike('skill_name', skillName.trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new Skill(data);
  }

  /**
   * Find all skills
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Number of results to skip
   * @returns {Promise<Skill[]>}
   */
  async findAll(options = {}) {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.getClient()
      .from('skills')
      .select('*')
      .order('skill_name')
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(row => new Skill(row));
  }

  /**
   * Find all root/top-level skills (L1 skills)
   * @returns {Promise<Skill[]>}
   */
  async findRootSkills() {
    const { data, error } = await this.getClient()
      .from('skills')
      .select('*')
      .is('parent_skill_id', null)
      .order('skill_name');

    if (error) throw error;
    return data.map(row => new Skill(row));
  }

  /**
   * Find all child skills of a parent skill
   * @param {string} parentSkillId - Parent skill ID
   * @returns {Promise<Skill[]>}
   */
  async findChildren(parentSkillId) {
    const { data, error } = await this.getClient()
      .from('skills')
      .select('*')
      .eq('parent_skill_id', parentSkillId)
      .order('skill_name');

    if (error) throw error;
    return data.map(row => new Skill(row));
  }

  /**
   * Find parent skill
   * @param {string} skillId - Skill ID
   * @returns {Promise<Skill|null>}
   */
  async findParent(skillId) {
    const skill = await this.findById(skillId);
    if (!skill || !skill.parent_skill_id) {
      return null;
    }
    return this.findById(skill.parent_skill_id);
  }

  /**
   * Update a skill
   * @param {string} skillId - Skill ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Skill|null>}
   */
  async update(skillId, updates) {
    const allowedFields = ['skill_name', 'parent_skill_id', 'description', 'source'];
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
      .from('skills')
      .update(updateData)
      .eq('skill_id', skillId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return new Skill(data);
  }

  /**
   * Delete a skill (cascade deletes children)
   * @param {string} skillId - Skill ID
   * @returns {Promise<boolean>}
   */
  async delete(skillId) {
    const { error } = await this.getClient()
      .from('skills')
      .delete()
      .eq('skill_id', skillId);

    if (error) throw error;
    return true;
  }

  /**
   * Traverse skill hierarchy from a root skill to all descendants
   * @param {string} rootSkillId - Root skill ID
   * @returns {Promise<Object>} Tree structure with all descendants
   */
  async traverseHierarchy(rootSkillId) {
    const rootSkill = await this.findById(rootSkillId);
    if (!rootSkill) {
      return null;
    }

    const buildTree = async (skill) => {
      const children = await this.findChildren(skill.skill_id);
      const childrenWithDescendants = await Promise.all(
        children.map(child => buildTree(child))
      );

      return {
        ...skill.toJSON(),
        children: childrenWithDescendants
      };
    };

    return buildTree(rootSkill);
  }

  /**
   * Get all MGS (Most Granular Skills) for a given root skill
   * MGS are leaf nodes (skills with no children) in the hierarchy
   * @param {string} rootSkillId - Root skill ID
   * @returns {Promise<Skill[]>}
   */
  async findMGS(rootSkillId) {
    // Use Supabase RPC for recursive CTE query
    const { data, error } = await this.getClient()
      .rpc('get_mgs_for_skill', { root_skill_id: rootSkillId });

    if (error) throw error;
    return data.map(row => new Skill(row));
  }

  /**
   * Count total MGS for a root skill
   * @param {string} rootSkillId - Root skill ID
   * @returns {Promise<number>}
   */
  async countMGS(rootSkillId) {
    const mgs = await this.findMGS(rootSkillId);
    return mgs.length;
  }

  /**
   * Get hierarchy depth for a skill
   * @param {string} skillId - Skill ID
   * @returns {Promise<number>} Depth level (1 = L1, 2 = L2, etc.)
   */
  async getDepth(skillId) {
    // Use Supabase RPC for recursive CTE query
    const { data, error } = await this.getClient()
      .rpc('get_skill_depth', { skill_id_param: skillId });

    if (error) throw error;
    return data || 0;
  }

  /**
   * Check if a skill is a leaf node (MGS)
   * @param {string} skillId - Skill ID
   * @returns {Promise<boolean>}
   */
  async isLeaf(skillId) {
    const { data, error } = await this.getClient()
      .from('skills')
      .select('skill_id', { count: 'exact', head: true })
      .eq('parent_skill_id', skillId);

    if (error) throw error;
    return data === 0;
  }

  /**
   * Find all skills by name pattern (LIKE search)
   * @param {string} pattern - Search pattern
   * @param {Object} options - Query options
   * @returns {Promise<Skill[]>}
   */
  async searchByName(pattern, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.getClient()
      .from('skills')
      .select('*')
      .ilike('skill_name', `%${pattern}%`)
      .order('skill_name')
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(row => new Skill(row));
  }
}

module.exports = new SkillRepository();
