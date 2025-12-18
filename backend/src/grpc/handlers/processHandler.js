const Logger = require('../../utils/logger');

const logger = new Logger('GrpcProcessHandler');

/**
 * Process RPC Handler
 * Handles both Real-time queries and Batch sync requests
 */
class ProcessHandler {
  /**
   * Handle Process RPC call
   * @param {Object} call - GRPC call object
   * @param {Function} callback - Response callback
   */
  async handle(call, callback) {
    const startTime = Date.now();
    let envelope;

    try {
      // 1. Parse envelope from request
      const envelopeJson = call.request.envelope_json;
      envelope = JSON.parse(envelopeJson);

      const {
        request_id,
        tenant_id,
        user_id,
        target_service,
        payload
      } = envelope;

      logger.info('[GRPC Process] Request received', {
        service: process.env.SERVICE_NAME || 'skills-engine-backend',
        request_id,
        tenant_id,
        user_id,
        target_service,
        has_payload: !!payload,
        sync_type: payload?.sync_type
      });

      // 2. Detect mode: Real-time or Batch Sync
      const isBatchSync = payload?.sync_type === 'batch';

      let result;
      if (isBatchSync) {
        // MODE 1: BATCH SYNC
        logger.info('[GRPC Process - BATCH SYNC] Processing batch request', {
          service: process.env.SERVICE_NAME || 'skills-engine-backend',
          request_id,
          page: payload.page,
          limit: payload.limit,
          since: payload.since
        });

        result = await this.handleBatchSync(envelope);
      } else {
        // MODE 2: REAL-TIME QUERY
        logger.info('[GRPC Process - REAL-TIME] Processing query', {
          service: process.env.SERVICE_NAME || 'skills-engine-backend',
          request_id,
          query: payload?.query,
          context: payload?.context
        });

        result = await this.handleRealtimeQuery(envelope);
      }

      // 3. Build response envelope
      const responseEnvelope = {
        request_id,
        success: true,
        data: result.data, // Must be array or { items: [...] }
        metadata: {
          ...(result.metadata || {}),
          processed_at: new Date().toISOString(),
          service: process.env.SERVICE_NAME || 'skills-engine-backend',
          duration_ms: Date.now() - startTime,
          mode: isBatchSync ? 'batch' : 'realtime'
        }
      };

      logger.info('[GRPC Process] Request completed', {
        service: process.env.SERVICE_NAME || 'skills-engine-backend',
        request_id,
        duration_ms: Date.now() - startTime,
        mode: isBatchSync ? 'batch' : 'realtime',
        success: true
      });

      // 4. Return ProcessResponse
      callback(null, {
        success: true,
        envelope_json: JSON.stringify(responseEnvelope),
        error: ''
      });
    } catch (error) {
      logger.error('[GRPC Process] Request failed', error);

      // Return error response
      callback(null, {
        success: false,
        envelope_json: JSON.stringify({
          request_id: envelope?.request_id,
          success: false,
          error: error.message,
          metadata: {
            processed_at: new Date().toISOString(),
            service: process.env.SERVICE_NAME || 'skills-engine-backend'
          }
        }),
        error: error.message
      });
    }
  }

  /**
   * Handle Batch Sync request
   * @param {Object} envelope - Request envelope
   * @returns {Promise<Object>} Result with data
   */
  async handleBatchSync(envelope) {
    const { tenant_id, payload } = envelope;
    const {
      page = 1,
      limit = 1000,
      since
    } = payload || {};

    logger.info('[Batch Sync] Fetching data', {
      service: process.env.SERVICE_NAME || 'skills-engine-backend',
      tenant_id,
      page,
      limit,
      since
    });

    const offset = (page - 1) * limit;
    const data = await this.queryDatabase({
      tenant_id,
      limit,
      offset,
      since
    });

    const totalCount = await this.getTotalCount({
      tenant_id,
      since
    });

    const hasMore = page * limit < totalCount;

    logger.info('[Batch Sync] Data fetched', {
      service: process.env.SERVICE_NAME || 'skills-engine-backend',
      tenant_id,
      page,
      records: Array.isArray(data) ? data.length : 0,
      total: totalCount,
      has_more: hasMore
    });

    // Return format MUST be { items: [...] }
    return {
      data: {
        items: data,
        page,
        limit,
        total: totalCount
      },
      metadata: {
        has_more: hasMore,
        page,
        total_pages: limit > 0 ? Math.ceil(totalCount / limit) : 0
      }
    };
  }

