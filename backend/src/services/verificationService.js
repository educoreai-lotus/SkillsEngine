/**
 * Verification Service
 * 
 * Handles skill verification from exam results.
 * Features 3.1, 3.2, 3.3: Baseline and Post-Course Exam Verification
 */

const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const userSkillRepository = require('../repositories/userSkillRepository');
const competencyService = require('./competencyService');
const skillRepository = require('../repositories/skillRepository');
const competencyRepository = require('../repositories/competencyRepository');

class VerificationService {
  /**
   * Process baseline exam results (Feature 3.2)
   * @param {string} userId - User ID
   * @param {Object} examResults - Exam results from Assessment MS
   * @returns {Promise<Object>} Updated profile
   */
  async processBaselineExamResults(userId, examResults) {
    try {
      // Support multiple field names from Assessment MS for backward compatibility:
      // - verified_skills (new, recommended)
      // - skills (legacy)
      // - verifiedSkills (camelCase variant)
      const verifiedSkillsInput =
        examResults?.verified_skills ||
        examResults?.skills ||
        examResults?.verifiedSkills ||
        [];

      // Update userCompetency with verified skills
      const updatedCompetencies = new Set();

      // Helper: normalize a single verified skill coming from Assessment MS
      // - Ensure JSON shape: { skill_id, skill_name, verified }
      // - Only persist leaf / MGS skills (last level in the hierarchy)
      // - Only process MGS with status "pass" (skip status "fail")
      const normalizeVerifiedSkill = async (rawSkill) => {
        if (!rawSkill || !rawSkill.skill_id) {
          return null;
        }

        const { skill_id, skill_name, score, passed, status } = rawSkill;

        // Support both old format (passed boolean) and new format (status: "pass"/"fail")
        // Normalize to lowercase string for robustness ("PASS", "Pass", etc.)
        let skillStatus = status;

        if (skillStatus == null) {
          if (typeof passed === 'boolean') {
            skillStatus = passed ? 'pass' : 'fail';
          }
        }

        if (typeof skillStatus === 'string') {
          skillStatus = skillStatus.toLowerCase().trim();
        }

        // Only process MGS with status "pass"
        if (skillStatus !== 'pass') {
          return null; // Skip MGS that did not pass
        }

        // Ensure we only persist MGS / leaf skills in verifiedSkills
        // If this skill has children, skip it here so verifiedSkills
        // always represents the most granular skills only.
        try {
          const isLeaf = await skillRepository.isLeaf(skill_id);
          if (!isLeaf) {
            return null;
          }
        } catch (err) {
          // If leaf check fails for any reason, fail-safe by skipping this entry
          console.warn(
            '[VerificationService.processBaselineExamResults] Failed to check leaf for skill',
            { skill_id, error: err.message }
          );
          return null;
        }

        return {
          skill_id,
          skill_name,
          verified: true // Only MGS with status "pass" are added
        };
      };

      for (const rawVerifiedSkill of verifiedSkillsInput) {
        try {
          const normalized = await normalizeVerifiedSkill(rawVerifiedSkill);

          // If the skill is not a leaf or invalid, ignore it for verifiedSkills persistence
          if (!normalized) {
            continue;
          }

          const { skill_id, skill_name, verified } = normalized;

          // Find competencies that require this skill
          let competencies = [];
          try {
            competencies = await competencyService.getCompetenciesBySkill(skill_id);
          } catch (err) {
            console.error(
              '[VerificationService.processBaselineExamResults] Error finding competencies for skill',
              { skill_id, error: err.message }
            );
            // Skip this skill if we can't find competencies
            continue;
          }

          for (const competency of competencies) {
            try {
              let userComp = await userCompetencyRepository.findByUserAndCompetency(
                userId,
                competency.competency_id
              );

              if (!userComp) {
                // Create userCompetency if doesn't exist
                // Initial proficiency_level is 'undefined' (string) - will be determined after baseline exam
                try {
                  userComp = await userCompetencyRepository.create({
                    user_id: userId,
                    competency_id: competency.competency_id,
                    coverage_percentage: 0.00,
                    proficiency_level: 'undefined', // Initially undefined - will be determined after baseline exam
                    verifiedSkills: []
                  });
                } catch (err) {
                  console.error(
                    '[VerificationService.processBaselineExamResults] Error creating userCompetency',
                    { userId, competency_id: competency.competency_id, error: err.message }
                  );
                  // Skip this competency if creation fails
                  continue;
                }
              }

              // Update verifiedSkills array
              const verifiedSkills = userComp.verifiedSkills || [];
              const existingIndex = verifiedSkills.findIndex(s => s.skill_id === skill_id);

              // Persist only the minimal JSON shape in verifiedSkills
              const verifiedSkillData = {
                skill_id,
                skill_name,
                verified,
              };

              if (existingIndex >= 0) {
                verifiedSkills[existingIndex] = verifiedSkillData;
              } else {
                verifiedSkills.push(verifiedSkillData);
              }

              // Recalculate coverage percentage using in-memory verifiedSkills
              // This avoids a race where calculateCoverage() re-reads from DB
              // before the latest verifiedSkills have been persisted.
              let coverage = 0;
              try {
                // Get required MGS for this competency
                const requiredMGS = await competencyService.getRequiredMGS(competency.competency_id);
                const requiredCount = requiredMGS.length;

                if (requiredCount === 0) {
                  coverage = 0;
                } else {
                  const verifiedCount = verifiedSkills.filter(s => s.verified === true).length;
                  coverage = Math.round((verifiedCount / requiredCount) * 100 * 100) / 100;
                }
              } catch (err) {
                console.warn(
                  '[VerificationService.processBaselineExamResults] Error calculating coverage (in-memory)',
                  { userId, competency_id: competency.competency_id, error: err.message }
                );
                // Use existing coverage if calculation fails
                coverage = userComp.coverage_percentage || 0;
              }

              // Map coverage to proficiency level
              const proficiencyLevel = this.mapCoverageToProficiency(coverage);

              try {
                await userCompetencyRepository.update(userId, competency.competency_id, {
                  verifiedSkills: verifiedSkills,
                  coverage_percentage: coverage,
                  proficiency_level: proficiencyLevel
                });

                updatedCompetencies.add(competency.competency_id);

                // Update parent competencies if user owns them (don't fail if this fails)
                try {
                  await this.updateParentCompetencies(userId, competency.competency_id);
                } catch (err) {
                  console.warn(
                    '[VerificationService.processBaselineExamResults] Error updating parent competencies',
                    { userId, competency_id: competency.competency_id, error: err.message }
                  );
                  // Continue - parent update failure shouldn't fail the whole process
                }
              } catch (err) {
                console.error(
                  '[VerificationService.processBaselineExamResults] Error updating userCompetency',
                  { userId, competency_id: competency.competency_id, error: err.message }
                );
                // Continue processing other competencies
              }
            } catch (err) {
              console.error(
                '[VerificationService.processBaselineExamResults] Error processing competency',
                { userId, competency_id: competency?.competency_id, error: err.message }
              );
              // Continue processing other competencies
            }
          }
        } catch (err) {
          console.error(
            '[VerificationService.processBaselineExamResults] Error processing skill',
            { skill_id: rawVerifiedSkill?.skill_id, error: err.message }
          );
          // Continue processing other skills
        }
      }

      return {
        userId,
        updated_competencies: Array.from(updatedCompetencies),
        verified_skills_count: verifiedSkillsInput.length
      };
    } catch (error) {
      // Log error but return partial results
      console.error(
        '[VerificationService.processBaselineExamResults] Fatal error processing exam results',
        { userId, error: error.message, stack: error.stack }
      );
      // Return partial results if available, or empty result
      return {
        userId,
        updated_competencies: [],
        verified_skills_count: 0,
        error: error.message
      };
    }
  }

