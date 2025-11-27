/**
 * Competency Model
 * 
 * Represents a competency in the two-layer structure (Parent → Child).
 */

class Competency {
  constructor(data) {
    // ID is optional on creation – database can generate UUID via default
    this.competency_id = data.competency_id || null;
    this.competency_name = data.competency_name;
    this.description = data.description || null;
    this.parent_competency_id = data.parent_competency_id || null;
    this.source = data.source || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate competency data
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    // competency_id is optional for new records (DB default UUID is used).
    // If provided, ensure it is a non-empty string with a reasonable length.
    if (this.competency_id !== null) {
      if (typeof this.competency_id !== 'string' || this.competency_id.trim().length === 0) {
        errors.push('competency_id, if provided, must be a non-empty string');
      } else if (this.competency_id.length > 255) {
        errors.push('competency_id must not exceed 255 characters');
      }
    }

    if (!this.competency_name || typeof this.competency_name !== 'string' || this.competency_name.trim().length === 0) {
      errors.push('competency_name is required and must be a non-empty string');
    }

    if (this.competency_name && this.competency_name.length > 500) {
      errors.push('competency_name must not exceed 500 characters');
    }

    if (this.parent_competency_id !== null && (typeof this.parent_competency_id !== 'string' || this.parent_competency_id.trim().length === 0)) {
      errors.push('parent_competency_id must be null or a non-empty string');
    }

    if (this.parent_competency_id && this.parent_competency_id.length > 255) {
      errors.push('parent_competency_id must not exceed 255 characters');
    }

    if (this.source && this.source.length > 100) {
      errors.push('source must not exceed 100 characters');
    }

    // Prevent self-reference (only when both IDs are present)
    if (
      this.competency_id &&
      this.parent_competency_id &&
      this.parent_competency_id === this.competency_id
    ) {
      errors.push('competency cannot be its own parent');
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
      competency_id: this.competency_id,
      competency_name: this.competency_name,
      description: this.description,
      parent_competency_id: this.parent_competency_id,
      source: this.source,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Check if competency is a parent (top-level) competency
   * @returns {boolean}
   */
  isParent() {
    return this.parent_competency_id === null;
  }

  /**
   * Check if competency is a child (sub-competency)
   * @returns {boolean}
   */
  isChild() {
    return this.parent_competency_id !== null;
  }
}

module.exports = Competency;


