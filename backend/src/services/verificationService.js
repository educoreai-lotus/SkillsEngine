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
const gapAnalysisService = require('./gapAnalysisService');
const learnerAIMSClient = require('./learnerAIMSClient');
const directoryMSClient = require('./directoryMSClient');

class VerificationService {
  /**
   * Process baseline exam results (Feature 3.2)
   * @param {string} userId - User ID
   * @param {Object} examResults - Exam results from Assessment MS
   * @param {Object} [options] - Additional options (examType, examStatus)
   * @returns {Promise<Object>} Updated profile + gap analysis metadata
   */
  async processBaselineExamResults(userId, examResults, options = {}) {
    const {
      examType = 'baseline',
      examStatus: optionsExamStatus = null
    } = options;

    // Check examResults first, then options, else null
    // Note: Baseline exams don't have courseName
    const examStatus = examResults?.exam_status || examResults?.examStatus || optionsExamStatus || null;
    try {
      // Support multiple field names from Assessment MS for backward compatibility:
      // - skills (preferred)
      // - verified_skills (legacy snake_case)
      // - verifiedSkills (legacy camelCase)
      const verifiedSkillsInput =
        examResults?.skills ||
        examResults?.verified_skills ||
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

        const { skill_id, skill_name, status } = rawSkill;

        // Status field is always required (format: "pass"/"fail")
        // Normalize to lowercase string for robustness ("PASS", "Pass", etc.)
        if (!status || typeof status !== 'string') {
          return null; // Skip if status is missing or invalid
        }

        const skillStatus = status.toLowerCase().trim();

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
          // Note: getCompetenciesBySkill works for leaf skills (MGS) by traversing
          // up the skill hierarchy to find competencies linked at any level
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

      let gapAnalysis = null;
      try {
        gapAnalysis = await this.runGapAnalysis(userId, updatedCompetencies, {
          examType,
          examStatus,
          courseName: null // Baseline exams don't have courseName
        });
      } catch (err) {
        console.error(
          '[VerificationService.processBaselineExamResults] Error running gap analysis',
          { userId, error: err.message }
        );
      }

      // Automatically send updated profile to Directory MS after processing exam results
      // This happens automatically whenever userCompetency is updated
      try {
        const updatedProfile = await this.buildUpdatedProfilePayload(userId);
        await directoryMSClient.sendUpdatedProfile(userId, updatedProfile);
        console.log(
          '[VerificationService.processBaselineExamResults] Successfully sent updated profile to Directory MS',
          { userId, examType, competenciesUpdated: updatedCompetencies.size }
        );
      } catch (err) {
        // Don't fail exam processing if Directory MS update fails
        console.warn(
          '[VerificationService.processBaselineExamResults] Failed to send updated profile to Directory MS',
          { userId, error: err.message }
        );
      }

      // Return empty response - processing is complete
      return {};
    } catch (error) {
      // Log error but return partial results
      console.error(
        '[VerificationService.processBaselineExamResults] Fatal error processing exam results',
        { userId, error: error.message, stack: error.stack }
      );
      // Return error message on failure
      return { message: error.message || 'Failed to process exam results' };
    }
  }

  /**
   * Process post-course exam results (Feature 3.3)
   * @param {string} userId - User ID
   * @param {Object} examResults - Exam results from Assessment MS
   * @returns {Promise<Object>} Updated profile + gap analysis metadata
   */
  async processPostCourseExamResults(userId, examResults) {
    // Post-course exam includes course_name, exam_type, exam_status
    // skills array (or verified_skills) only contains skills with status "pass" (failed skills are not included)
    // The processing logic is the same as baseline, but we log the course info
    const { course_name, exam_type, exam_status } = examResults || {};
    const verified_skills =
      (examResults &&
        (examResults.skills ||
          examResults.verified_skills ||
          examResults.verifiedSkills)) ||
      [];

    // Log course information for tracking
    if (course_name) {
      console.log(
        '[VerificationService.processPostCourseExamResults] Processing post-course exam',
        { userId, course_name, exam_type, exam_status, skills_count: verified_skills.length }
      );
    }

    // Use the same core processing logic as baseline, but pass examType/examStatus
    // so gap analysis can distinguish between broad vs narrow analysis:
    // - Baseline exam       -> broad (full career path)
    // - Post-course PASS    -> broad (full career path)
    // - Post-course FAIL    -> narrow (course-specific competency/competencies)
    // Note: verified_skills should only contain skills with status "pass"
    return await this.processBaselineExamResults(userId, examResults || {}, {
      examType: 'post-course',
      examStatus: exam_status,
      courseName: course_name
    });
  }

