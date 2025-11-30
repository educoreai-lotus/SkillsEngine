/**
 * Baseline Exam Service
 * 
 * Builds competency-to-MGS mapping for baseline exam requests.
 */

const userCompetencyRepository = require('../repositories/userCompetencyRepository');
const competencyRepository = require('../repositories/competencyRepository');
const competencyService = require('./competencyService');
const assessmentMSClient = require('./assessmentMSClient');

class BaselineExamService {
  /**
   * Build competency-to-MGS mapping for a user
   * @param {string} userId - User ID
   * @param {string} competencyId - Optional: specific competency ID (if null, uses all user competencies)
   * @returns {Promise<Array>} Array of competencies with their MGS
   */
  async buildCompetencyMGSMapping(userId, competencyId = null) {
    // Get user competencies (all or specific one)
    const userCompetencies = competencyId
      ? [await userCompetencyRepository.findByUserAndCompetency(userId, competencyId)]
      : await userCompetencyRepository.findByUser(userId);

    const competenciesWithMGS = [];

    for (const userComp of userCompetencies) {
      if (!userComp) continue;

      // Get competency details
      const competency = await competencyRepository.findById(userComp.competency_id);
      if (!competency) continue;

      // Get all required MGS for this competency
      const mgs = await competencyService.getRequiredMGS(userComp.competency_id);

      competenciesWithMGS.push({
        competency_id: userComp.competency_id,
        competency_name: competency.competency_name,
        mgs: mgs.map(m => ({
          skill_id: m.skill_id,
          skill_name: m.skill_name
        }))
      });
    }

    return competenciesWithMGS;
  }

  /**
   * Request baseline exam for user
   * @param {string} userId - User ID
   * @param {string} competencyId - Optional: specific competency ID (if null, tests all user competencies)
   * @returns {Promise<Object>} Exam request response
   */
  async requestBaselineExam(userId, competencyId = null) {
    // Build competency-to-MGS mapping
    const competenciesWithMGS = await this.buildCompetencyMGSMapping(userId, competencyId);

    if (competenciesWithMGS.length === 0) {
      throw new Error('No competencies found for user');
    }

    // Send to Assessment MS
    return await assessmentMSClient.requestBaselineExam(userId, competenciesWithMGS);
  }
}

module.exports = new BaselineExamService();

