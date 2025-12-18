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
const competencyRepository = require('../../repositories/competencyRepository');
const userCareerPathRepository = require('../../repositories/userCareerPathRepository');

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
      const result = await this.handleOnboardAndIngest(payload, responseTemplate);

      // Log the response that will be sent back to Directory (goes into envelope.response)
      try {
        console.log(
          '[DirectoryHandler] Outgoing response to Directory MS (envelope.response):',
          JSON.stringify(result, null, 2)
        );
      } catch (logErr) {
        console.warn('[DirectoryHandler] Failed to log outgoing response', {
          error: logErr.message
        });
      }

      return result;
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
   *  - create/update basic user profile (persists raw_data, path_career, company_name, preferred_language, etc.)
   *  - optionally build competency hierarchy from path_career
   *  - run full ingestion pipeline (extract → normalize → build initial profile)
   *  - Returns profile data which UnifiedEndpointHandler fills into response
   *
   * Expected payload (flattened user data from Directory MS), e.g.:
   *  {
   *    user_id: "...",        // optional
   *    user_name: "...",
   *    company_id: "...",
   *    company_name: "...",   // optional
   *    raw_data: { ... },     // REQUIRED
   *    path_career: "...",    // optional
   *    preferred_language: "en"  // optional, defaults to 'en'
   *  }
   */
  async handleOnboardAndIngest(payload, responseTemplate) {
    // Optional short-circuit: if Directory sends an existing user_id, do not rebuild the profile.
    // Instead, return a simple message so Directory knows the user already exists.
    const incomingUserId = payload && payload.user_id;
    if (incomingUserId) {
      try {
        // Reuse userService to check if the user exists.
        await userService.getUserProfile(incomingUserId);
        return {
          ...(responseTemplate || {}),
          userId: incomingUserId,
          message: 'User already exists'
        };
      } catch (err) {
        // If user is not found, proceed with normal onboarding flow.
      }
    }

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
        await competencyService.buildHierarchyFromCareerPath(pathCareer);

        // Step 1.6: Save career path competency to user_career_path table
        try {
          const trimmedCareer = pathCareer.trim();
          const careerPathCompetency = await competencyRepository.findByName(trimmedCareer);

          if (careerPathCompetency) {
            // Check if this career path competency is already saved for this user
            const existingPaths = await userCareerPathRepository.findByUser(userId);
            const alreadyExists = existingPaths.some(
              (cp) => cp.competency_id === careerPathCompetency.competency_id
            );

            if (!alreadyExists) {
              await userCareerPathRepository.create({
                user_id: userId,
                competency_id: careerPathCompetency.competency_id
              });
            }
          }
        } catch (careerPathErr) {
          // Don't fail onboarding if career path save fails
        }
      } catch (err) {
        // Don't fail onboarding if hierarchy build fails
      }
    }

    // Step 2: extract competencies & skills from raw data
    const extracted = await extractionService.extractFromUserData(userId, rawData);

    // Step 3: normalize + deduplicate
    const normalizedRaw = await normalizationService.normalize(extracted);
    const normalized = normalizationService.deduplicate(normalizedRaw);

    // Step 4: build initial profile (writes usercompetency & userskill)
    const profile = await userService.buildInitialProfile(userId, normalized);

    // Return profile data with userId, competencies array, and relevanceScore
    // UnifiedEndpointHandler will fill response field in the original envelope that Directory MS sent
    return {
      ...(responseTemplate || {}),
      userId: profile.userId || userId,
      competencies: profile.competencies || [],
      relevanceScore: profile.relevanceScore || 0
    };
  }
}

module.exports = new DirectoryHandler();


