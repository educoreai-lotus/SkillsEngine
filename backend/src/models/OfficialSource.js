/**
 * OfficialSource Model
 *
 * Represents an official external source that provides
 * hierarchical skills and/or competencies (Feature 6.x).
 */

class OfficialSource {
  constructor(data) {
    this.source_id = data.source_id;
    this.source_name = data.source_name;
    this.reference_index_url = data.reference_index_url;
    this.reference_type = data.reference_type || null;
    this.access_method = data.access_method || null;
    this.hierarchy_support = typeof data.hierarchy_support === 'boolean'
      ? data.hierarchy_support
      : false;
    this.provides = data.provides || null;
    this.topics_covered = data.topics_covered || null;
    this.skill_focus = data.skill_focus || null;
    this.notes = data.notes || null;
    this.last_checked = data.last_checked || null;
    this.is_extracted = typeof data.is_extracted === 'boolean'
      ? data.is_extracted
      : false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate source data
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    if (!this.source_id || typeof this.source_id !== 'string' || this.source_id.trim().length === 0) {
      errors.push('source_id is required and must be a non-empty string');
    }

    if (this.source_id && this.source_id.length > 255) {
      errors.push('source_id must not exceed 255 characters');
    }

    if (!this.source_name || typeof this.source_name !== 'string' || this.source_name.trim().length === 0) {
      errors.push('source_name is required and must be a non-empty string');
    }

    if (this.source_name && this.source_name.length > 500) {
      errors.push('source_name must not exceed 500 characters');
    }

    if (
      !this.reference_index_url ||
      typeof this.reference_index_url !== 'string' ||
      this.reference_index_url.trim().length === 0
    ) {
      errors.push('reference_index_url is required and must be a non-empty string');
    }

    if (this.reference_index_url && this.reference_index_url.length > 1000) {
      errors.push('reference_index_url must not exceed 1000 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  toJSON() {
    return {
      source_id: this.source_id,
      source_name: this.source_name,
      reference_index_url: this.reference_index_url,
      reference_type: this.reference_type,
      access_method: this.access_method,
      hierarchy_support: this.hierarchy_support,
      provides: this.provides,
      topics_covered: this.topics_covered,
      skill_focus: this.skill_focus,
      notes: this.notes,
      last_checked: this.last_checked,
      is_extracted: this.is_extracted,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = OfficialSource;


