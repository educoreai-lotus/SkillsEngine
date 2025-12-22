/**
 * Career Path Service
 * 
 * Business logic layer for career path operations.
 * Handles career path management, competency resolution, and gap analysis.
 */

const userCareerPathRepository = require('../repositories/userCareerPathRepository');
const competencyService = require('./competencyService');
const gapAnalysisService = require('./gapAnalysisService');
const learnerAIMSClient = require('./learnerAIMSClient');
const userService = require('./userService');
const Logger = require('../utils/logger');

const logger = new Logger('CareerPathService');

class CareerPathService {
  /**
   * Get all career paths for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of career paths
   */
  async getCareerPaths(userId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    return await userCareerPathRepository.findByUser(userId);
  }

  /**
   * Get current (latest) career path for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Latest career path or null
   */
  async getCurrentCareerPath(userId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    return await userCareerPathRepository.findLatestByUser(userId);
  }

  /**
   * Add a career path for a user
   * @param {string} userId - User ID
   * @param {string} [competencyId] - Competency ID (optional if competencyName provided)
   * @param {string} [competencyName] - Competency name (optional if competencyId provided)
   * @returns {Promise<Object>} Created career path
   */
  async addCareerPath(userId, competencyId, competencyName) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    if (!competencyId && !competencyName) {
      throw new Error('competency_id or competency_name is required');
    }

    let resolvedCompetencyId = competencyId;

    // If competency_name provided, look up the competency_id
    if (!competencyId && competencyName) {
      const competency = await competencyService.getCompetencyByName(competencyName);
      if (!competency) {
        throw new Error(`Competency not found: ${competencyName}`);
      }
      resolvedCompetencyId = competency.competency_id;
    }

    // Verify competency exists
    const competency = await competencyService.getCompetencyById(resolvedCompetencyId);
    if (!competency) {
      throw new Error(`Competency with ID "${resolvedCompetencyId}" not found`);
    }

