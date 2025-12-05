/**
 * User Competency Model
 * 
 * Represents a user's competency profile with verification status.
 */

class UserCompetency {
  constructor(data) {
    this.user_id = data.user_id;
    this.competency_id = data.competency_id;
    this.coverage_percentage = data.coverage_percentage || 0.00;
    // Default to 'undefined' (string) if not provided - matches documentation
    // null is also accepted for backward compatibility
    this.proficiency_level = data.proficiency_level !== undefined ? data.proficiency_level : 'undefined';
    // Support both camelCase (model) and snake_case (DB) for verified skills
    this.verifiedSkills = data.verifiedSkills || data.verifiedskills || [];
    // Optional competency name when joined with competencies table
    this.competency_name =
      data.competency_name || (data.competencies && data.competencies.competency_name) || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Validate user competency data
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

    if (this.coverage_percentage < 0 || this.coverage_percentage > 100) {
      errors.push('coverage_percentage must be between 0.00 and 100.00');
    }

    const allowedLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'undefined'];
    if (this.proficiency_level && !allowedLevels.includes(this.proficiency_level)) {
      errors.push('proficiency_level must be one of: BEGINNER, INTERMEDIATE, ADVANCED, EXPERT, undefined');
    }

    if (!Array.isArray(this.verifiedSkills)) {
      errors.push('verifiedSkills must be an array');
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
      competency_name: this.competency_name,
      coverage_percentage: this.coverage_percentage,
      proficiency_level: this.proficiency_level,
      verifiedSkills: this.verifiedSkills,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = UserCompetency;


