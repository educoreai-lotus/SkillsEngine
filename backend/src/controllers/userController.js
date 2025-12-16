/**
 * User Controller
 * 
 * Handles HTTP requests for user profile operations.
 */

const userService = require('../services/userService');
const extractionService = require('../services/extractionService');
const normalizationService = require('../services/normalizationService');
const competencyService = require('../services/competencyService');
const baselineExamService = require('../services/baselineExamService');
const competencyRepository = require('../repositories/competencyRepository');
const userCareerPathRepository = require('../repositories/userCareerPathRepository');

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
        try {
          const hierarchyStats = await competencyService.buildHierarchyFromCareerPath(pathCareer);
          console.log('[UserController] Hierarchy build stats:', hierarchyStats);

          // Step 1.6: Save career path competency to user_career_path table
          try {
            const careerPathCompetency = await competencyRepository.findByName(pathCareer.trim());
            if (careerPathCompetency) {
              await userCareerPathRepository.create({
                user_id: userId,
                competency_id: careerPathCompetency.competency_id
              });
              console.log('[UserController] Saved career path competency to user_career_path', {
                userId,
                competency_id: careerPathCompetency.competency_id,
                competency_name: pathCareer.trim()
              });
            } else {
              console.warn('[UserController] Career path competency not found in database', {
                pathCareer: pathCareer.trim()
              });
            }
          } catch (careerPathErr) {
            // Log error but don't fail onboarding if career path save fails
            console.warn('[UserController] Failed to save career path competency', {
              userId,
              pathCareer: pathCareer.trim(),
              error: careerPathErr.message
            });
          }
        } catch (err) {
          console.warn('[UserController] Failed to build hierarchy from career path', {
            error: err.message
          });
        }
      } else {
        console.log('[UserController] No path_career provided, skipping hierarchy generation');
      }

      // Step 2-4: run full ingestion pipeline (extract → normalize → build initial profile)
      const profile = await this.runIngestionPipeline(userId, rawData);

      // Directory only needs the initial profile payload here (201 for create/update)
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
   * Shared ingestion pipeline:
   *  - extract competencies & skills from raw data
   *  - normalize + deduplicate
   *  - build initial profile (writes usercompetency & userskill, sends to Directory MS)
   *
   * @param {string|number} userId
   * @param {object} rawData
   * @returns {Promise<object>} initial profile
   */
  async runIngestionPipeline(userId, rawData) {
    // Step 1: extract competencies & skills from raw data
    const extracted = await extractionService.extractFromUserData(userId, rawData);

    // Step 2: normalize + map to taxonomy
    const normalizedRaw = await normalizationService.normalize(extracted);
    const normalized = normalizationService.deduplicate(normalizedRaw);

    // Step 3: build initial profile (writes usercompetency & userskill, sends to Directory MS)
    const profile = await userService.buildInitialProfile(userId, normalized);

    return profile;
  }

  /**
   * Extract skills and competencies from raw data
   * POST /api/user/:userId/extract
   */
  async extractFromRawData(req, res) {
    try {
      const { userId } = req.params;
      let { rawData } = req.body;

      if (!rawData) {
        return res.status(400).json({ success: false, error: 'rawData is required' });
      }
      //------ Add new thing -----------
      // Normalize rawData so extractionService always receives a string.
      // Accept both:
      // - string: "plain text profile / resume / etc."
      // - object/array: { linkedin: {...}, github: {...} } → JSON string
      if (typeof rawData !== 'string') {
        try {
          rawData = JSON.stringify(rawData, null, 2);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'rawData must be a string or JSON-serializable object'
          });
        }
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

      // Run shared ingestion pipeline (extract → normalize → build initial profile)
      const profile = await this.runIngestionPipeline(userId, rawData);

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
   * Manually trigger a baseline exam request for a user.
   * This is mainly for testing/ops: it rebuilds the competency→MGS map
   * from the user's existing competencies and sends it to Assessment MS.
   *
   * POST /api/user/:userId/request-baseline-exam
   */
  async requestBaselineExam(req, res) {
    try {
      const { userId } = req.params;

      // Load user to get user_name (required by Assessment MS payload)
      const profile = await userService.getUserProfile(userId);
      const userName = profile?.user?.user_name;

      if (!userName) {
        return res.status(404).json({
          success: false,
          error: 'User not found or user_name missing'
        });
      }

      await baselineExamService.requestBaselineExam(userId, userName);

      res.json({
        success: true,
        message: 'Baseline exam request sent to Assessment MS'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
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


