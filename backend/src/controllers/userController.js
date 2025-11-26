/**
 * User Controller
 * 
 * Handles HTTP requests for user profile operations.
 */

const userService = require('../services/userService');
const extractionService = require('../services/extractionService');
const normalizationService = require('../services/normalizationService');

class UserController {
  /**
   * Get user profile (unified endpoint)
  * GET /api/user/:userId
   */
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const profile = await userService.getUserProfile(userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  /**
   * Create or update basic user profile
   * POST /api/user
   */
  async createOrUpdateUser(req, res) {
    try {
      const user = await userService.createBasicProfile(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Extract skills and competencies from raw data
   * POST /api/user/:userId/extract
   */
  async extractFromRawData(req, res) {
    try {
      const { userId } = req.params;
      const { rawData } = req.body;

      if (!rawData) {
        return res.status(400).json({ success: false, error: 'rawData is required' });
      }

      // Step 1: extract competencies & skills from raw data
      const extracted = await extractionService.extractFromUserData(userId, rawData);

      // Step 2: normalize the extracted data (map to normalized names & taxonomy IDs)
      const normalizedRaw = await normalizationService.normalize(extracted);

      // Step 3: deduplicate normalized results
      const normalized = normalizationService.deduplicate(normalizedRaw);

      res.json({
        success: true,
        data: {
          extracted,
          normalized
        }
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Normalize extracted data
   * POST /api/user/:userId/normalize
   */
  async normalizeData(req, res) {
    try {
      const { userId } = req.params;
      const { extractedData } = req.body;

      if (!extractedData) {
        return res.status(400).json({ success: false, error: 'extractedData is required' });
      }

      const normalized = await normalizationService.normalize(extractedData);
      res.json({ success: true, data: normalized });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Build and deliver initial profile
   * POST /api/user/:userId/initial-profile
   */
  async buildInitialProfile(req, res) {
    try {
      const { userId } = req.params;
      const { normalizedData } = req.body;

      if (!normalizedData) {
        return res.status(400).json({ success: false, error: 'normalizedData is required' });
      }

      const profile = await userService.buildInitialProfile(userId, normalizedData);
      
      // TODO: Send to Directory MS
      // await directoryMSClient.sendInitialProfile(userId, profile);

      res.json({ success: true, data: profile });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Update user profile
   * PUT /api/user/:userId
   */
  async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const user = await userService.updateUserProfile(userId, req.body);
      
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new UserController();


