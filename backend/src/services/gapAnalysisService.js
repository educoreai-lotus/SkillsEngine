/**
 * Gap Analysis Service
 * 
 * Calculates skill gaps for users based on competency requirements.
 * Feature 5: Gap Analysis
 */

const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const userCareerPathRepository = require('../repositories/userCareerPathRepository');
const competencyRepository = require('../repositories/competencyRepository');
const competencyService = require('./competencyService');
const skillRepository = require('../repositories/skillRepository');
const Logger = require('../utils/logger');

const logger = new Logger('GapAnalysisService');

class GapAnalysisService {
  /**
   * Calculate gap analysis for a user
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID (optional, if not provided, calculate for all)
   * @returns {Promise<Object>} Simple gap structure: { "Competency Name": [{ skill_id, skill_name }] }
   */
  async calculateGapAnalysis(userId, competencyId = null) {
    logger.info('Starting gap analysis calculation', { userId, competencyId });

    const userCompetencies = competencyId
      ? [await userCompetencyRepository.findByUserAndCompetency(userId, competencyId)]
      : await userCompetencyRepository.findByUser(userId);

    logger.info('Retrieved user competencies for gap analysis', {
      userId,
      competencyId,
      userCompetencyCount: userCompetencies?.length || 0
    });

    const allGaps = {};

    for (const userComp of userCompetencies) {
      if (!userComp) {
        logger.warn('Skipping null user competency', { userId, competencyId });
        continue;
      }

      // Get competency details
      const competency = await competencyService.getCompetencyById(userComp.competency_id);
      if (!competency) continue;

      // Get required MGS for this competency
      const requiredMGS = await competencyService.getRequiredMGS(userComp.competency_id);

      // Get verified skills from userCompetency
      const verifiedSkillIds = new Set(
        (userComp.verifiedSkills || []).map(skill => skill.skill_id)
      );

      // Calculate missing MGS
      const missingMGS = requiredMGS.filter(mgs => !verifiedSkillIds.has(mgs.skill_id));

      // Group missing MGS by sub-competency name (for nested competencies)
      const missingByCompetency = {};
      for (const mgs of missingMGS) {
        // Find which sub-competency this MGS belongs to
        const subCompetency = await this.findCompetencyForMGS(mgs.skill_id, userComp.competency_id);
        const compName = subCompetency?.competency_name || competency.competency_name;

        if (!missingByCompetency[compName]) {
          missingByCompetency[compName] = [];
        }
        missingByCompetency[compName].push({
          skill_id: mgs.skill_id,
          skill_name: mgs.skill_name
        });
      }

      // Merge into allGaps (competency name -> missing skills array)
      for (const [compName, skills] of Object.entries(missingByCompetency)) {
        if (!allGaps[compName]) {
          allGaps[compName] = [];
        }
        allGaps[compName].push(...skills);
      }
    }

    const competencyCount = Object.keys(allGaps).length;
    const totalMissingSkills = Object.values(allGaps).reduce((sum, skills) => sum + skills.length, 0);
    logger.info('Completed gap analysis calculation', {
      userId,
      gapSummary: Object.keys(allGaps).map(comp => ({
        competency: comp,
        missingSkillCount: allGaps[comp].length
      }))
    });

    return allGaps;
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
   * Calculate career path gap analysis
   * Compares user's verified skills against their career path competencies
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Simple gap structure: { "Competency Name": [{ skill_id, skill_name }] }
   */
  async calculateCareerPathGap(userId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    console.log('[GapAnalysisService] ===== STARTING GAP CALCULATION =====', { userId });

    // Get user's career paths
    const careerPaths = await userCareerPathRepository.findByUser(userId);
    console.log('[GapAnalysisService] Step 1: Found career path competencies', {
      userId,
      careerPathCount: careerPaths?.length || 0,
      careerPaths: careerPaths?.map(cp => ({
        competency_id: cp.competency_id,
        competency_name: cp.competency_name
      })) || []
    });

    if (!careerPaths || careerPaths.length === 0) {
      console.log('[GapAnalysisService] No career paths found - returning empty gap');
      return {};
    }

    // Get all user competencies to find verified skills
    const userCompetencies = await userCompetencyRepository.findByUser(userId);
    console.log('[GapAnalysisService] Step 2: Found user competencies', {
      userId,
      userCompetencyCount: userCompetencies?.length || 0,
      userCompetencyIds: userCompetencies?.map(uc => uc.competency_id) || []
    });

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
    console.log('[GapAnalysisService] Step 3: Collected all verified skills', {
      userId,
      totalVerifiedSkillCount: allVerifiedSkillIds.size,
      verifiedSkillIds: Array.from(allVerifiedSkillIds).slice(0, 10) // Show first 10 for brevity
    });

    const gaps = {};

    // For each career path competency, calculate the gap
    console.log('[GapAnalysisService] Step 4: Processing each career path competency');
    for (const careerPath of careerPaths) {
      const competencyId = careerPath.competency_id;
      const competencyName = careerPath.competency_name || 'Unknown';

      console.log('[GapAnalysisService] Processing competency', {
        competency_id: competencyId,
        competency_name: competencyName
      });

      try {
        // Get required MGS for this competency
        const requiredMGS = await competencyService.getRequiredMGS(competencyId);
        console.log('[GapAnalysisService] Got required MGS for competency', {
          competency_id: competencyId,
          competency_name: competencyName,
          requiredMGSCount: requiredMGS?.length || 0
        });

        // Find missing skills (required but not verified)
        const missingSkills = requiredMGS.filter(
          mgs => !allVerifiedSkillIds.has(mgs.skill_id)
        );
        console.log('[GapAnalysisService] Calculated missing skills for competency', {
          competency_id: competencyId,
          competency_name: competencyName,
          requiredMGSCount: requiredMGS?.length || 0,
          missingSkillCount: missingSkills.length,
          missingSkillIds: missingSkills.map(s => s.skill_id).slice(0, 5) // Show first 5 for brevity
        });

        // Only add to gaps if there are missing skills
        if (missingSkills.length > 0) {
          gaps[competencyName] = missingSkills.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name
          }));
          console.log('[GapAnalysisService] Added competency to gaps', {
            competency_name: competencyName,
            missingSkillCount: missingSkills.length
          });
        } else {
          console.log('[GapAnalysisService] Skipped competency (no missing skills)', {
            competency_name: competencyName,
            reason: requiredMGS?.length === 0 ? 'No required MGS defined' : 'All required MGS already verified'
          });
        }
      } catch (error) {
        console.error('[GapAnalysisService] Error calculating gap for competency', {
          competency_id: competencyId,
          competency_name: competencyName,
          error: error.message
        });
      }
    }

    const competencyCount = Object.keys(gaps).length;
    const totalMissingSkills = Object.values(gaps).reduce((sum, skills) => sum + skills.length, 0);
    console.log('[GapAnalysisService] ===== GAP CALCULATION COMPLETE =====', {
      userId,
      careerPathCount: careerPaths.length,
      competenciesWithGaps: competencyCount,
      totalMissingSkills: totalMissingSkills,
      gapSummary: Object.keys(gaps).map(comp => ({
        competency: comp,
        missingSkillCount: gaps[comp].length
      }))
    });

    return gaps;
  }

  /**
   * Calculate gap analysis for specific competencies
   * @param {string} userId - User ID
   * @param {Array<string>} competencyIds - Array of competency IDs to calculate gaps for
   * @returns {Promise<Object>} Simple gap structure: { "Competency Name": [{ skill_id, skill_name }] }
   */
  async calculateGapForCompetencies(userId, competencyIds = []) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    if (!competencyIds || competencyIds.length === 0) {
      console.log('[GapAnalysisService] No competency IDs provided - returning empty gap');
      return {};
    }

    console.log('[GapAnalysisService] ===== STARTING GAP CALCULATION FOR SPECIFIC COMPETENCIES =====', {
      userId,
      competencyCount: competencyIds.length,
      competencyIds: competencyIds.slice(0, 10) // Show first 10 for brevity
    });

    // Get all user competencies to find verified skills
    const userCompetencies = await userCompetencyRepository.findByUser(userId);
    console.log('[GapAnalysisService] Step 1: Found user competencies', {
      userId,
      userCompetencyCount: userCompetencies?.length || 0
    });

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
    console.log('[GapAnalysisService] Step 2: Collected all verified skills', {
      userId,
      totalVerifiedSkillCount: allVerifiedSkillIds.size
    });

    const gaps = {};

    // For each target competency, calculate the gap
    console.log('[GapAnalysisService] Step 3: Processing each target competency');
    for (const competencyId of competencyIds) {
      try {
        const competency = await competencyService.getCompetencyById(competencyId);
        if (!competency) {
          console.warn('[GapAnalysisService] Competency not found - skipping', { competencyId });
          continue;
        }

        const competencyName = competency.competency_name || 'Unknown';
        console.log('[GapAnalysisService] Processing competency', {
          competency_id: competencyId,
          competency_name: competencyName
        });

        // Get required MGS for this competency
        const requiredMGS = await competencyService.getRequiredMGS(competencyId);
        console.log('[GapAnalysisService] Got required MGS for competency', {
          competency_id: competencyId,
          competency_name: competencyName,
          requiredMGSCount: requiredMGS?.length || 0
        });

        // Find missing skills (required but not verified)
        const missingSkills = requiredMGS.filter(
          mgs => !allVerifiedSkillIds.has(mgs.skill_id)
        );
        console.log('[GapAnalysisService] Calculated missing skills for competency', {
          competency_id: competencyId,
          competency_name: competencyName,
          requiredMGSCount: requiredMGS?.length || 0,
          missingSkillCount: missingSkills.length
        });

        // Only add to gaps if there are missing skills
        if (missingSkills.length > 0) {
          gaps[competencyName] = missingSkills.map(skill => ({
            skill_id: skill.skill_id,
            skill_name: skill.skill_name
          }));
          console.log('[GapAnalysisService] Added competency to gaps', {
            competency_name: competencyName,
            missingSkillCount: missingSkills.length
          });
        } else {
          console.log('[GapAnalysisService] Skipped competency (no missing skills)', {
            competency_name: competencyName
          });
        }
      } catch (error) {
        console.error('[GapAnalysisService] Error calculating gap for competency', {
          competency_id: competencyId,
          error: error.message
        });
      }
    }

    const competencyCount = Object.keys(gaps).length;
    const totalMissingSkills = Object.values(gaps).reduce((sum, skills) => sum + skills.length, 0);
    console.log('[GapAnalysisService] ===== GAP CALCULATION COMPLETE =====', {
      userId,
      targetCompetencyCount: competencyIds.length,
      competenciesWithGaps: competencyCount,
      totalMissingSkills: totalMissingSkills
    });

    return gaps;
  }

  /**
   * True empty-gap guard for Learner AI.
   * Learner AI treats {} as truthy, so Object.keys alone is not enough.
   * @param {Object} gap
   * @returns {boolean}
   */
  gapHasSkills(gap) {
    if (!gap || typeof gap !== 'object') {
      return false;
    }
    return Object.values(gap).some(
      (skills) => Array.isArray(skills) && skills.length > 0
    );
  }

  /**
   * Find an existing competency whose required MGS skill_id set
   * exactly equals the provided Baseline result skill_id set.
   *
   * Uses existing competencies only. Does not create or generate taxonomy.
   * Does not use getRequiredMGSByName (that helper can auto-create trees).
   *
   * @param {Iterable<string>} resultSkillIds
   * @returns {Promise<{ name: string|null, source: 'exact_mgs_match'|'unresolved'|'ambiguous' }>}
   */
  async findUniqueExactMgsMatch(resultSkillIds) {
    const targetSet = new Set(
      Array.from(resultSkillIds || []).filter((id) => typeof id === 'string' && id.length > 0)
    );

    if (targetSet.size === 0) {
      return { name: null, source: 'unresolved' };
    }

    const matches = [];
    const pageSize = 100;
    let offset = 0;

    while (true) {
      let page = [];
      try {
        page = await competencyRepository.findAll({ limit: pageSize, offset });
      } catch (error) {
        console.warn('[GapAnalysisService.findUniqueExactMgsMatch] Failed to list competencies', {
          offset,
          error: error.message
        });
        break;
      }

      if (!page || page.length === 0) {
        break;
      }

      for (const competency of page) {
        if (!competency || !competency.competency_id) {
          continue;
        }
        try {
          const requiredMGS = await competencyService.getRequiredMGS(competency.competency_id);
          const mgsIds = new Set(
            (requiredMGS || [])
              .map((skill) => skill && skill.skill_id)
              .filter((id) => typeof id === 'string' && id.length > 0)
          );
          if (this._skillIdSetsEqual(targetSet, mgsIds)) {
            matches.push(competency);
          }
        } catch (error) {
          console.warn('[GapAnalysisService.findUniqueExactMgsMatch] Skipping competency', {
            competency_id: competency.competency_id,
            error: error.message
          });
        }
      }

      if (page.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    if (matches.length === 1) {
      return {
        name: matches[0].competency_name || null,
        source: matches[0].competency_name ? 'exact_mgs_match' : 'unresolved'
      };
    }
    if (matches.length === 0) {
      return { name: null, source: 'unresolved' };
    }
    return { name: null, source: 'ambiguous' };
  }

  _skillIdSetsEqual(setA, setB) {
    if (!setA || !setB || setA.size !== setB.size) {
      return false;
    }
    for (const value of setA) {
      if (!setB.has(value)) {
        return false;
      }
    }
    return true;
  }
}

module.exports = new GapAnalysisService();


