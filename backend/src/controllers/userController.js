/**
 * User Controller
 * 
 * Handles HTTP requests for user profile operations.
 */

const userService = require('../services/userService');
const extractionService = require('../services/extractionService');
const normalizationService = require('../services/normalizationService');
const competencyHierarchyService = require('../services/competencyHierarchyService');

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
  ///for the dirctory request
  /**
   * One-shot onboarding: save basic profile + run full pipeline
   * POST /api/user/onboard
   * Body: full user data from Directory MS, including raw_data and path_career
   */
  async onboardAndIngest(req, res) {
    try {
      // Step 1: create or update basic profile (persists raw_data)
      const user = await userService.createBasicProfile(req.body);
      const userId = user.user_id;
      const rawData = user.raw_data;
      const pathCareer = user.path_career;

      if (!rawData) {
        return res.status(400).json({
          success: false,
          error: 'raw_data is required in user payload for onboarding'
        });
      }

      // Step 1.5: Build competency hierarchy from career path (if provided)
      if (pathCareer && pathCareer.trim()) {
        console.log(`[UserController] Building competency hierarchy for career path: ${pathCareer}`);
        const hierarchyStats = await competencyHierarchyService.buildFromCareerPath(pathCareer);
        console.log('[UserController] Hierarchy build stats:', hierarchyStats);
      } else {
        console.log('[UserController] No path_career provided, skipping hierarchy generation');
      }

      // Step 2: extract from raw data
      const extracted = await extractionService.extractFromUserData(userId, rawData);

      // Step 3: normalize + deduplicate
      const normalizedRaw = await normalizationService.normalize(extracted);
      const normalized = normalizationService.deduplicate(normalizedRaw);

      // Step 4: build initial profile (writes usercompetency & userskill, sends to Directory MS)
      const profile = await userService.buildInitialProfile(userId, normalized);

      // Directory only needs the initial profile payload here
      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /*{what profile inclide:)
  userId: userId,
  relevanceScore: 0,
  competencies: [
    {
      competencyId: ...,
      level: 'undefined',
      coverage: 0,
      skills: [{ skillId, status }]
    }
  ]
}*/

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

      // Extract competencies & skills from raw data only
      const extracted = await extractionService.extractFromUserData(userId, rawData);

      res.json({
        success: true,
        data: extracted
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
   * Full pipeline: extract → normalize → build initial profile
   * POST /api/user/:userId/ingest
   * Body: { rawData } (optional if user.raw_data is already stored)
   */
  async ingestFromRawData(req, res) {
    try {
      const { userId } = req.params;
      let { rawData } = req.body || {};

      // If rawData not provided in the request, fall back to the stored user.raw_data
      if (!rawData) {
        const profile = await userService.getUserProfile(userId);
        rawData = profile.user.raw_data;
      }

      if (!rawData) {
        return res.status(400).json({ success: false, error: 'rawData is required (either in body or user.raw_data)' });
      }

      // Step 1: extract competencies & skills from raw data
      const extracted = await extractionService.extractFromUserData(userId, rawData);

      // Step 2: normalize + map to taxonomy
      const normalizedRaw = await normalizationService.normalize(extracted);
      const normalized = normalizationService.deduplicate(normalizedRaw);

      // Step 3: build initial profile (writes usercompetency & userskill, sends to Directory MS)
      const profile = await userService.buildInitialProfile(userId, normalized);

      res.json({
        success: true,
        data: profile
      });
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


