/**
 * AI Query Builder Service
 *
 * Uses Gemini (via aiService) to translate:
 *   - payload
 *   - responseTemplate.data
 *   - SCHEMA (database structure)
 * into a set of read-only queries (SQL / ORM / etc.).
 *
 * NOTE: This service is responsible only for PLANNING (building queries)
 * and shaping the read-side data. Actual DB execution should be handled
 * by a separate data access layer.
 */

const fs = require('fs');
const path = require('path');
const aiService = require('./aiService');

class AIQueryBuilderService {
  constructor() {
    // Cache full migration SQL schema; callers can override per-call if needed.
    const schemaPath = path.join(
      __dirname,
      '../../database/migrations/000_initial_schema.sql'
    );

    try {
      this.defaultSchema = fs.readFileSync(schemaPath, 'utf-8');
    } catch (err) {
      // If loading the SQL schema fails, fall back to an empty string so that
      // the service can still run (Gemini will just see no SCHEMA).
      console.warn(
        '[AIQueryBuilderService] Failed to load SQL schema from 000_initial_schema.sql',
        { error: err.message }
      );
      this.defaultSchema = '';
    }
  }

  /**
   * Build the prompt to send to Gemini for query generation.
   *
   * @param {Object} params
   * @param {Object} params.payload - Unified endpoint payload
   * @param {Object} params.responseTemplateData - responseTemplate.data from the unified request
   * @param {string|Object} params.schema - Database schema to use (SQL text or JSON model)
   * @returns {string} prompt text
   */
  buildPrompt({ payload, responseTemplateData, schema }) {
    const safePayload = payload || {};
    const safeTemplate = responseTemplateData || {};
    const safeSchema = schema || this.defaultSchema;

    // Allow either raw SQL text or a JSON schema object.
    const schemaText =
      typeof safeSchema === 'string'
        ? safeSchema
        : JSON.stringify(safeSchema, null, 2);
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
      '- Use ONLY entities, views, and functions that exist in SCHEMA.',
      '',
      'Domain rules for Skills Engine (VERY IMPORTANT):',
      '- Treat any of these payload fields as competency identifiers: \"competency_name\", \"competency_target_name\", \"topic\", \"topic_name\".',
      '- Do NOT invent a new entity for topics; map them to the existing competencies entity in SCHEMA.',
      '- When RESPONSE_TEMPLATE_DATA contains a field named exactly \"skills\" or whose name includes \"skills\" for a competency/topic, you MUST return only leaf skills (MGS) for that competency:',
      '  - A leaf/MGS skill is a skill that has NO children in the skills hierarchy.',
      '  - Use the existing schema relations (for example: competencies → competency_skill → skills, skill_subskill, or any RPCs provided in SCHEMA) to find leaf skills.',
      '  - Do NOT return parent or intermediate skills when the caller is asking for a competency\'s skills.',
      '- Prefer a small number of precise queries over many broad ones. Avoid SELECT *; select only the columns needed to populate RESPONSE_TEMPLATE_DATA.',
      '',
      'About the \"target\" field in each query:',
      '- \"target\" MUST describe exactly which part of response.data this query will populate.',
      '- It can be a simple JSON pointer like \"/skills\" or \"/competency\", or a short description like \"skills array for this competency\".',
      '- If multiple queries contribute to the same part of the response, give them the same target value.',
      '',
      'Return ONLY a JSON object matching the OUTPUT_CONTRACT shown below.',
      'Do not include explanations, comments, or markdown code fences.',
      '',
      'SCHEMA (database migration / structure):',
      schemaText,
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



