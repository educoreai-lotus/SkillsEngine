/**
 * AI Service
 * 
 * Google Gemini API integration service.
 * Handles all AI operations including extraction, normalization, and validation.
 */

const fs = require('fs').promises;
const path = require('path');
const { getModel, executeWithRetry } = require('../../config/ai');

class AIService {
  /**
   * Load prompt from file
   * @param {string} promptPath - Path to prompt file
   * @returns {Promise<string>}
   */
  async loadPrompt(promptPath) {
    try {
      const fullPath = path.join(__dirname, '../../', promptPath);
      const prompt = await fs.readFile(fullPath, 'utf-8');
      return prompt.trim();
    } catch (error) {
      throw new Error(`Failed to load prompt from ${promptPath}: ${error.message}`);
    }
  }

  /**
   * Call Gemini API with prompt
   * @param {string} prompt - Prompt text
   * @param {Object} options - Options
   * @param {string} options.modelType - 'flash' or 'pro' (default: 'flash')
   * @param {Object} options.generationConfig - Generation configuration
   * @returns {Promise<string>} Response text
   */
  async callGemini(prompt, options = {}) {
    const { modelType = 'flash', generationConfig = {} } = options;
    
    const defaultConfig = {
      temperature: 0.0,
      topP:1,
      topK: 1,
      maxOutputTokens: 50000,
      ...generationConfig
    };

    const model = getModel(modelType);

    return await executeWithRetry(async () => {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: defaultConfig
      });

      const response = await result.response;
      return response.text();
    });
  }

  /**
   * Call Gemini API and parse JSON response
   * @param {string} prompt - Prompt text
   * @param {Object} options - Options
   * @returns {Promise<Object>} Parsed JSON
   */
  async callGeminiJSON(prompt, options = {}) {
    // Let callGemini handle model + retry; we keep JSON handling focused here.
    const responseText = await this.callGemini(prompt, options);
    console.log('[Gemini raw response length]', responseText.length);
    console.log('[Gemini raw response full]', responseText);
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonText = (responseText || '').trim();

    // If Gemini returned nothing (or only whitespace), avoid parsing and either
    // return a safe default or throw a clear error. For source discovery and
    // similar flows, treating this as "no results" is acceptable.
  /*   if (!jsonText) {
      console.warn('[callGeminiJSON] Empty response from Gemini, returning empty array.');
      return [];
    } */

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    try {
      const parsed = JSON.parse(jsonText);
      console.log('[callGeminiJSON] Parsed JSON:', JSON.stringify(parsed, null, 2));
      return parsed;
    } catch (parseError) {
      const preview = jsonText.slice(0, 200);
      console.error('[callGeminiJSON] Raw response preview:', preview);
      throw new Error(
        `Gemini did not return valid JSON. Parse error: ${parseError.message}. Response preview: ${preview}`
      );
    }
  }

  /**
   * Extract skills and competencies from raw data
   * @param {string} rawData - Raw user data (resume, LinkedIn, etc.)
   * @returns {Promise<Object>} Extracted data
   */
  async extractFromRawData(rawData) {
    const promptPath = 'docs/prompts/skill_extraction_from_profile_prompt.txt';
    let prompt = await this.loadPrompt(promptPath);
    
    // Replace placeholder with actual data
    // Prompt uses {{raw_text}} as the placeholder
    prompt = prompt.replace('{{raw_text}}', rawData);

    return await this.callGeminiJSON(prompt, { modelType: 'flash' });
  }

  /**
   * Web deep search & semantic extraction from external URLs (Feature 9.2)
   *
   * Uses the semantic_extraction_prompt.txt specification and calls Gemini
   * **once per URL**, then merges all results into a single JSON object:
   * { sources: [...] }.
   *
   * @param {string[]|string} urls - URL or list of URLs to extract from
   * @returns {Promise<Object>} JSON object with { sources: [...] }
   */
  async extractFromWeb(urls) {
    // Normalize input to a non-empty array of URLs
    const urlList = Array.isArray(urls) ? urls : [urls];
    const cleaned = urlList
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u) => u.length > 0);

    if (cleaned.length === 0) {
      throw new Error('extractFromWeb requires at least one valid URL');
    }

    const promptPath = 'docs/prompts/semantic_extraction_prompt.txt';
    const basePrompt = await this.loadPrompt(promptPath);

    const allSources = [];

    // Call Gemini once per URL and merge the "sources" arrays
    for (const url of cleaned) {
      const prompt = `${basePrompt}\n${url}`;

      // Use the "pro" model here to align with the Deep Search / Pro requirement.
      const result = await this.callGeminiJSON(prompt, { modelType: 'pro' });

      if (!result) {
        continue;
      }

      if (Array.isArray(result.sources)) {
        allSources.push(...result.sources);
      } else if (result.source_url && result.data) {
        // Be tolerant if the model returns a single object instead of { sources: [...] }
        allSources.push({
          source_url: result.source_url,
          data: result.data,
        });
      } else {
        throw new Error('extractFromWeb expected a JSON object with a "sources" array or a { source_url, data } object');
      }
    }

    return { sources: allSources };
  }

  /**
   * Discover official external sources (URLs) for skills & competencies
   * using the source_discovery_prompt.txt specification.
   *
   * @returns {Promise<Array>} Array of discovered sources
   */
  async discoverOfficialSources() {
    const promptPath = 'docs/prompts/source_discovery_prompt.txt';
    const prompt = await this.loadPrompt(promptPath);
    // Use the flash model by default for better availability and lower latency.
    const result = await this.callGeminiJSON(prompt, { modelType: 'flash' });
    console.log('result', result);
    if (!Array.isArray(result)) {
      throw new Error('Expected Gemini to return an array of sources');
    }

    return result;
  }

  /**
   * Normalize extracted data
   * @param {Object} extractedData - Extracted competencies and skills
   * @returns {Promise<Object>} Normalized data
   */
  async normalizeData(extractedData) {
    const promptPath = 'docs/prompts/normalization_prompt.txt';
    let prompt = await this.loadPrompt(promptPath);
    
    // Replace placeholder with actual data
    prompt = prompt.replace('{{input_object}}', JSON.stringify(extractedData, null, 2));

    try {
      return await this.callGeminiJSON(prompt, { modelType: 'flash' });
    } catch (error) {
      // Fallback: if Gemini fails or returns invalid/empty JSON, do a simple local normalization
      console.warn(
        '[AIService.normalizeData] Gemini normalization failed, falling back to local normalization:',
        error.message
      );

      const normalizeArray = (items) =>
        (items || []).map((item) => {
          const name =
            typeof item === 'string'
              ? item
              : item && typeof item.name === 'string'
                ? item.name
                : '';

          const normalized_name = name.toLowerCase().trim();

          return {
            original_name: name,
            normalized_name
          };
        });

      return {
        competencies: normalizeArray(extractedData.competencies),
        skills: normalizeArray(extractedData.skills),
        mapping: {}
      };
    }
  }

  /**
   * Validate extracted data structure
   * @param {Object} data - Data to validate
   * @returns {boolean}
   */
  validateExtractedData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for competencies array
    if (!Array.isArray(data.competencies)) {
      return false;
    }

    // Check for skills array
    if (!Array.isArray(data.skills)) {
      return false;
    }

    // Validate competency structure (allow string or { name: string, ... })
    for (const competency of data.competencies) {
      if (typeof competency === 'string') {
        if (!competency.trim()) return false;
        continue;
      }
      if (!competency || typeof competency.name !== 'string' || !competency.name.trim()) {
        return false;
      }
    }

    // Validate skill structure (allow string or { name: string, ... })
    for (const skill of data.skills) {
      if (typeof skill === 'string') {
        if (!skill.trim()) return false;
        continue;
      }
      if (!skill || typeof skill.name !== 'string' || !skill.name.trim()) {
        return false;
      }
    }

    return true;
  }
}

module.exports = new AIService();


