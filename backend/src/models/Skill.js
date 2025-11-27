/**
 * Skill Model
 * 
 * Represents a skill in the hierarchical taxonomy.
 * Skills can have unlimited depth (N-level hierarchy).
 */

class Skill {
  constructor(data) {
    // ID is optional on creation – database can generate UUID via default
    this.skill_id = data.skill_id || null;
    this.skill_name = data.skill_name;
    this.parent_skill_id = data.parent_skill_id || null;
    this.description = data.description || null;
     this.source = data.source || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate skill data
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    // skill_id is optional for new records (DB default UUID is used).
    // If provided, ensure it is a non-empty string with a reasonable length.
    if (this.skill_id !== null) {
      if (typeof this.skill_id !== 'string' || this.skill_id.trim().length === 0) {
        errors.push('skill_id, if provided, must be a non-empty string');
      } else if (this.skill_id.length > 255) {
        errors.push('skill_id must not exceed 255 characters');
      }
    }

    if (!this.skill_name || typeof this.skill_name !== 'string' || this.skill_name.trim().length === 0) {
      errors.push('skill_name is required and must be a non-empty string');
    }

    if (this.skill_name && this.skill_name.length > 500) {
      errors.push('skill_name must not exceed 500 characters');
    }

    if (this.parent_skill_id !== null && (typeof this.parent_skill_id !== 'string' || this.parent_skill_id.trim().length === 0)) {
      errors.push('parent_skill_id must be null or a non-empty string');
    }

    if (this.parent_skill_id && this.parent_skill_id.length > 255) {
      errors.push('parent_skill_id must not exceed 255 characters');
    }

    if (this.source && this.source.length > 100) {
      errors.push('source must not exceed 100 characters');
    }

    // Prevent self-reference (only when both IDs are present)
    if (
      this.skill_id &&
      this.parent_skill_id &&
      this.parent_skill_id === this.skill_id
    ) {
      errors.push('skill cannot be its own parent');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      skill_id: this.skill_id,
      skill_name: this.skill_name,
      parent_skill_id: this.parent_skill_id,
      description: this.description,
      source: this.source,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Check if skill is a root/top-level skill (L1)
   * @returns {boolean}
   */
  isRoot() {
    return this.parent_skill_id === null;
  }

  /**
   * Check if skill is a leaf node (MGS - Most Granular Skill)
   * Note: This requires checking if the skill has children, which should be done via repository
   * @param {boolean} hasChildren - Whether this skill has child skills
   * @returns {boolean}
   */
  isLeaf(hasChildren = false) {
    return !hasChildren;
  }
}

module.exports = Skill;


