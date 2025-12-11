/**
 * Content Studio MS Handler
 * 
 * Handles requests from Content Studio MS using AI Query Builder.
 */

const aiQueryBuilderService = require('../../services/aiQueryBuilderService');
const competencyService = require('../../services/competencyService');
const db = require('../../infrastructure/database');

class ContentStudioHandler {
  /**
   * Process Content Studio MS request using AI Query Builder
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async process(payload, responseTemplate) {
    try {
      // Use AI Query Builder to generate queries dynamically
      const responseTemplateData =
        (responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {};

      console.log('[ContentStudioHandler] Using AI Query Builder to generate queries', {
        payload,
        responseTemplateData
      });

      const { queries, data } = await aiQueryBuilderService.run({
        payload,
        responseTemplateData
      });

      console.log('[ContentStudioHandler] AI generated queries:', queries);

      // Execute queries and populate data
      const executedData = await this.executeQueries(queries, data, payload);

      // On success, return only the business result shape (executed data).
      return executedData;
    } catch (error) {
      console.error('[ContentStudioHandler] Error processing request:', {
        error: error.message,
        stack: error.stack
      });

      // Fallback to hard-coded logic if AI Query Builder fails
      console.warn('[ContentStudioHandler] Falling back to hard-coded logic');
      return this.processFallback(payload, responseTemplate);
    }
  }

  /**
   * Execute AI-generated queries and populate response data
   * @param {Array} queries - Generated queries from AI
   * @param {Object} dataTemplate - Empty data template
   * @param {Object} payload - Original request payload
   * @returns {Promise<Object>} Populated data
   */
  async executeQueries(queries, dataTemplate, payload) {
    const result = { ...dataTemplate };

    for (const query of queries) {
      try {
        console.log(`[ContentStudioHandler] Executing query: ${query.name}`, {
          language: query.language,
          text: query.text
        });

        if (query.language === 'sql') {
          // Execute SQL query
          const rows = await db.query(query.text);

          // Map results to data structure based on query target
          if (query.target) {
            this.mapQueryResultsToData(result, query.target, rows);
          }
        } else if (query.language === 'orm' || query.language === 'knex') {
          // Handle ORM/Knex queries (can be implemented later)
          console.warn('[ContentStudioHandler] ORM/Knex queries not yet implemented, skipping');
        }
      } catch (err) {
        console.error(`[ContentStudioHandler] Error executing query ${query.name}:`, {
          error: err.message,
          query: query.text
        });
        // Continue with other queries even if one fails
      }
    }

    // If no queries were executed successfully, populate with basic data
    if (Object.keys(result).length === 0 || !result.skills) {
      const { competency_id, competency_name } = payload;

      // Fallback: get skills using competencyService
      const skills = competency_id
        ? await competencyService.getRequiredMGS(competency_id)
        : await competencyService.getRequiredMGSByName(competency_name);

      result.competency_id = competency_id || null;
      result.competency_name = competency_name || null;
      result.skills = skills;
    }

    return result;
  }

  /**
   * Map query results to data structure
   * @param {Object} data - Data object to populate
   * @param {string} target - Target path or description
   * @param {Array} rows - Query result rows
   */
  mapQueryResultsToData(data, target, rows) {
    // Simple mapping based on target description
    if (target.includes('skills') || target.includes('MGS')) {
      data.skills = rows;
    } else if (target.includes('competency')) {
      if (rows.length > 0) {
        data.competency_id = rows[0].competency_id;
        data.competency_name = rows[0].competency_name;
      }
    } else {
      // Generic mapping: if target looks like a JSON path, try to set it
      const parts = target.split('.');
      if (parts.length === 1) {
        data[parts[0]] = rows;
      }
    }
  }

  /**
   * Fallback to hard-coded logic if AI Query Builder fails
   * @param {Object} payload - Request payload
   * @param {Object} responseTemplate - Response template
   * @returns {Promise<Object>} Response data
   */
  async processFallback(payload, responseTemplate) {
    try {
      const { competency_id, competency_name } = payload;

      // Get all related skills (MGS) for this competency
      const skills = competency_id
        ? await competencyService.getRequiredMGS(competency_id)
        : await competencyService.getRequiredMGSByName(competency_name);

      return {
        ...((responseTemplate && (responseTemplate.answer || responseTemplate.data)) || {}),
        competency_id: competency_id || null,
        competency_name: competency_name || null,
        skills
      };
    } catch (error) {
      return { message: error.message };
    }
  }
}

module.exports = new ContentStudioHandler();


