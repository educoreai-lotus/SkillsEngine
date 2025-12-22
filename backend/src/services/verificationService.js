/**
 * Verification Service
 * 
 * Handles skill verification from exam results.
 * Features 3.1, 3.2, 3.3: Baseline and Post-Course Exam Verification
 */

const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const userSkillRepository = require('../repositories/userSkillRepository');
const userCareerPathRepository = require('../repositories/userCareerPathRepository');
const competencyService = require('./competencyService');
const skillRepository = require('../repositories/skillRepository');
const competencyRepository = require('../repositories/competencyRepository');
const gapAnalysisService = require('./gapAnalysisService');
const learnerAIMSClient = require('./learnerAIMSClient');
const directoryMSClient = require('./directoryMSClient');
const userService = require('./userService');

class VerificationService {
  /**
   * Process baseline exam results (Feature 3.2)
   * @param {string} userId - User ID
   * @param {Object} examResults - Exam results from Assessment MS
   * @param {Object} [options] - Additional options (examType, examStatus, courseName)
   * @returns {Promise<Object>} Updated profile + gap analysis metadata
   */
  async processBaselineExamResults(userId, examResults, options = {}) {
    const {
      examType = 'baseline',
      examStatus = null,
      courseName = null
    } = options;

    // Extract exam metadata
    const finalGrade = examResults?.final_grade || examResults?.finalGrade || null;
    const examId = examResults?.exam_id || examResults?.examId || null;
    const passingGrade = examResults?.passing_grade || examResults?.passingGrade || null;
    const passed = examResults?.passed;
    const examStatusFromResults = typeof passed === 'boolean' ? (passed ? 'passed' : 'failed') : null;
    // For baseline exams, always set exam status to "failed" for Learner AI
    // Baseline exams are diagnostic and should be treated as failed for gap analysis purposes
    const normalizedExamStatus = examType === 'baseline' ? 'failed' : (examStatus || examStatusFromResults);

    // Log exam metadata if provided
    if (examId || finalGrade !== null || passingGrade !== null || courseName) {
      console.log(
        '[VerificationService.processBaselineExamResults] Processing baseline exam',
        {
          userId,
          examType,
          courseName,
          examId,
          finalGrade,
          passingGrade,
          passed,
          examStatus: normalizedExamStatus
        }
      );
    }

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
      // Accepted input format:
      //   - { skill_id, skill_name, status: "acquired" | "failed", score: number }
      // We normalize to JSON shape: { skill_id, skill_name, verified, score? }
      // and only persist leaf / MGS skills with status "acquired".
      console.log("test tset");
      const normalizeVerifiedSkill = async (rawSkill) => {
        if (!rawSkill || !rawSkill.skill_id) {
          return null;
        }

        const { skill_id, skill_name, score } = rawSkill;

        // Determine status from "status" string (values: "acquired" or "failed")
        let skillStatus = null;
        if (typeof rawSkill.status === 'string') {
          skillStatus = rawSkill.status.toLowerCase().trim();
        }

        // If we still don't know the status, skip this entry
        if (!skillStatus) {
          return null;
        }

        // Only process MGS that are effectively "acquired"
        if (skillStatus !== 'acquired') {
          return null; // Skip skills that are "failed" or have invalid status
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

        const normalized = {
          skill_id,
          skill_name,
          verified: true // Only MGS with status "acquired" are added
        };

        // Include score if provided (optional field)
        if (typeof score === 'number' && !isNaN(score)) {
          normalized.score = score;
        }

        return normalized;
      };

      for (const rawVerifiedSkill of verifiedSkillsInput) {
        try {
          const normalized = await normalizeVerifiedSkill(rawVerifiedSkill);

          // If the skill is not a leaf or invalid, ignore it for verifiedSkills persistence
          if (!normalized) {
            continue;
          }

          const { skill_id, skill_name, score, verified } = normalized;

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

          // Deduplicate by competency_id to ensure aliases (which point to same competency_id) 
          // are not treated as separate competencies
          const uniqueCompetenciesMap = new Map();
          for (const competency of competencies) {
            if (competency && competency.competency_id) {
              // Use competency_id as key to ensure uniqueness (aliases share same competency_id)
              uniqueCompetenciesMap.set(competency.competency_id, competency);
            }
          }
          const uniqueCompetencies = Array.from(uniqueCompetenciesMap.values());

          // Extra safety: only update competencies for which this skill_id
          // is actually part of their required MGS set.
          const filteredCompetencies = [];
          for (const competency of uniqueCompetencies) {
            try {
              const requiredMGS = await competencyService.getRequiredMGS(competency.competency_id);
              const isRequired = requiredMGS.some(mgs => mgs.skill_id === skill_id);
              if (!isRequired) {
                // Skip competencies that do not explicitly require this MGS
                console.log(
                  '[VerificationService.processBaselineExamResults] Skipping competency - skill not in required MGS',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name,
                    requiredMGS_count: requiredMGS.length
                  }
                );
                continue;
              }
              filteredCompetencies.push(competency);
            } catch (err) {
              console.warn(
                '[VerificationService.processBaselineExamResults] Failed to validate MGS requirement for competency - skipping',
                {
                  userId,
                  skill_id,
                  skill_name,
                  competency_id: competency.competency_id,
                  competency_name: competency.competency_name,
                  error: err.message
                }
              );
              // Be conservative: skip this competency if validation fails
            }
          }

          if (filteredCompetencies.length === 0 && uniqueCompetencies.length > 0) {
            console.warn(
              '[VerificationService.processBaselineExamResults] No competencies passed MGS validation for skill',
              {
                userId,
                skill_id,
                skill_name,
                found_competencies_count: uniqueCompetencies.length,
                found_competency_names: uniqueCompetencies.map(c => c.competency_name)
              }
            );
          }

          for (const competency of filteredCompetencies) {
            try {
              let userComp = await userCompetencyRepository.findByUserAndCompetency(
                userId,
                competency.competency_id
              );

              if (!userComp) {
                // For baseline exams, only update competencies the user already owns
                // Don't create new competencies - baseline is diagnostic, not for learning new competencies
                console.log(
                  '[VerificationService.processBaselineExamResults] Skipping competency - user does not own it (baseline exam only updates existing competencies)',
                  {
                    userId,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name,
                    skill_id,
                    skill_name
                  }
                );
                continue; // Skip competencies the user doesn't own for baseline exams
              }

              // Double-check: Verify the skill is actually in the required MGS before adding
              // This is a safety check to prevent adding skills to wrong competencies
              let finalRequiredMGS = [];
              try {
                finalRequiredMGS = await competencyService.getRequiredMGS(competency.competency_id);
                const isActuallyRequired = finalRequiredMGS.some(mgs => mgs.skill_id === skill_id);
                if (!isActuallyRequired) {
                  console.error(
                    '[VerificationService.processBaselineExamResults] CRITICAL: Skill not in required MGS - skipping skill addition',
                    {
                      userId,
                      skill_id,
                      skill_name,
                      competency_id: competency.competency_id,
                      competency_name: competency.competency_name,
                      requiredMGS_count: finalRequiredMGS.length,
                      requiredMGS_ids: finalRequiredMGS.map(m => m.skill_id)
                    }
                  );
                  continue; // Skip adding this skill to this competency
                }
              } catch (err) {
                console.error(
                  '[VerificationService.processBaselineExamResults] Error in final MGS validation - skipping skill addition',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name,
                    error: err.message
                  }
                );
                continue; // Skip if validation fails
              }

              // Update verifiedSkills array
              const verifiedSkills = userComp.verifiedSkills || [];
              const existingIndex = verifiedSkills.findIndex(s => s.skill_id === skill_id);

              // Persist JSON shape in verifiedSkills (score is not included)
              const verifiedSkillData = {
                skill_id,
                skill_name,
                verified,
              };

              if (existingIndex >= 0) {
                verifiedSkills[existingIndex] = verifiedSkillData;
                console.log(
                  '[VerificationService.processBaselineExamResults] Updated existing skill in verifiedSkills',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name
                  }
                );
              } else {
                verifiedSkills.push(verifiedSkillData);
                console.log(
                  '[VerificationService.processBaselineExamResults] Added new skill to verifiedSkills',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name
                  }
                );
              }

              // Recalculate coverage percentage using in-memory verifiedSkills
              // This avoids a race where calculateCoverage() re-reads from DB
              // before the latest verifiedSkills have been persisted.
              let coverage = 0;
              try {
                // Get required MGS for this competency (reuse finalRequiredMGS from validation above)
                const requiredMGS = finalRequiredMGS.length > 0 ? finalRequiredMGS : await competencyService.getRequiredMGS(competency.competency_id);
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
        // Get user name and career path for gap analysis context
        let userName = null;
        let careerPath = null;
        try {
          const userProfile = await userService.getUserProfile(userId);
          const user = userProfile?.user || userProfile;
          userName = user?.user_name || null;
          careerPath = user?.path_career || null;
        } catch (err) {
          console.warn(
            '[VerificationService.processBaselineExamResults] Error fetching user profile for gap analysis context',
            { userId, error: err.message }
          );
          // Continue without user name/career path if fetch fails
        }

        gapAnalysis = await this.runGapAnalysis(userId, updatedCompetencies, {
          examType,
          examStatus: normalizedExamStatus,
          courseName: courseName || careerPath,
          userName
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
        const errorDetails = {
          userId,
          examType,
          error: err.message,
          stack: err.stack
        };

        // Include additional error details if available
        if (err.response) {
          errorDetails.status = err.response.status;
          errorDetails.statusText = err.response.statusText;
          errorDetails.responseData = err.response.data;
        } else if (err.request) {
          errorDetails.requestError = 'No response received';
        }

        if (err.code) {
          errorDetails.code = err.code;
        }

        console.warn(
          '[VerificationService.processBaselineExamResults] Failed to send updated profile to Directory MS',
          errorDetails
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
    // skills array (or verified_skills) only contains skills with status "acquired" (failed skills are not included)
    const { course_name, exam_type, exam_status } = examResults || {};

    // Extract exam metadata
    const finalGrade = examResults?.final_grade || examResults?.finalGrade || null;
    const examId = examResults?.exam_id || examResults?.examId || null;
    const passingGrade = examResults?.passing_grade || examResults?.passingGrade || null;
    const passed = examResults?.passed;
    const examStatusFromResults = typeof passed === 'boolean' ? (passed ? 'passed' : 'failed') : null;
    const normalizedExamStatus = exam_status || examStatusFromResults;
    const examType = exam_type || 'postcourse';

    // Log exam metadata if provided
    if (examId || finalGrade !== null || passingGrade !== null || course_name) {
      console.log(
        '[VerificationService.processPostCourseExamResults] Processing post-course exam',
        {
          userId,
          examType,
          courseName: course_name,
          examId,
          finalGrade,
          passingGrade,
          passed,
          examStatus: normalizedExamStatus
        }
      );
    }

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
      // Accepted input format:
      //   - { skill_id, skill_name, status: "acquired" | "failed", score: number }
      // Or (post-course only): { skill_name, status, score } when skill_id is omitted.
      // We normalize to JSON shape: { skill_id, skill_name, verified, score? }
      // and only persist leaf / MGS skills with status "acquired".
      const normalizeVerifiedSkill = async (rawSkill) => {
        if (!rawSkill) {
          return null;
        }

        // Extract basic fields from payload
        const { score } = rawSkill;

        // 1) Resolve skill_id / skill_name
        //    - Preferred: payload already contains skill_id
        //    - Fallback: payload contains skill_name + status (no skill_id)
        let skill_id = rawSkill.skill_id || null;
        let skill_name = rawSkill.skill_name || null;

        // If skill_id is missing but we have a skill_name, try to resolve it via Skill Repository
        if (!skill_id && typeof skill_name === 'string' && skill_name.trim().length > 0) {
          try {
            const skillRecord = await skillRepository.findByName(skill_name);

            if (!skillRecord) {
              console.warn(
                '[VerificationService.processPostCourseExamResults] No skill found for name - skipping skill',
                { userId, skill_name }
              );
              return null;
            }

            // Use canonical values from DB
            skill_id = skillRecord.skill_id;
            skill_name = skillRecord.skill_name;
          } catch (err) {
            console.error(
              '[VerificationService.processPostCourseExamResults] Error resolving skill by name - skipping skill',
              { userId, skill_name, error: err.message }
            );
            return null;
          }
        }

        // If we still don't have a valid skill_id, skip this entry
        if (!skill_id) {
          console.warn(
            '[VerificationService.processPostCourseExamResults] Missing skill_id and unable to resolve from name - skipping skill',
            { userId, rawSkill }
          );
          return null;
        }

        // 2) Determine status from "status" string (values: "acquired" or "failed")
        let skillStatus = null;
        if (typeof rawSkill.status === 'string') {
          skillStatus = rawSkill.status.toLowerCase().trim();
        }

        // If we still don't know the status, skip this entry
        if (!skillStatus) {
          return null;
        }

        // 3) Only process MGS that are effectively "acquired"
        if (skillStatus !== 'acquired') {
          return null; // Skip skills that are "failed" or have invalid status
        }

        // 4) Ensure we only persist MGS / leaf skills in verifiedSkills
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
            '[VerificationService.processPostCourseExamResults] Failed to check leaf for skill',
            { skill_id, error: err.message }
          );
          return null;
        }

        const normalized = {
          skill_id,
          skill_name,
          verified: true // Only MGS with status "acquired" are added
        };

        // Include score if provided (optional field)
        if (typeof score === 'number' && !isNaN(score)) {
          normalized.score = score;
        }

        return normalized;
      };

      for (const rawVerifiedSkill of verifiedSkillsInput) {
        try {
          const normalized = await normalizeVerifiedSkill(rawVerifiedSkill);

          // If the skill is not a leaf or invalid, ignore it for verifiedSkills persistence
          if (!normalized) {
            continue;
          }

          const { skill_id, skill_name, score, verified } = normalized;

          // Find competencies that require this skill
          // Note: getCompetenciesBySkill works for leaf skills (MGS) by traversing
          // up the skill hierarchy to find competencies linked at any level
          let competencies = [];
          try {
            competencies = await competencyService.getCompetenciesBySkill(skill_id);
          } catch (err) {
            console.error(
              '[VerificationService.processPostCourseExamResults] Error finding competencies for skill',
              { skill_id, error: err.message }
            );
            // Skip this skill if we can't find competencies
            continue;
          }

          // Deduplicate by competency_id to ensure aliases (which point to same competency_id) 
          // are not treated as separate competencies
          const uniqueCompetenciesMap = new Map();
          for (const competency of competencies) {
            if (competency && competency.competency_id) {
              // Use competency_id as key to ensure uniqueness (aliases share same competency_id)
              uniqueCompetenciesMap.set(competency.competency_id, competency);
            }
          }
          const uniqueCompetencies = Array.from(uniqueCompetenciesMap.values());

          // Extra safety: only update competencies for which this skill_id
          // is actually part of their required MGS set.
          const filteredCompetencies = [];
          for (const competency of uniqueCompetencies) {
            try {
              const requiredMGS = await competencyService.getRequiredMGS(competency.competency_id);
              const isRequired = requiredMGS.some(mgs => mgs.skill_id === skill_id);
              if (!isRequired) {
                // Skip competencies that do not explicitly require this MGS
                console.log(
                  '[VerificationService.processPostCourseExamResults] Skipping competency - skill not in required MGS',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name,
                    requiredMGS_count: requiredMGS.length
                  }
                );
                continue;
              }
              filteredCompetencies.push(competency);
            } catch (err) {
              console.warn(
                '[VerificationService.processPostCourseExamResults] Failed to validate MGS requirement for competency - skipping',
                {
                  userId,
                  skill_id,
                  skill_name,
                  competency_id: competency.competency_id,
                  competency_name: competency.competency_name,
                  error: err.message
                }
              );
              // Be conservative: skip this competency if validation fails
            }
          }

          if (filteredCompetencies.length === 0 && uniqueCompetencies.length > 0) {
            console.warn(
              '[VerificationService.processPostCourseExamResults] No competencies passed MGS validation for skill',
              {
                userId,
                skill_id,
                skill_name,
                found_competencies_count: uniqueCompetencies.length,
                found_competency_names: uniqueCompetencies.map(c => c.competency_name)
              }
            );
          }

          for (const competency of filteredCompetencies) {
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
                  console.log(
                    '[VerificationService.processPostCourseExamResults] Created new userCompetency for skill update',
                    {
                      userId,
                      competency_id: competency.competency_id,
                      competency_name: competency.competency_name,
                      skill_id,
                      skill_name
                    }
                  );
                } catch (err) {
                  console.error(
                    '[VerificationService.processPostCourseExamResults] Error creating userCompetency',
                    { userId, competency_id: competency.competency_id, error: err.message }
                  );
                  // Skip this competency if creation fails
                  continue;
                }
              }

              // Double-check: Verify the skill is actually in the required MGS before adding
              // This is a safety check to prevent adding skills to wrong competencies
              let finalRequiredMGS = [];
              try {
                finalRequiredMGS = await competencyService.getRequiredMGS(competency.competency_id);
                const isActuallyRequired = finalRequiredMGS.some(mgs => mgs.skill_id === skill_id);
                if (!isActuallyRequired) {
                  console.error(
                    '[VerificationService.processPostCourseExamResults] CRITICAL: Skill not in required MGS - skipping skill addition',
                    {
                      userId,
                      skill_id,
                      skill_name,
                      competency_id: competency.competency_id,
                      competency_name: competency.competency_name,
                      requiredMGS_count: finalRequiredMGS.length,
                      requiredMGS_ids: finalRequiredMGS.map(m => m.skill_id)
                    }
                  );
                  continue; // Skip adding this skill to this competency
                }
              } catch (err) {
                console.error(
                  '[VerificationService.processPostCourseExamResults] Error in final MGS validation - skipping skill addition',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name,
                    error: err.message
                  }
                );
                continue; // Skip if validation fails
              }

              // Update verifiedSkills array
              const verifiedSkills = userComp.verifiedSkills || [];
              const existingIndex = verifiedSkills.findIndex(s => s.skill_id === skill_id);

              // Persist JSON shape in verifiedSkills (score is not included)
              const verifiedSkillData = {
                skill_id,
                skill_name,
                verified,
              };

              if (existingIndex >= 0) {
                verifiedSkills[existingIndex] = verifiedSkillData;
                console.log(
                  '[VerificationService.processPostCourseExamResults] Updated existing skill in verifiedSkills',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name
                  }
                );
              } else {
                verifiedSkills.push(verifiedSkillData);
                console.log(
                  '[VerificationService.processPostCourseExamResults] Added new skill to verifiedSkills',
                  {
                    userId,
                    skill_id,
                    skill_name,
                    competency_id: competency.competency_id,
                    competency_name: competency.competency_name
                  }
                );
              }

              // Recalculate coverage percentage using in-memory verifiedSkills
              // This avoids a race where calculateCoverage() re-reads from DB
              // before the latest verifiedSkills have been persisted.
              let coverage = 0;
              try {
                // Get required MGS for this competency (reuse finalRequiredMGS from validation above)
                const requiredMGS = finalRequiredMGS.length > 0 ? finalRequiredMGS : await competencyService.getRequiredMGS(competency.competency_id);
                const requiredCount = requiredMGS.length;

                if (requiredCount === 0) {
                  coverage = 0;
                } else {
                  const verifiedCount = verifiedSkills.filter(s => s.verified === true).length;
                  coverage = Math.round((verifiedCount / requiredCount) * 100 * 100) / 100;
                }
              } catch (err) {
                console.warn(
                  '[VerificationService.processPostCourseExamResults] Error calculating coverage (in-memory)',
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
              } catch (err) {
                console.error(
                  '[VerificationService.processPostCourseExamResults] Error updating userCompetency',
                  { userId, competency_id: competency.competency_id, error: err.message }
                );
                // Continue processing other competencies
              }
            } catch (err) {
              console.error(
                '[VerificationService.processPostCourseExamResults] Error processing competency',
                { userId, competency_id: competency?.competency_id, error: err.message }
              );
              // Continue processing other competencies
            }
          }
        } catch (err) {
          console.error(
            '[VerificationService.processPostCourseExamResults] Error processing skill',
            { skill_id: rawVerifiedSkill?.skill_id, error: err.message }
          );
          // Continue processing other skills
        }
      }

      // Update all parent competencies after processing all child competencies
      // This prevents duplicate updates when multiple children share the same parent
      const visitedParents = new Set();
      for (const competencyId of updatedCompetencies) {
        try {
          await this.updateParentCompetencies(userId, competencyId, visitedParents);
        } catch (err) {
          console.warn(
            '[VerificationService.processPostCourseExamResults] Error updating parent competencies',
            { userId, competency_id: competencyId, error: err.message }
          );
          // Continue - parent update failure shouldn't fail the whole process
        }
      }

      let gapAnalysis = null;
      try {
        // Get user name and career path for gap analysis context
        let userName = null;
        let careerPath = null;
        try {
          const userProfile = await userService.getUserProfile(userId);
          const user = userProfile?.user || userProfile;
          userName = user?.user_name || null;
          careerPath = user?.path_career || user?.career_path_goal || null;
        } catch (err) {
          console.warn(
            '[VerificationService.processPostCourseExamResults] Error fetching user profile for gap analysis context',
            { userId, error: err.message }
          );
          // Continue without user name/career path if fetch fails
        }

        gapAnalysis = await this.runGapAnalysis(userId, updatedCompetencies, {
          examType,
          examStatus: normalizedExamStatus,
          courseName: course_name || careerPath,
          userName
        });
      } catch (err) {
        console.error(
          '[VerificationService.processPostCourseExamResults] Error running gap analysis',
          { userId, error: err.message }
        );
      }

      // Automatically send updated profile to Directory MS after processing exam results
      // This happens automatically whenever userCompetency is updated
      try {
        const updatedProfile = await this.buildUpdatedProfilePayload(userId);
        await directoryMSClient.sendUpdatedProfile(userId, updatedProfile);
        console.log(
          '[VerificationService.processPostCourseExamResults] Successfully sent updated profile to Directory MS',
          { userId, examType, competenciesUpdated: updatedCompetencies.size }
        );
      } catch (err) {
        // Don't fail exam processing if Directory MS update fails
        const errorDetails = {
          userId,
          examType,
          error: err.message,
          stack: err.stack
        };

        // Include additional error details if available
        if (err.response) {
          errorDetails.status = err.response.status;
          errorDetails.statusText = err.response.statusText;
          errorDetails.responseData = err.response.data;
        } else if (err.request) {
          errorDetails.requestError = 'No response received';
        }

        if (err.code) {
          errorDetails.code = err.code;
        }

        console.warn(
          '[VerificationService.processPostCourseExamResults] Failed to send updated profile to Directory MS',
          errorDetails
        );
      }

      // Return empty response - processing is complete
      return {};
    } catch (error) {
      // Log error but return partial results
      console.error(
        '[VerificationService.processPostCourseExamResults] Fatal error processing exam results',
        { userId, error: error.message, stack: error.stack }
      );
      // Return error message on failure
      return { message: error.message || 'Failed to process exam results' };
    }
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
   * @param {Object} context - { examType, examStatus, courseName, competency_target_name, userName, careerPath }
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
    // - Baseline Exam        -> Broad (all career path competencies)
    // - Post-course PASS     -> Broad (all career path competencies)
    // - Post-course FAIL     -> Narrow (career path competencies, filtered to updated ones only)
    // NOTE: After each exam, gap analysis always uses competencies from career path table
    let analysisType = 'broad';
    if (normalizedExamType === 'postcourse' && normalizedExamStatus === 'failed') {
      analysisType = 'narrow';
    }

    console.log('[VerificationService.runGapAnalysis] ===== STARTING GAP ANALYSIS =====', {
      userId,
      examType: normalizedExamType,
      examStatus: normalizedExamStatus,
      analysisType,
      courseName
    });

    let gaps = {};

    try {
      // Always use career path competencies from user_career_path table for both baseline and post-course exams
      const careerPaths = await userCareerPathRepository.findByUser(userId);
      if (!careerPaths || careerPaths.length === 0) {
        console.log(
          '[VerificationService.runGapAnalysis] User has no career path competencies; skipping gap analysis and Learner AI sync',
          { userId, examType: normalizedExamType, examStatus: normalizedExamStatus }
        );
        gaps = {};
      } else {
        console.log('[VerificationService.runGapAnalysis] Calling calculateCareerPathGap for all career path competencies', {
          userId,
          careerPathCount: careerPaths.length
        });
        // Always calculate gap analysis for all career path competencies
        const allCareerPathGaps = await gapAnalysisService.calculateCareerPathGap(userId);

        // Both broad and narrow analysis return all career path gaps
        // Narrow analysis still shows all missing skills in career path competencies
        gaps = allCareerPathGaps;
        console.log('[VerificationService.runGapAnalysis] Gap analysis (all career path competencies)', {
          userId,
          examType: normalizedExamType,
          analysisType,
          gapKeys: Object.keys(gaps)
        });
      }
    } catch (error) {
      console.error(
        '[VerificationService.runGapAnalysis] Error calculating gap analysis',
        { userId, examType: normalizedExamType, examStatus: normalizedExamStatus, error: error.message }
      );
      gaps = {};
    }

    // Best-effort: log and send gap analysis to Learner AI MS
    // NOTE: Baseline exams do NOT send gap analysis to Learner AI
    if (normalizedExamType === 'baseline') {
      console.log(
        '[VerificationService.runGapAnalysis] Skipping Learner AI send for baseline exam',
        { userId, analysisType, gapKeys: Object.keys(gaps) }
      );
    } else {
      // Post-course exams: send gap analysis to Learner AI
      try {
        if (Object.keys(gaps).length > 0) {
          const serializedGaps = JSON.stringify(gaps, null, 2);
          console.log(
            '[VerificationService.runGapAnalysis] Gaps payload before sending to Learner AI MS',
            {
              userId,
              analysisType,
              examType: normalizedExamType,
              examStatus: normalizedExamStatus,
              gaps: serializedGaps
            }
          );
          // Use competency_target_name if provided, otherwise fall back to courseName
          const targetName = context.competency_target_name || courseName;
          // For baseline exams, always send exam status as "failed" for Learner AI
          // Baseline exams are diagnostic and should be treated as failed for gap analysis
          // const examStatusForLearnerAI = normalizedExamType === 'baseline' ? 'failed' : normalizedExamStatus;
          const examStatusForLearnerAI = normalizedExamStatus;
          await learnerAIMSClient.sendGapAnalysis(
            userId,
            gaps,
            analysisType,
            targetName,
            examStatusForLearnerAI
          );
        } else {
          console.log(
            '[VerificationService.runGapAnalysis] No gaps to send to Learner AI MS',
            { userId, analysisType, examType: normalizedExamType, examStatus: normalizedExamStatus }
          );
        }
      } catch (error) {
        // Do not fail exam processing if Learner AI is unavailable
        console.warn(
          '[VerificationService.runGapAnalysis] Failed to send gap analysis to Learner AI MS',
          { userId, error: error.message }
        );
      }
    }

    // COMMENTED OUT: Baseline exam gap analysis sending to Learner AI
    // try {
    //   if (Object.keys(gaps).length > 0) {
    //     const serializedGaps = JSON.stringify(gaps, null, 2);
    //     console.log(
    //       '[VerificationService.runGapAnalysis] Gaps payload before sending to Learner AI MS',
    //       {
    //         userId,
    //         analysisType,
    //         examType: normalizedExamType,
    //         examStatus: normalizedExamStatus,
    //         gaps: serializedGaps
    //       }
    //     );
    //     // Use competency_target_name if provided, otherwise fall back to courseName
    //     const targetName = context.competency_target_name || courseName;
    //     // For baseline exams, always send exam status as "failed" for Learner AI
    //     // Baseline exams are diagnostic and should be treated as failed for gap analysis
    //     const examStatusForLearnerAI = normalizedExamType === 'baseline' ? 'failed' : normalizedExamStatus;
    //     await learnerAIMSClient.sendGapAnalysis(
    //       userId,
    //       gaps,
    //       analysisType,
    //       targetName,
    //       examStatusForLearnerAI
    //     );
    //   } else {
    //     console.log(
    //       '[VerificationService.runGapAnalysis] No gaps to send to Learner AI MS',
    //       { userId, analysisType, examType: normalizedExamType, examStatus: normalizedExamStatus }
    //     );
    //   }
    // } catch (error) {
    //   // Do not fail exam processing if Learner AI is unavailable
    //   console.warn(
    //     '[VerificationService.runGapAnalysis] Failed to send gap analysis to Learner AI MS',
    //     { userId, error: error.message }
    //   );
    // }

    return {
      analysis_type: analysisType,
      exam_type: normalizedExamType,
      exam_status: normalizedExamStatus,
      competency_target_name: context.competency_target_name || courseName,
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

    // Batch fetch all user competencies for children in a single query
    const childCompetencyIds = childCompetencies.map(c => c.competency_id);
    const childUserCompsMap = await userCompetencyRepository.findByUserAndCompetencies(userId, childCompetencyIds);

    // Aggregate coverage from all child competencies
    let totalRequiredMGS = 0;
    let totalVerifiedMGS = 0;

    // Process all children (can be parallelized if needed, but sequential is fine for now)
    for (const child of childCompetencies) {
      const childRequiredMGS = await competencyService.getRequiredMGS(child.competency_id);
      const childUserComp = childUserCompsMap.get(child.competency_id);

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
   * @param {Set<string>} visited - Set of already visited competency IDs (to prevent duplicate updates)
   * @returns {Promise<void>}
   */
  async updateParentCompetencies(userId, childCompetencyId, visited = new Set()) {
    try {
      // Prevent infinite loops and duplicate updates
      if (visited.has(childCompetencyId)) {
        console.log(
          '[VerificationService.updateParentCompetencies] Skipping already visited competency',
          { childCompetencyId, visited: Array.from(visited) }
        );
        return;
      }
      visited.add(childCompetencyId);

      // Find all parent competencies (traversing up the hierarchy)
      // Note: getParentCompetencies returns ALL parents in the chain (immediate, grandparent, etc.)
      const parentCompetencies = await competencyRepository.getParentCompetencies(childCompetencyId);

      if (parentCompetencies.length === 0) {
        return;
      }

      // Batch fetch all parent user competencies in a single query
      const parentCompetencyIds = parentCompetencies.map(p => p.competency_id);
      const parentUserCompsMap = await userCompetencyRepository.findByUserAndCompetencies(userId, parentCompetencyIds);

      // Process parents from bottom to top (immediate parent first, then grandparents)
      // Since getParentCompetencies already returns ALL parents in the chain,
      // we process them all in one pass without recursion
      for (const parent of parentCompetencies) {
        // Mark as visited BEFORE processing to prevent duplicate processing
        // This is critical because the same parent might be reached via different paths
        if (visited.has(parent.competency_id)) {
          console.log(
            '[VerificationService.updateParentCompetencies] Skipping already processed parent',
            { parent_competency_id: parent.competency_id, parent_competency_name: parent.competency_name }
          );
          continue;
        }
        visited.add(parent.competency_id);

        // Check if user owns this parent competency
        let parentUserComp = parentUserCompsMap.get(parent.competency_id);

        // If user doesn't own this parent competency, skip it.
        // We only aggregate coverage for parents that already exist for the user.
        if (!parentUserComp) {
          console.log(
            '[VerificationService.updateParentCompetencies] Skipping parent competency - user does not own it',
            {
              userId,
              parent_competency_id: parent.competency_id,
              parent_competency_name: parent.competency_name,
              child_competency_id: childCompetencyId
            }
          );
          continue;
        }

        // Recalculate parent coverage by aggregating from all child competencies
        const parentCoverage = await this.calculateParentCoverage(userId, parent.competency_id);
        const parentProficiencyLevel = this.mapCoverageToProficiency(parentCoverage);

        // Update parent userCompetency
        await userCompetencyRepository.update(userId, parent.competency_id, {
          coverage_percentage: parentCoverage,
          proficiency_level: parentProficiencyLevel
        });

        console.log(
          '[VerificationService.updateParentCompetencies] Updated parent competency',
          {
            userId,
            parent_competency_id: parent.competency_id,
            parent_competency_name: parent.competency_name,
            coverage: parentCoverage,
            proficiency_level: parentProficiencyLevel
          }
        );
      }
    } catch (error) {
      // Log error but don't fail the entire process
      console.error(
        '[VerificationService.updateParentCompetencies] Error updating parent competencies',
        { userId, childCompetencyId, error: error.message, stack: error.stack }
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

      // Build competency hierarchy (similar to buildInitialProfile)
      // Include parent competencies in hierarchy even if user doesn't own them directly
      const nodes = new Map();

      // Helper to ensure we have a node for a competency_id (with name loaded once)
      const ensureNode = async (competencyId) => {
        if (!competencyId) return null;
        let node = nodes.get(competencyId);
        if (node) {
          return node;
        }

        const competency = await competencyRepository.findById(competencyId);
        if (!competency) {
          return null;
        }

        // Check if user owns this competency
        const userComp = await userCompetencyRepository.findByUserAndCompetency(userId, competencyId);

        // Ensure coverage_percentage is properly included (handle null/undefined but preserve 0.00)
        let coverage = 0;
        if (userComp) {
          // Use actual value from database, default to 0 only if null/undefined
          coverage = (userComp.coverage_percentage !== null && userComp.coverage_percentage !== undefined)
            ? userComp.coverage_percentage
            : 0;
        }

        node = {
          competencyId: competency.competency_id,
          competencyName: competency.competency_name,
          level: userComp ? (userComp.proficiency_level || 'undefined') : 'undefined',
          coverage: coverage,
          parentId: null,
          children: []
        };
        nodes.set(competencyId, node);
        return node;
      };

      // Seed nodes with user-owned competencies
      for (const userComp of userCompetencies) {
        if (!userComp) continue;

        const node = await ensureNode(userComp.competency_id);
        if (!node) continue;

        node.level = userComp.proficiency_level || 'undefined';

        // Ensure coverage_percentage is properly included (handle null/undefined but preserve 0.00)
        // Use actual value from database, default to 0 only if null/undefined
        node.coverage = (userComp.coverage_percentage !== null && userComp.coverage_percentage !== undefined)
          ? userComp.coverage_percentage
          : 0;

        // Log coverage value for debugging
        if (userComp.coverage_percentage !== null && userComp.coverage_percentage !== undefined && userComp.coverage_percentage > 0) {
          console.log(
            '[VerificationService.buildUpdatedProfilePayload] Including coverage_percentage in profile',
            {
              userId,
              competency_id: userComp.competency_id,
              coverage_percentage: userComp.coverage_percentage
            }
          );
        }

        // Walk up the competency_subcompetency chain and attach parents
        try {
          const parents = await competencyRepository.getParentCompetencies(userComp.competency_id);

          // parents[0] is the immediate parent, then its parent, etc.
          let childId = userComp.competency_id;
          for (const parent of parents) {
            const parentNode = await ensureNode(parent.competency_id);
            const childNode = await ensureNode(childId);

            if (parentNode && childNode && !childNode.parentId) {
              childNode.parentId = parentNode.competencyId;
            }

            childId = parent.competency_id;
          }
        } catch (err) {
          console.warn(
            '[VerificationService.buildUpdatedProfilePayload] Failed to load parent competencies',
            { competency_id: userComp.competency_id, error: err.message }
          );
        }
      }

      // Build children arrays based on parentId links
      for (const node of nodes.values()) {
        node.children = [];
      }
      for (const node of nodes.values()) {
        if (node.parentId) {
          const parentNode = nodes.get(node.parentId);
          if (parentNode) {
            parentNode.children.push(node);
          }
        }
      }

      // Get root nodes (no parent)
      const roots = Array.from(nodes.values()).filter(node => !node.parentId);

      // Serialize + prune node hierarchy (recursive)
      // We drop leaf nodes that have no coverage and no children so that
      // "deleted" / empty competencies are not sent to Directory MS.
      const serializeNode = (node) => {
        const childNodes = (node.children || [])
          .map(serializeNode)
          .filter(child => child !== null);

        const hasChildren = childNodes.length > 0;
        const hasCoverage =
          typeof node.coverage === 'number'
            ? node.coverage > 0
            : !!node.coverage;

        // If this node has no coverage and no (kept) children, drop it
        if (!hasCoverage && !hasChildren) {
          return null;
        }

        const base = {
          competencyId: node.competencyId,
          competencyName: node.competencyName,
          level: node.level,
          coverage: node.coverage
        };

        if (hasChildren) {
          base.children = childNodes;
        }

        return base;
      };

      const competencies = roots
        .map(serializeNode)
        .filter(node => node !== null);

      // Build final payload
      const payload = {
        userId: userId,
        relevanceScore: 0,
        competencies: competencies
      };

      // Log coverage values to verify they're included correctly
      const competenciesWithCoverage = competencies.filter(c => c.coverage > 0);
      if (competenciesWithCoverage.length > 0) {
        console.log(
          '[VerificationService.buildUpdatedProfilePayload] Profile payload includes coverage_percentage',
          {
            userId,
            totalCompetencies: competencies.length,
            competenciesWithCoverage: competenciesWithCoverage.length,
            coverageValues: competenciesWithCoverage.map(c => ({
              competencyId: c.competencyId,
              competencyName: c.competencyName,
              coverage: c.coverage
            }))
          }
        );
      }

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