  /**
   * Run gap analysis after exam results and send to Learner AI MS.
   *
   * - Baseline exam       -> Broad gap analysis (career path competencies only)
   * - Post-course PASS    -> Broad gap analysis (career path competencies only)
   * - Post-course FAIL    -> Narrow gap analysis (only updated competencies)
   *
   * @param {string} userId - User ID
   * @param {Set<string>} updatedCompetencies - Set of competency IDs updated from this exam
   * @param {Object} context - { examType, examStatus, courseName }
   * @returns {Promise<Object>} Gap analysis metadata and results
   */
  async runGapAnalysis(userId, updatedCompetencies, context = {}) {
    const {
      examType = 'baseline',
      examStatus = null,
      courseName = null
    } = context;

    const normalizedExamType = typeof examType === 'string'
      ? examType.toLowerCase().trim()
      : 'baseline';
    const normalizedExamStatus = typeof examStatus === 'string'
      ? examStatus.toLowerCase().trim()
      : null;

    // Determine analysis type based on exam type + status
    // Docs: step_3_feature_specifications.md (Feature 5)
    // - Baseline Exam        -> Broad (career path competencies)
    // - Post-course PASS     -> Broad (career path competencies)
    // - Post-course FAIL     -> Narrow (updated competencies only)
    let analysisType = 'broad';
    if (normalizedExamType === 'post-course' && normalizedExamStatus === 'fail') {
      analysisType = 'narrow';
    }

    let gaps = {};

    try {
      if (analysisType === 'broad') {
        // Broad gap analysis scoped to career path competencies only
        gaps = await gapAnalysisService.calculateCareerPathGap(userId);
        console.log('[VerificationService.runGapAnalysis] Broad gap analysis (career path only)', {
          userId,
          gapKeys: Object.keys(gaps)
        });
      } else {
        // Narrow gap analysis scoped to competencies updated by this exam
        const competencyIds = updatedCompetencies
          ? Array.from(updatedCompetencies)
          : [];

        if (competencyIds.length === 0) {
          // Fallback: if we don't know which competencies were updated,
          // fall back to career path analysis
          gaps = await gapAnalysisService.calculateCareerPathGap(userId);
        } else {
          for (const competencyId of competencyIds) {
            const perCompGaps = await gapAnalysisService.calculateGapAnalysis(
              userId,
              competencyId
            );
            gaps = {
              ...gaps,
              ...perCompGaps
            };
          }
        }
      }
    } catch (error) {
      console.error(
        '[VerificationService.runGapAnalysis] Error calculating gap analysis',
        { userId, examType: normalizedExamType, examStatus: normalizedExamStatus, error: error.message }
      );
      gaps = {};
    }

    // Best-effort: send gap analysis to Learner AI MS
    try {
      if (Object.keys(gaps).length > 0) {
        await learnerAIMSClient.sendGapAnalysis(userId, gaps);
      }
    } catch (error) {
      // Do not fail exam processing if Learner AI is unavailable
      console.warn(
        '[VerificationService.runGapAnalysis] Failed to send gap analysis to Learner AI MS',
        { userId, error: error.message }
      );
    }

    return {
      analysis_type: analysisType,
      exam_type: normalizedExamType,
      exam_status: normalizedExamStatus,
      course_name: courseName,
      gaps
    };
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

  /**
   * Build updated profile payload for Directory MS
   * Builds a hierarchical competency profile with current coverage and proficiency levels
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Profile payload for Directory MS
   */
  async buildUpdatedProfilePayload(userId) {
    try {
      // Get all user competencies
      const userCompetencies = await userCompetencyRepository.findByUser(userId);

      if (!userCompetencies || userCompetencies.length === 0) {
        return {
          userId: userId,
          relevanceScore: 0,
          competencies: []
        };
      }

      // Build competency hierarchy
      const nodes = new Map();

      for (const userComp of userCompetencies) {
        const competency = await competencyRepository.findById(userComp.competency_id);
        if (!competency) continue;

        // Get parent relationships
        const parentLinks = await competencyRepository.getParentCompetencies(userComp.competency_id);
        const parentId = parentLinks.length > 0 ? parentLinks[0].competency_id : null;

        const node = {
          competencyId: userComp.competency_id,
          competencyName: competency.competency_name,
          level: userComp.proficiency_level || 'undefined',
          coverage: userComp.coverage_percentage || 0,
          parentId: parentId,
          children: []
        };

        nodes.set(userComp.competency_id, node);
      }

      // Build parent-child relationships
      for (const [id, node] of nodes.entries()) {
        if (node.parentId && nodes.has(node.parentId)) {
          const parent = nodes.get(node.parentId);
          parent.children.push(node);
        }
      }

      // Get root nodes (no parent)
      const roots = Array.from(nodes.values()).filter(node => !node.parentId);

      // Serialize node hierarchy (recursive)
      const serializeNode = (node) => {
        const base = {
          competencyId: node.competencyId,
          competencyName: node.competencyName,
          level: node.level,
          coverage: node.coverage
        };

        const childNodes = (node.children || []).map(serializeNode);
        if (childNodes.length > 0) {
          base.children = childNodes;
        }

        return base;
      };

      const competencies = roots.map(serializeNode);

      // Build final payload
      const payload = {
        userId: userId,
        relevanceScore: 0,
        competencies: competencies
      };

      return payload;
    } catch (error) {
      console.error(
        '[VerificationService.buildUpdatedProfilePayload] Error building profile payload',
        { userId, error: error.message }
      );
      // Return minimal payload on error
      return {
        userId: userId,
        relevanceScore: 0,
        competencies: []
      };
    }
  }
}

module.exports = new VerificationService();


