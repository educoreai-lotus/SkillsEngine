/**
 * Gap Analysis Service
 * 
 * Calculates skill gaps for users based on competency requirements.
 * Feature 5: Gap Analysis
 */

const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const userCareerPathRepository = require('../repositories/userCareerPathRepository');
const competencyService = require('./competencyService');
const skillRepository = require('../repositories/skillRepository');

class GapAnalysisService {
  /**
   * Calculate gap analysis for a user
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID (optional, if not provided, calculate for all)
   * @returns {Promise<Object>} Gap analysis result
   */
  async calculateGapAnalysis(userId, competencyId = null) {
    const userCompetencies = competencyId
      ? [await userCompetencyRepository.findByUserAndCompetency(userId, competencyId)]
      : await userCompetencyRepository.findByUser(userId);

    const gaps = {};

    for (const userComp of userCompetencies) {
      if (!userComp) continue;

      // Get required MGS for this competency
      const requiredMGS = await competencyService.getRequiredMGS(userComp.competency_id);
      const requiredMGSIds = new Set(requiredMGS.map(mgs => mgs.skill_id));

      // Get verified skills from userCompetency
      const verifiedSkillIds = new Set(
        (userComp.verifiedSkills || []).map(skill => skill.skill_id)
      );

      // Calculate missing MGS
      const missingMGS = requiredMGS.filter(mgs => !verifiedSkillIds.has(mgs.skill_id));

      // Group missing MGS by competency (for nested competencies)
      const missingByCompetency = {};
      for (const mgs of missingMGS) {
        // Find which competency this MGS belongs to
        const competency = await this.findCompetencyForMGS(mgs.skill_id, userComp.competency_id);
        const compName = competency?.competency_name || 'Unknown';
        
        if (!missingByCompetency[compName]) {
          missingByCompetency[compName] = [];
        }
        missingByCompetency[compName].push({
          skill_id: mgs.skill_id,
          skill_name: mgs.skill_name
        });
      }

      gaps[userComp.competency_id] = {
        competency_id: userComp.competency_id,
        required_mgs_count: requiredMGS.length,
        verified_mgs_count: verifiedSkillIds.size,
        missing_mgs_count: missingMGS.length,
        missing_mgs: missingByCompetency,
        coverage_percentage: userComp.coverage_percentage
      };
    }

    return gaps;
  }

  /**
   * Find which competency a MGS belongs to
   * @param {string} mgsId - MGS skill ID
   * @param {string} rootCompetencyId - Root competency ID
   * @returns {Promise<Object|null>} Competency object
   */
  async findCompetencyForMGS(mgsId, rootCompetencyId) {
    // Get all competencies that require this skill
    const competencies = await competencyService.getCompetenciesBySkill(mgsId);
    
    // Find the one that matches or is a child of rootCompetencyId
    for (const comp of competencies) {
      if (comp.competency_id === rootCompetencyId) {
        return comp;
      }
      
      // Check if it's a child of rootCompetencyId
      const hierarchy = await competencyService.getCompetencyHierarchy(rootCompetencyId);
      if (hierarchy && hierarchy.children) {
        const child = hierarchy.children.find(c => c.competency_id === comp.competency_id);
        if (child) {
          return comp;
        }
      }
    }

    return null;
  }

  /**
   * Calculate gap analysis for all user competencies
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Gap analysis for all competencies
   */
  async calculateAllGaps(userId) {
    return await this.calculateGapAnalysis(userId);
  }

  /**
   * Calculate career path gap analysis
   * Compares user's verified skills against their career path competencies
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Career path gap analysis with missing skills per competency
   */
  async calculateCareerPathGap(userId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    // Get user's career paths
    const careerPaths = await userCareerPathRepository.findByUser(userId);

    if (!careerPaths || careerPaths.length === 0) {
      return {
        success: true,
        user_id: userId,
        career_paths: [],
        total_required_skills: 0,
        total_verified_skills: 0,
        total_missing_skills: 0,
        overall_progress_percentage: 0,
        gaps: {}
      };
    }

    // Get all user competencies to find verified skills
    const userCompetencies = await userCompetencyRepository.findByUser(userId);

    // Build a set of all verified skill IDs from user competencies
    const allVerifiedSkillIds = new Set();
    for (const userComp of userCompetencies) {
      const verifiedSkills = userComp.verifiedSkills || [];
      for (const skill of verifiedSkills) {
        if (skill.verified !== false) {
          allVerifiedSkillIds.add(skill.skill_id);
        }
      }
    }

    const gaps = {};
    let totalRequiredSkills = 0;
    let totalMissingSkills = 0;

    // For each career path competency, calculate the gap
    for (const careerPath of careerPaths) {
      const competencyId = careerPath.competency_id;
      const competencyName = careerPath.competency_name || 'Unknown';

      try {
        // Get required MGS for this competency
        const requiredMGS = await competencyService.getRequiredMGS(competencyId);

        // Find missing skills (required but not verified)
        const missingSkills = requiredMGS.filter(
          mgs => !allVerifiedSkillIds.has(mgs.skill_id)
        );

        // Find verified skills for this competency
        const verifiedSkills = requiredMGS.filter(
          mgs => allVerifiedSkillIds.has(mgs.skill_id)
        );

        const requiredCount = requiredMGS.length;
        const verifiedCount = verifiedSkills.length;
        const missingCount = missingSkills.length;
        const progressPercentage = requiredCount > 0
          ? Math.round((verifiedCount / requiredCount) * 100 * 100) / 100
          : 0;

        totalRequiredSkills += requiredCount;
        totalMissingSkills += missingCount;

        gaps[competencyId] = {
          competency_id: competencyId,
          competency_name: competencyName,
          required_skills_count: requiredCount,
          verified_skills_count: verifiedCount,
          missing_skills_count: missingCount,
          progress_percentage: progressPercentage,
          missing_skills: missingSkills.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name,
            description: skill.description || null
          })),
          verified_skills: verifiedSkills.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name
          }))
        };
      } catch (error) {
        console.error(`[GapAnalysisService] Error calculating gap for competency ${competencyId}:`, error.message);
        gaps[competencyId] = {
          competency_id: competencyId,
          competency_name: competencyName,
          error: error.message
        };
      }
    }

    const totalVerifiedSkills = totalRequiredSkills - totalMissingSkills;
    const overallProgress = totalRequiredSkills > 0
      ? Math.round((totalVerifiedSkills / totalRequiredSkills) * 100 * 100) / 100
      : 0;

    return {
      success: true,
      user_id: userId,
      career_paths: careerPaths.map(cp => ({
        competency_id: cp.competency_id,
        competency_name: cp.competency_name,
        created_at: cp.created_at
      })),
      total_required_skills: totalRequiredSkills,
      total_verified_skills: totalVerifiedSkills,
      total_missing_skills: totalMissingSkills,
      overall_progress_percentage: overallProgress,
      gaps: gaps
    };
  }
}

module.exports = new GapAnalysisService();


