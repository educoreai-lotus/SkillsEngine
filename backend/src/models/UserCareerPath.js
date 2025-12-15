/**
 * User Career Path Model
 * 
 * Represents a user's career path assignment.
 */

class UserCareerPath {
  constructor(data) {
    this.user_id = data.user_id;
    this.competency_id = data.competency_id;
    this.created_at = data.created_at || null;
  }

  /**
   * Validate user career path data
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.user_id || typeof this.user_id !== 'string') {
      errors.push('user_id is required and must be a string');
    }

    if (!this.competency_id || typeof this.competency_id !== 'string') {
      errors.push('competency_id is required and must be a string');
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
      competency_id: this.competency_id,
      created_at: this.created_at
    };
  }
}

module.exports = UserCareerPath;