    return await userCareerPathRepository.create({
      user_id: userId,
      competency_id: resolvedCompetencyId
    });
  }

  /**
   * Remove a career path for a user
   * @param {string} userId - User ID
   * @param {string} competencyId - Competency ID
   * @returns {Promise<void>}
   */
  async removeCareerPath(userId, competencyId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    if (!competencyId) {
      throw new Error('competency_id is required');
    }

    await userCareerPathRepository.delete(userId, competencyId);
  }

  /**
   * Search competencies by name substring
   * @param {string} query - Search query
   * @param {number} [limit=20] - Maximum number of results
   * @param {number} [offset=0] - Offset for pagination
   * @returns {Promise<Array>} Array of matching competencies
   */
  async searchCompetencies(query, limit = 20, offset = 0) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('query is required and must be a non-empty string');
    }

    return await competencyService.searchCompetencies(query.trim(), {
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0
    });
  }

  /**
   * Calculate gap analysis for user's career paths
   * Shows how far the user is from reaching their career path goals
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Gap analysis result
   */
  async calculateGap(userId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    return await gapAnalysisService.calculateCareerPathGap(userId);
  }

  /**
   * Calculate gap and send to Learner AI
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Gap analysis result
   */
  async calculateGapAndSend(userId) {
    if (!userId) {
      throw new Error('user_id is required');
    }

    logger.info('Starting gap calculation and send to Learner AI', { userId });

    // Calculate gap analysis
    const gapAnalysis = await this.calculateGap(userId);
    const competencyCount = Object.keys(gapAnalysis).length;
    const totalMissingSkills = Object.values(gapAnalysis).reduce((sum, skills) => sum + skills.length, 0);

    logger.info('Gap analysis calculated, preparing to send to Learner AI', {
      userId,
      competencyCount,
      totalMissingSkills
    });

    // Get user's career path for courseName parameter
    // Use the name of the first competency in the user's career path list
    let userCareerPath = null;
    try {
      const careerPaths = await userCareerPathRepository.findByUser(userId);
      if (careerPaths && careerPaths.length > 0 && careerPaths[0].competency_name) {
        userCareerPath = careerPaths[0].competency_name;
      }
    } catch (error) {
      logger.warn('Failed to fetch career paths for user', { userId, error: error.message });
    }

    // Send gap analysis to Learner AI (broad analysis for career path)
    // When called from UI, examStatus should always be 'fail'
    // courseName should be the user's career path
    try {
      await learnerAIMSClient.sendGapAnalysis(userId, gapAnalysis, 'broad', userCareerPath, 'fail');
      logger.info('Successfully sent gap analysis to Learner AI', { userId, careerPath: userCareerPath });
    } catch (error) {
      logger.error('Error sending gap analysis to Learner AI', error);
      logger.warn('Gap calculation succeeded but sending to Learner AI failed', {
        userId,
        errorMessage: error.message
      });
      // Don't throw - we still want to return success even if sending to Learner AI fails
    }

    // Get all career path competencies from user_career_path table
    const directoryMSClient = require('./directoryMSClient');
    try {
      const careerPaths = await userCareerPathRepository.findByUser(userId);
      logger.info('Retrieved career path competencies from user_career_path table', {
        userId,
        careerPathCount: careerPaths.length
      });

      // Send career path competencies to Directory MS
      if (careerPaths && careerPaths.length > 0) {
        await directoryMSClient.sendCareerPathCompetencies(userId, careerPaths);
        logger.info('Successfully sent career path competencies to Directory MS', {
          userId,
          competencyCount: careerPaths.length
        });
      } else {
        logger.warn('No career path competencies found to send to Directory MS', { userId });
      }
    } catch (error) {
      logger.error('Error sending career path competencies to Directory MS', error);
      logger.warn('Gap calculation and Learner AI send succeeded, but sending to Directory MS failed', {
        userId,
        errorMessage: error.message
      });
      // Don't throw - we still want to return success even if sending to Directory MS fails
    }

    return gapAnalysis;
  }

  /**
   * Add career path, calculate gap, and send to Learner AI
   * @param {string} userId - User ID
   * @param {string} [competencyId] - Competency ID (optional if competencyName provided)
   * @param {string} [competencyName] - Competency name (optional if competencyId provided)
   * @returns {Promise<Object>} Result with career path and gap analysis
   */
  async addCareerPathAndSendGap(userId, competencyId, competencyName) {
    logger.info('Adding career path and calculating gap', {
      userId,
      competencyId,
      competencyName
    });

    // Add career path
    const careerPath = await this.addCareerPath(userId, competencyId, competencyName);
    logger.info('Career path added successfully', {
      userId,
      careerPathId: careerPath?.competency_id,
      careerPathName: careerPath?.competency_name
    });

    // Calculate gap analysis
    const gapAnalysis = await this.calculateGap(userId);
    const competencyCount = Object.keys(gapAnalysis).length;
    const totalMissingSkills = Object.values(gapAnalysis).reduce((sum, skills) => sum + skills.length, 0);

    logger.info('Gap analysis calculated after adding career path', {
      userId,
      competencyCount,
      totalMissingSkills
    });

    // Get user's career path for courseName parameter
    let userCareerPath = null;
    try {
      const profile = await userService.getUserProfile(userId);
      const user = profile?.user || profile;
      userCareerPath = user?.path_career || user?.career_path_goal || null;
    } catch (error) {
      logger.warn('Failed to fetch user profile for career path', { userId, error: error.message });
    }

    // Send gap analysis to Learner AI (broad analysis for career path)
    // When called from UI, examStatus should always be 'fail'
    // courseName should be the user's career path
    try {
      await learnerAIMSClient.sendGapAnalysis(userId, gapAnalysis, 'broad', userCareerPath, 'fail');
      logger.info('Successfully sent gap analysis to Learner AI after adding career path', { userId, careerPath: userCareerPath });
    } catch (error) {
      logger.error('Error sending gap analysis to Learner AI', error);
      logger.warn('Career path added and gap calculated, but sending to Learner AI failed', {
        userId,
        errorMessage: error.message
      });
      // Don't throw - we still want to return success even if sending to Learner AI fails
    }

    return {
      careerPath,
      gapAnalysis
    };
  }
}

module.exports = new CareerPathService();

