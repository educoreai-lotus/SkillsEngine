/**
 * User Model
 * 
 * Represents a user in the system.
 */

class User {
  constructor(data) {
    this.user_id = data.user_id;
    this.user_name = data.user_name;
    this.company_id = data.company_id;
    this.company_name = data.company_name || null;
    this.employee_type = data.employee_type || null;
    this.path_career = data.path_career || null;
    this.raw_data = data.raw_data || null;
    this.relevance_score = data.relevance_score || 0.00;
    this.preferred_language = data.preferred_language || 'en';
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate user data
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.user_id || typeof this.user_id !== 'string' || this.user_id.trim().length === 0) {
      errors.push('user_id is required and must be a non-empty string');
    }

    if (this.user_id && this.user_id.length > 255) {
      errors.push('user_id must not exceed 255 characters');
    }

    if (!this.user_name || typeof this.user_name !== 'string' || this.user_name.trim().length === 0) {
      errors.push('user_name is required and must be a non-empty string');
    }

    if (this.user_name && this.user_name.length > 255) {
      errors.push('user_name must not exceed 255 characters');
    }

    if (!this.company_id || typeof this.company_id !== 'string' || this.company_id.trim().length === 0) {
      errors.push('company_id is required and must be a non-empty string');
    }

    if (this.company_name && this.company_name.length > 255) {
      errors.push('company_name must not exceed 255 characters');
    }

    if (this.employee_type && !['regular', 'trainer'].includes(this.employee_type)) {
      errors.push('employee_type must be either "regular" or "trainer"');
    }

    if (this.path_career && this.path_career.length > 500) {
      errors.push('path_career must not exceed 500 characters');
    }

    if (this.relevance_score < 0 || this.relevance_score > 100) {
      errors.push('relevance_score must be between 0.00 and 100.00');
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
      user_id: this.user_id,
      user_name: this.user_name,
      company_id: this.company_id,
      company_name: this.company_name,
      employee_type: this.employee_type,
      path_career: this.path_career,
      raw_data: this.raw_data,
      relevance_score: this.relevance_score,
      preferred_language: this.preferred_language,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Check if user is a trainer
   * @returns {boolean}
   */
  isTrainer() {
    return this.employee_type === 'trainer';
  }

  /**
   * Check if user is a regular employee
   * @returns {boolean}
   */
  isRegular() {
    return this.employee_type === 'regular';
  }
}

module.exports = User;