  /**
   * Handle Real-time Query
   * @param {Object} envelope - Request envelope
   * @returns {Promise<Object>} Result with data
   */
  async handleRealtimeQuery(envelope) {
    const { tenant_id, user_id, payload } = envelope;

    const query = payload?.query || '';

    logger.info('[Real-time Query] Processing', {
      service: process.env.SERVICE_NAME || 'skills-engine-backend',
      tenant_id,
      user_id,
      query
    });

    let data;

    if (query.includes('recent')) {
      data = await this.getRecentItems(tenant_id, user_id);
    } else if (query.includes('id') || query.includes('show')) {
      const id = this.extractId(query);
      data = await this.getItemById(tenant_id, id);
    } else {
      data = await this.getDefaultData(tenant_id, user_id);
    }

    logger.info('[Real-time Query] Data fetched', {
      service: process.env.SERVICE_NAME || 'skills-engine-backend',
      tenant_id,
      user_id,
      records: Array.isArray(data) ? data.length : data ? 1 : 0
    });

    // Return data as direct array (not wrapped)
    const normalized =
      Array.isArray(data) || data == null ? data || [] : [data];

    return {
      data: normalized,
      metadata: {
        query_type: this.detectQueryType(query)
      }
    };
  }

  /**
   * Query database with pagination (for Batch Sync)
   * IMPLEMENT THIS based on your database and data model
   */
  async queryDatabase({ tenant_id, limit, offset, since }) {
    // For this service, we expose user competency profiles in batch mode.
    // tenant_id is treated as company_id on the user record.
    const userService = require('../../services/userService');

    const pageSize = limit || 1000;

    const { users, totalCount } = await require('../../repositories/userRepository').findAllPaginated({
      cursor: null,
      limit: pageSize,
      companyId: tenant_id || null
    });

    if (!users || users.length === 0) {
      return [];
    }

    const userIds = users.map(u => u.user_id);
    const userCompetencyRepository = require('../../repositories/userCompetencyRepository');
    const allCompetencies = await userCompetencyRepository.findByUsers(userIds);

    const competenciesByUser = new Map();
    for (const uc of allCompetencies) {
      const key = uc.user_id;
      if (!competenciesByUser.has(key)) {
        competenciesByUser.set(key, []);
      }
      competenciesByUser.get(key).push(uc.toJSON());
    }

    // Flatten into records suitable for RAG ingestion
    const records = users.map(user => ({
      user: user.toJSON(),
      competencies: competenciesByUser.get(user.user_id) || []
    }));

    return records;
  }

  /**
   * Get total count (for Batch Sync pagination)
   * IMPLEMENT THIS based on your database and data model
   */
  async getTotalCount({ tenant_id, since }) {
    const userRepository = require('../../repositories/userRepository');
    const { totalCount } = await userRepository.findAllPaginated({
      cursor: null,
      limit: 1,
      companyId: tenant_id || null
    });

    return totalCount || 0;
  }

  /**
   * Get recent items (for Real-time queries)
   * IMPLEMENT THIS based on your business logic
   */
  async getRecentItems(tenant_id, user_id) {
    const userService = require('../../services/userService');
    if (!user_id) {
      return [];
    }
    const profile = await userService.getFullUserProfile(user_id);
    return [profile];
  }

  /**
   * Get item by ID (for Real-time queries)
   * IMPLEMENT THIS based on your business logic
   */
  async getItemById(tenant_id, id) {
    if (!id) return null;
    const userService = require('../../services/userService');
    try {
      const profile = await userService.getFullUserProfile(id);
      return profile;
    } catch (e) {
      logger.warn('[Get Item By ID] Failed to load profile', {
        tenant_id,
        id,
        error: e.message
      });
      return null;
    }
  }

  /**
   * Get default data (for Real-time queries)
   * IMPLEMENT THIS based on your business logic
   */
  async getDefaultData(tenant_id, user_id) {
    const userService = require('../../services/userService');

    if (user_id) {
      const profile = await userService.getFullUserProfile(user_id);
      return [profile];
    }

    // Fallback: small batch of profiles for the tenant
    const { profiles } = await userService.getFullUserProfilesBatch({
      cursor: null,
      pageSize: 10,
      companyId: tenant_id || null
    });

    return profiles;
  }

  /**
   * Extract ID from query text
   */
  extractId(query) {
    const match = query.match(/\d+/);
    return match ? match[0] : null;
  }

  /**
   * Detect query type
   */
  detectQueryType(query) {
    if (query.includes('recent')) return 'recent';
    if (query.includes('id')) return 'by_id';
    if (query.includes('show')) return 'show';
    return 'default';
  }
}

module.exports = new ProcessHandler();


