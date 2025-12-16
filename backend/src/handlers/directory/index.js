/**
 * Directory MS Handler
 *
 * Handles requests from Directory MS (via Unified Endpoint).
 * When Directory sends a unified envelope with requester_service = "directory"
 * or "directory-ms", UnifiedEndpointHandler routes it here.
 *
 * This handler can trigger the same onboarding/ingestion flow as
 * POST /api/user/onboard, but without going through Express controllers.
 */

const userService = require('../../services/userService');
const competencyService = require('../../services/competencyService');
const extractionService = require('../../services/extractionService');
const normalizationService = require('../../services/normalizationService');

class DirectoryHandler {
  /**
   * Process Directory MS request
   * @param {Object} payload - Request payload (from unified envelope)
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      if (!payload || typeof payload !== 'object') {
        return { message: 'Invalid payload structure' };
      }

      // Log full incoming Directory request body for debugging
      try {
        console.log(
          '[DirectoryHandler] Incoming Directory MS request - full payload:',
          JSON.stringify(payload, null, 2)
        );
      } catch (logErr) {
        console.warn('[DirectoryHandler] Failed to log incoming request', {
          error: logErr.message
        });
      }

      // Handle onboarding + ingestion based on Directory payload
      return await this.handleOnboardAndIngest(payload, responseTemplate);
    } catch (error) {
      console.error('[DirectoryHandler] Error processing request:', {
        error: error.message,
        stack: error.stack,
        payload
      });

      return {
        message: error.message || 'Internal server error'
      };
    }
  }

  /**
   * Handle onboarding from Directory MS using the unified payload.
   *
   * Mirrors UserController.onboardAndIngest:
   *  - create/update basic user profile (persists raw_data and path_career)
   *  - optionally build competency hierarchy from path_career
   *  - run full ingestion pipeline (extract → normalize → build initial profile)
   *  - Returns profile data which UnifiedEndpointHandler fills into response.answer
   *
   * Expected payload (flattened user data from Directory MS), e.g.:
   *  {
   *    user_id: "...",        // optional
   *    user_name: "...",
   *    company_id: "...",
   *    raw_data: { ... },     // REQUIRED
   *    path_career: "..."     // optional
   *  }
   */
  async handleOnboardAndIngest(payload, responseTemplate) {
    // Step 1: create or update basic profile (persists raw_data, path_career, etc.)
    const user = await userService.createBasicProfile(payload);
    const userId = user.user_id;
    const rawData = user.raw_data;
    const pathCareer = user.path_career;

    if (!rawData) {
      return {
        success: false,
        error: 'raw_data is required in Directory payload for onboarding'
      };
    }

    // Step 1.5: Build competency hierarchy from career path (if provided)
    if (pathCareer && typeof pathCareer === 'string' && pathCareer.trim()) {
      console.log(
        '[DirectoryHandler] Building competency hierarchy for career path from Directory:',
        pathCareer
      );
      try {
        const hierarchyStats = await competencyService.buildHierarchyFromCareerPath(pathCareer);
        console.log('[DirectoryHandler] Hierarchy build stats:', hierarchyStats);
      } catch (err) {
        console.warn('[DirectoryHandler] Failed to build hierarchy from career path', {
          error: err.message
        });
      }
    } else {
      console.log(
        '[DirectoryHandler] No path_career provided in Directory payload, skipping hierarchy generation'
      );
    }

    // Step 2: extract competencies & skills from raw data
    const extracted = await extractionService.extractFromUserData(userId, rawData);

    // Step 3: normalize + deduplicate
    const normalizedRaw = await normalizationService.normalize(extracted);
    const normalized = normalizationService.deduplicate(normalizedRaw);

    // Step 4: build initial profile (writes usercompetency & userskill)
    const profile = await userService.buildInitialProfile(userId, normalized);

    // Return profile data - UnifiedEndpointHandler will fill response.answer field
    // in the original envelope that Directory MS sent
    return {
      ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
      success: true,
      data: profile
    };
  }
}

module.exports = new DirectoryHandler();


