/**
 * Competency Repository
 *
 * Data access layer for competencies table.
 * Handles CRUD operations, parent-child relationships, and skill mappings.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const Competency = require('../models/Competency');

class CompetencyRepository {
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
   * Create a new competency
   * @param {Competency|Object} competency - Competency model instance or plain object
   * @returns {Promise<Competency>}
   */
  async create(competency) {
    // Ensure we always work with a Competency model instance
    const model = competency instanceof Competency ? competency : new Competency(competency);

    const validation = model.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Let the database generate the UUID for competency_id if not provided.
    const insertData = {
      competency_name: model.competency_name,
      description: model.description,
      parent_competency_id: model.parent_competency_id,
      source: model.source
    };

    if (model.competency_id) {
      insertData.competency_id = model.competency_id;
    }

    const { data, error } = await this.getClient()
      .from('competencies')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return new Competency(data);
  }

  /**
   * Find competency by ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Competency|null>}
   */
  async findById(competencyId) {
    const { data, error } = await this.getClient()
      .from('competencies')
      .select('*')
      .eq('competency_id', competencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return new Competency(data);
  }

  /**
   * Find competency by name (case-insensitive)
   * @param {string} competencyName - Competency name
   * @returns {Promise<Competency|null>}
   */
  async findByName(competencyName) {
    const { data, error } = await this.getClient()
      .from('competencies')
      .select('*')
      .ilike('competency_name', competencyName.trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return new Competency(data);
  }

  /**
   * Find all competencies
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Number of results to skip
   * @returns {Promise<Competency[]>}
   */
  async findAll(options = {}) {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.getClient()
      .from('competencies')
      .select('*')
      .order('competency_name')
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(row => new Competency(row));
  }

  /**
   * Find all parent competencies (top-level)
   * @returns {Promise<Competency[]>}
   */
  async findParentCompetencies() {
    const { data, error } = await this.getClient()
      .from('competencies')
      .select('*')
      .is('parent_competency_id', null)
      .order('competency_name');

    if (error) throw error;
    return data.map(row => new Competency(row));
  }

  /**
   * Find all child competencies of a parent
   * @param {string} parentCompetencyId - Parent competency ID
   * @returns {Promise<Competency[]>}
   */
  async findChildren(parentCompetencyId) {
    const { data, error } = await this.getClient()
      .from('competencies')
      .select('*')
      .eq('parent_competency_id', parentCompetencyId)
      .order('competency_name');

    if (error) throw error;
    return data.map(row => new Competency(row));
  }

  /**
   * Find parent competency
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Competency|null>}
   */
  async findParent(competencyId) {
    const competency = await this.findById(competencyId);
    if (!competency || !competency.parent_competency_id) {
      return null;
    }
    return this.findById(competency.parent_competency_id);
  }

  /**
   * Update a competency
   * @param {string} competencyId - Competency ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Competency|null>}
   */
  async update(competencyId, updates) {
    const allowedFields = ['competency_name', 'description', 'parent_competency_id', 'source'];
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
      .from('competencies')
      .update(updateData)
      .eq('competency_id', competencyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return new Competency(data);
  }

  /**
   * Delete a competency (cascade deletes children)
   * @param {string} competencyId - Competency ID
   * @returns {Promise<boolean>}
   */
  async delete(competencyId) {
    const { error } = await this.getClient()
      .from('competencies')
      .delete()
      .eq('competency_id', competencyId);

    if (error) throw error;
    return true;
  }

  /**
   * Get all skills linked to a competency (L1 skills only)
   * @param {string} competencyId - Competency ID
   * @returns {Promise<Array>} Array of skill objects
   */
  async getLinkedSkills(competencyId) {
    const { data, error } = await this.getClient()
      .from('competency_skill')
      .select(`
        skill_id,
        skills (
          skill_id,
          skill_name,
          description,
          parent_skill_id,
          source,
          created_at,
          updated_at
        )
      `)
      .eq('competency_id', competencyId);

    if (error) throw error;
    return data.map(row => row.skills);
  }

  /**
   * Link a skill to a competency
   * @param {string} competencyId - Competency ID
   * @param {string} skillId - Skill ID (should be L1/top-level skill)
   * @returns {Promise<boolean>}
   */
  async linkSkill(competencyId, skillId) {
    // Check if link already exists
    const { data: existing } = await this.getClient()
      .from('competency_skill')
      .select('*')
      .eq('competency_id', competencyId)
      .eq('skill_id', skillId)
      .single();

    if (existing) return true;

    const { error } = await this.getClient()
      .from('competency_skill')
      .insert({ competency_id: competencyId, skill_id: skillId });

    if (error) throw error;
    return true;
  }

  /**
   * Unlink a skill from a competency
   * @param {string} competencyId - Competency ID
   * @param {string} skillId - Skill ID
   * @returns {Promise<boolean>}
   */
  async unlinkSkill(competencyId, skillId) {
    const { error } = await this.getClient()
      .from('competency_skill')
      .delete()
      .eq('competency_id', competencyId)
      .eq('skill_id', skillId);

    if (error) throw error;
    return true;
  }

  /**
   * Get all competencies that require a specific skill
   * @param {string} skillId - Skill ID
   * @returns {Promise<Competency[]>}
   */
  async findBySkill(skillId) {
    const { data, error } = await this.getClient()
      .from('competency_skill')
      .select(`
        competency_id,
        competencies (*)
      `)
      .eq('skill_id', skillId)
      .order('competencies(competency_name)');

    if (error) throw error;
    return data.map(row => new Competency(row.competencies));
  }

  /**
   * Get competency hierarchy (parent with all children)
   * @param {string} parentCompetencyId - Parent competency ID
   * @returns {Promise<Object>} Tree structure with parent and children
   */
  async getHierarchy(parentCompetencyId) {
    const parent = await this.findById(parentCompetencyId);
    if (!parent) {
      return null;
    }

    const children = await this.findChildren(parentCompetencyId);
    return {
      ...parent.toJSON(),
      children: children.map(child => child.toJSON())
    };
  }

  /**
   * Find all competencies by name pattern (LIKE search)
   * @param {string} pattern - Search pattern
   * @param {Object} options - Query options
   * @returns {Promise<Competency[]>}
   */
  async searchByName(pattern, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await this.getClient()
      .from('competencies')
      .select('*')
      .ilike('competency_name', `%${pattern}%`)
      .order('competency_name')
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data.map(row => new Competency(row));
  }

  /**
   * Check if competency has child competencies
   * @param {string} competencyId - Competency ID
   * @returns {Promise<boolean>}
   */
  async hasChildren(competencyId) {
    const { count, error } = await this.getClient()
      .from('competencies')
      .select('*', { count: 'exact', head: true })
      .eq('parent_competency_id', competencyId);

    if (error) throw error;
    return count > 0;
  }

  /**
   * Get all sub-competencies recursively (using junction table)
   * @param {string} parentCompetencyId - Parent competency ID
   * @returns {Promise<Competency[]>}
   */
  async getAllSubCompetencies(parentCompetencyId) {
    // Use Supabase RPC for recursive query
    const { data, error } = await this.getClient()
      .rpc('get_all_sub_competencies', { parent_id: parentCompetencyId });

    if (error) throw error;
    return data.map(row => new Competency(row));
  }

  /**
   * Get direct sub-competency links for a parent
   * @param {string} parentCompetencyId
   * @returns {Promise<Competency[]>}
   */
  async getSubCompetencyLinks(parentCompetencyId) {
    // We fetch links from the junction table first, then resolve each child
    // competency via a separate lookup. This avoids depending on the exact
    // foreign key constraint name or PostgREST relationship alias, and works
    // regardless of whether the table is named competency_subcompetency or
    // competency_subCompetency at the SQL level, as long as Supabase exposes
    // it under this name.
    const { data, error } = await this.getClient()
      .from('competency_subCompetency')
      .select('child_competency_id')
      .eq('parent_competency_id', parentCompetencyId);

    if (error) throw error;
    if (!data || data.length === 0) {
      return [];
    }

    const children = [];
    for (const row of data) {
      if (!row.child_competency_id) continue;
      const child = await this.findById(row.child_competency_id);
      if (child) {
        children.push(child);
      }
    }

    // Sort by competency_name for stable ordering
    children.sort((a, b) => (a.competency_name || '').localeCompare(b.competency_name || ''));
    return children;
  }

  /**
   * Link a sub-competency to a parent competency
   * @param {string} parentCompetencyId
   * @param {string} childCompetencyId
   * @returns {Promise<boolean>}
   */
  async linkSubCompetency(parentCompetencyId, childCompetencyId) {
    // Check if already exists
    const { data: existing } = await this.getClient()
      .from('competency_subCompetency')
      .select('*')
      .eq('parent_competency_id', parentCompetencyId)
      .eq('child_competency_id', childCompetencyId)
      .single();

    if (existing) return true;

    const { error } = await this.getClient()
      .from('competency_subCompetency')
      .insert({ parent_competency_id: parentCompetencyId, child_competency_id: childCompetencyId });

    if (error) throw error;
    return true;
  }

  /**
   * Unlink a sub-competency from a parent
   * @param {string} parentCompetencyId
   * @param {string} childCompetencyId
   * @returns {Promise<boolean>}
   */
  async unlinkSubCompetency(parentCompetencyId, childCompetencyId) {
    const { error } = await this.getClient()
      .from('competency_subCompetency')
      .delete()
      .eq('parent_competency_id', parentCompetencyId)
      .eq('child_competency_id', childCompetencyId);

    if (error) throw error;
    return true;
  }

  /**
   * Get parent competencies for a child competency (traversing up the hierarchy)
   * Uses competency_subCompetency table to find all parent competencies
   * @param {string} childCompetencyId - Child competency ID
   * @returns {Promise<Competency[]>} Array of parent competencies (all levels up)
   */
  async getParentCompetencies(childCompetencyId) {
    const parents = [];
    let currentCompetencyId = childCompetencyId;
    const visited = new Set(); // Prevent infinite loops

    // Traverse up the hierarchy to find all parent competencies
    while (currentCompetencyId && !visited.has(currentCompetencyId)) {
      visited.add(currentCompetencyId);

      // Find parent via competency_subCompetency table
      const { data: parentLinks, error } = await this.getClient()
        .from('competency_subCompetency')
        .select('parent_competency_id')
        .eq('child_competency_id', currentCompetencyId)
        .limit(1)
        .single();

      if (error) {
        // If no parent found (PGRST116 = not found), we've reached the top
        if (error.code === 'PGRST116') {
          break;
        }
        throw error;
      }

      if (parentLinks && parentLinks.parent_competency_id) {
        const parent = await this.findById(parentLinks.parent_competency_id);
        if (parent) {
          parents.push(parent);
          currentCompetencyId = parent.competency_id;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return parents;
  }
}

module.exports = new CompetencyRepository();
