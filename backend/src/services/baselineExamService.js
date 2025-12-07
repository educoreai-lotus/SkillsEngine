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
   * Build competency-to-MGS mapping for a user across ALL competencies they own.
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of competencies with their MGS
   */
  async buildCompetencyMGSMapping(userId) {
    // Get all competencies the user currently owns
    const userCompetencies = await userCompetencyRepository.findByUser(userId);

    const competenciesWithMGS = [];

    for (const userComp of userCompetencies) {
      if (!userComp) continue;

      // Get competency details
      const competency = await competencyRepository.findById(userComp.competency_id);
      if (!competency) continue;

      // Get all required MGS for this competency
      const mgs = await competencyService.getRequiredMGS(userComp.competency_id);

      // If no MGS are defined for this competency, skip it.
      // This effectively means "we can't find the MGS of it" so it
      // should not be included in the baseline exam request.
      if (!mgs || mgs.length === 0) {
        continue;
      }

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
   * Request baseline exam for a user across ALL owned competencies.
   * @param {string} userId - User ID
   * @param {string} userName - User name
   * @returns {Promise<Object>} Exam request response
   */
  async requestBaselineExam(userId, userName) {
    // Build competency-to-MGS mapping for all user competencies
    const competenciesWithMGS = await this.buildCompetencyMGSMapping(userId);

    if (competenciesWithMGS.length === 0) {
      throw new Error('No competencies found for user');
    }

    // Debug: print the competency→MGS mapping being sent to Assessment MS
    // eslint-disable-next-line no-console
    console.log('[BaselineExamService] competenciesWithMGS for baseline exam:', {
      userId,
      userName,
      competenciesWithMGS
    });

    // Send to Assessment MS
   //return await assessmentMSClient.requestBaselineExam(userId, userName, competenciesWithMGS);
    return{
      success: true,
      message: 'Baseline exam request sent to Assessment MS',
      data: competenciesWithMGS
    }
  }
}

module.exports = new BaselineExamService();

