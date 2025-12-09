/**
 * AI Query Builder Service
 *
 * Uses Gemini (via aiService) to translate:
 *   - payload
 *   - responseTemplate.data
 *   - migration schema
 * into a set of read-only queries (SQL / ORM / etc.).
 *
 * NOTE: This service is responsible only for PLANNING (building queries)
 * and shaping the read-side data. Actual DB execution should be handled
 * by a separate data access layer.
 */

const aiService = require('./aiService');
const migrationTemplate = require('../registration/migrationTemplate.json');

class AIQueryBuilderService {
  constructor() {
    // Cache full migration schema; callers can override per-call if needed.
    this.defaultSchema = migrationTemplate;
  }

  /**
   * Build the prompt to send to Gemini for query generation.
   *
   * @param {Object} params
   * @param {Object} params.payload - Unified endpoint payload
   * @param {Object} params.responseTemplateData - responseTemplate.data from the unified request
   * @param {Object} params.schema - Schema/migration model to use
   * @returns {string} prompt text
   */
  buildPrompt({ payload, responseTemplateData, schema }) {
    const safePayload = payload || {};
    const safeTemplate = responseTemplateData || {};
    const safeSchema = schema || this.defaultSchema;

    const schemaJson = JSON.stringify(safeSchema, null, 2);
    const payloadJson = JSON.stringify(safePayload, null, 2);
    const templateJson = JSON.stringify(safeTemplate, null, 2);

    const outputContract = {
      queries: [
        {
          name: 'string',
          language: 'sql',
          text: 'SELECT ...',
          target: 'json-pointer-or-description-of-which-part-of-response.data'
        }
      ]
    };

    const outputContractJson = JSON.stringify(outputContract, null, 2);

    return [
      'You are a deterministic query planner and generator for the Skills Engine data model.',
      'You receive three JSON objects: SCHEMA, PAYLOAD, and RESPONSE_TEMPLATE_DATA.',
      '',
      'SCHEMA describes the internal Skills Engine data model as defined in the migration template.',
      'PAYLOAD is the unified endpoint payload sent by another microservice.',
      'RESPONSE_TEMPLATE_DATA is the exact JSON shape that must be filled in response.data.',
      '',
      'Your job:',
      '- Decide which entities, joins, and filters are needed to compute all requested fields in RESPONSE_TEMPLATE_DATA.',
      '- Generate the minimal set of READ-ONLY queries (no INSERT, UPDATE, DELETE) that can be executed to obtain this data.',
      '- Respect tenant boundaries (e.g., company_id) and any relevant filters from PAYLOAD.',
      '- Use ONLY entities and fields that exist in SCHEMA.',
      '',
      'Return ONLY a JSON object matching the OUTPUT_CONTRACT shown below.',
      'Do not include explanations, comments, or markdown code fences.',
      '',
      'SCHEMA:',
      schemaJson,
      '',
      'PAYLOAD:',
      payloadJson,
      '',
      'RESPONSE_TEMPLATE_DATA:',
      templateJson,
      '',
      'OUTPUT_CONTRACT (the exact JSON shape you must return):',
      outputContractJson
    ].join('\n');
  }

  /**
   * Ask Gemini to build queries for a given payload + responseTemplate.data.
   *
   * @param {Object} params
   * @param {Object} params.payload
   * @param {Object} params.responseTemplateData
   * @param {Object} [params.schemaOverride] - Optional override schema instead of default migration template
   * @returns {Promise<Array>} queries array
   */
  async buildQueries({ payload, responseTemplateData, schemaOverride }) {
    const schema = schemaOverride || this.defaultSchema;
    const prompt = this.buildPrompt({ payload, responseTemplateData, schema });

    const result = await aiService.callGeminiJSON(prompt, {
      modelType: 'flash'
    });

    if (!result || !Array.isArray(result.queries)) {
      throw new Error(
        '[AIQueryBuilderService] Gemini did not return a valid { queries: [...] } object'
      );
    }

    return result.queries;
  }

  /**
   * High-level helper: plan queries and return an empty data object shaped
   * like responseTemplateData. Actual DB execution and mapping from query
   * results into this shape should be implemented in a dedicated data layer.
   *
   * This method is useful as a single entry point from handlers:
   *   const { queries, data } = await aiQueryBuilder.run({ payload, responseTemplateData });
   *
   * @param {Object} params
   * @param {Object} params.payload
   * @param {Object} params.responseTemplateData
   * @param {Object} [params.schemaOverride]
   * @returns {Promise<{queries: Array, data: Object}>}
   */
  async run({ payload, responseTemplateData, schemaOverride }) {
    const queries = await this.buildQueries({
      payload,
      responseTemplateData,
      schemaOverride
    });

    // For now, we just clone the template structure to show the intended shape.
    // A future implementation should:
    //   - execute queries via a DB client,
    //   - map rows into this structure,
    //   - and return the fully populated data object.
    const dataTemplate =
      responseTemplateData && typeof responseTemplateData === 'object'
        ? JSON.parse(JSON.stringify(responseTemplateData))
        : {};

    return {
      queries,
      data: dataTemplate
    };
  }
}

module.exports = new AIQueryBuilderService();



