/**
 * Learning Analytics MS Handler
 * 
 * Handles requests from Learning Analytics MS.
 */

const userService = require('../../services/userService');
const userCompetencyRepository = require('../../repositories/userCompetencyRepository');

class AnalyticsHandler {
  /**
   * Process Learning Analytics MS request
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      const { user_id, company_id, type } = payload || {};

      // Batch ingestion: Learning Analytics requests all historical data
      // using cursor-based pagination.
      if (type === 'batch') {
        return await this.processBatch(payload, responseTemplate);
      }

      if (user_id) {
        // Get full user profile data
        const profile = await userService.getFullUserProfile(user_id);
        const { user, competencies } = profile;

        // Build minimal response for Learning Analytics:
        // - user_id
        // - user_name
        // - company_id
        // - competencies (no skills)
        const minimalProfile = {
          user_id: user.user_id,
          user_name: user.user_name,
          competencies
        };

        return {
          ...(responseTemplate || {}),
          ...minimalProfile
        };
      }

      return { message: 'user_id or company_id is required' };
    } catch (error) {
      return { message: error.message };
    }
  }

  /**
   * Handle batch ingestion requests from Learning Analytics MS.
   *
   * The payload follows the MS8 batch contract:
   * {
   *   "type": "batch",
   *   "cursor": "last-user-id-or-null",
   *   "company_id": "optional-tenant-filter"
   * }
   *
   * We return:
   * - version: service version (string)
   * - fetched_at: ISO timestamp
   * - pagination: { total_records, returned_records, next_cursor, has_more }
   * - user_profiles: array of minimal user competency profiles
   *
   * NOTE: We only use data that already exists in Skills Engine:
   * - users table (user_id, user_name, company_id)
   * - usercompetency table (competencies, no skills)
   */
  async processBatch(payload, responseTemplate) {
    const PAGE_SIZE_DEFAULT = 1000;

    const cursor = payload && payload.cursor ? String(payload.cursor) : null;
    const companyId = payload && payload.company_id ? String(payload.company_id) : null;

    // Allow an optional page_size override but cap it to a sane maximum
    let pageSize = PAGE_SIZE_DEFAULT;
    if (payload && typeof payload.page_size === 'number' && payload.page_size > 0) {
      pageSize = Math.min(payload.page_size, PAGE_SIZE_DEFAULT);
    }

    // Fetch a page of full user profiles (user + competencies only)
    const { totalCount, profiles, nextCursor } = await userService.getFullUserProfilesBatch({
      cursor,
      pageSize,
      companyId
    });

    const returnedRecords = profiles.length;
    const hasMore = !!nextCursor && returnedRecords === pageSize;

    // Build minimal array of user competency profiles for Learning Analytics
    const userProfiles = profiles.map(profile => ({
      user_id: profile.user.user_id,
      user_name: profile.user.user_name,
      company_id: profile.user.company_id || null,
      competencies: profile.competencies
    }));

    const baseTemplate = responseTemplate || {};

    return {
      ...baseTemplate,
      version: baseTemplate.version || new Date().toISOString().slice(0, 10),
      fetched_at: new Date().toISOString(),
      pagination: {
        total_records: totalCount,
        returned_records: returnedRecords,
        next_cursor: nextCursor,
        has_more: hasMore
      },
      user_profiles: userProfiles
    };
  }
}

module.exports = new AnalyticsHandler();