  /**
   * Process post-course exam results (Feature 3.3)
   * @param {string} userId - User ID
   * @param {Object} examResults - Exam results from Assessment MS
   * @returns {Promise<Object>} Updated profile
   */
  async processPostCourseExamResults(userId, examResults) {
    // Post-course exam includes course_name, exam_type, exam_status
    // verified_skills array only contains skills with status "pass" (failed skills are not included)
    // The processing logic is the same as baseline, but we log the course info
    const { course_name, exam_type, exam_status, verified_skills = [] } = examResults;

    // Log course information for tracking
    if (course_name) {
      console.log(
        '[VerificationService.processPostCourseExamResults] Processing post-course exam',
        { userId, course_name, exam_type, exam_status, skills_count: verified_skills.length }
      );
    }

    // Use the same processing logic as baseline
    // Note: verified_skills should only contain skills with status "pass"
    return await this.processBaselineExamResults(userId, examResults);
  }

  /**
   * Calculate coverage percentage for a competency
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<number>} Coverage percentage (0-100)
   */
  async calculateCoverage(userId, competencyId) {
    // Get required MGS
    const requiredMGS = await competencyService.getRequiredMGS(competencyId);
    const requiredCount = requiredMGS.length;

    if (requiredCount === 0) {
      return 0;
    }

    // Get verified skills from userCompetency
    const userComp = await userCompetencyRepository.findByUserAndCompetency(userId, competencyId);
    if (!userComp) {
      return 0;
    }

    const verifiedSkills = userComp.verifiedSkills || [];
    const verifiedCount = verifiedSkills.filter(s => s.verified === true).length;

    return Math.round((verifiedCount / requiredCount) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Map coverage percentage to proficiency level
   * @param {number} coverage - Coverage percentage (0-100)
   * @returns {string} Proficiency level
   */
  mapCoverageToProficiency(coverage) {
    if (coverage >= 80) return 'EXPERT';
    if (coverage >= 60) return 'ADVANCED';
    if (coverage >= 40) return 'INTERMEDIATE';
    if (coverage >= 0) return 'BEGINNER'; // 0% to 39%
    return 'BEGINNER'; // Default to BEGINNER (should not reach here)
  }

  /**
   * Calculate parent coverage by aggregating from all child competencies
   * @param {string} userId - User ID
   * @param {string} parentCompetencyId - Parent competency ID
   * @returns {Promise<number>} Coverage percentage (0-100)
   */
  async calculateParentCoverage(userId, parentCompetencyId) {
    // Get all child competencies (subcompetencies) of this parent
    const childCompetencies = await competencyRepository.getSubCompetencyLinks(parentCompetencyId);

    if (childCompetencies.length === 0) {
      // If no children, calculate normally (this competency might have direct skills)
      return await this.calculateCoverage(userId, parentCompetencyId);
    }

    // Aggregate coverage from all child competencies
    let totalRequiredMGS = 0;
    let totalVerifiedMGS = 0;

    for (const child of childCompetencies) {
      const childRequiredMGS = await competencyService.getRequiredMGS(child.competency_id);
      const childUserComp = await userCompetencyRepository.findByUserAndCompetency(
        userId,
        child.competency_id
      );

      if (childUserComp) {
        totalRequiredMGS += childRequiredMGS.length;
        const childVerifiedSkills = childUserComp.verifiedSkills || [];
        totalVerifiedMGS += childVerifiedSkills.filter(s => s.verified === true).length;
      } else {
        // Child exists but user doesn't have it - still count required MGS
        totalRequiredMGS += childRequiredMGS.length;
      }
    }

    if (totalRequiredMGS === 0) {
      return 0;
    }

    // Calculate aggregated percentage: (total verified / total required) * 100
    return Math.round((totalVerifiedMGS / totalRequiredMGS) * 100 * 100) / 100;
  }

  /**
   * Update parent competencies after a child competency is updated
   * Traverses up the hierarchy and updates all parent competencies if user owns them
   * @param {string} userId - User ID
   * @param {string} childCompetencyId - Child competency ID that was just updated
   * @returns {Promise<void>}
   */
  async updateParentCompetencies(userId, childCompetencyId) {
    try {
      // Find all parent competencies (traversing up the hierarchy)
      const parentCompetencies = await competencyRepository.getParentCompetencies(childCompetencyId);

      // Update each parent competency if user owns it
      for (const parent of parentCompetencies) {
        // Check if user owns this parent competency
        const parentUserComp = await userCompetencyRepository.findByUserAndCompetency(
          userId,
          parent.competency_id
        );

        if (parentUserComp) {
          // Recalculate parent coverage by aggregating from all child competencies
          const parentCoverage = await this.calculateParentCoverage(userId, parent.competency_id);
          const parentProficiencyLevel = this.mapCoverageToProficiency(parentCoverage);

          // Update parent userCompetency
          await userCompetencyRepository.update(userId, parent.competency_id, {
            coverage_percentage: parentCoverage,
            proficiency_level: parentProficiencyLevel
          });

          // Recursively update grandparents (if any)
          await this.updateParentCompetencies(userId, parent.competency_id);
        }
      }
    } catch (error) {
      // Log error but don't fail the entire process
      console.error(
        '[VerificationService.updateParentCompetencies] Error updating parent competencies',
        { userId, childCompetencyId, error: error.message }
      );
    }
  }
}

module.exports = new VerificationService();


