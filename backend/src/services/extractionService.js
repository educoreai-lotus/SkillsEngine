/**
 * Extraction Service
 * 
 * Handles AI extraction of skills and competencies from raw user data.
 * Feature 2.2: AI Extraction of Raw Data
 */

const aiService = require('./aiService');
const userRepository = require('../repositories/userRepository');
const competencyRepository = require('../repositories/competencyRepository');
const skillRepository = require('../repositories/skillRepository');
const Competency = require('../models/Competency');
const Skill = require('../models/Skill');

class ExtractionService {
  /**
   * Extract competencies from raw user data
   * Note: Skills are now treated as competencies - all extracted items go into competencies array
   * @param {string} userId - User ID
   * @param {string|Object} rawData - Raw data (resume, LinkedIn, GitHub, etc.) as text or JSON-like object
   * @returns {Promise<Object>} Extracted data with competencies array only
   */
  async extractFromUserData(userId, rawData) {
    // Validate user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    if (rawData === undefined || rawData === null) {
      throw new Error('rawData is required for extraction');
    }

    // Normalize rawData so downstream functions always work with a string.
    // Accept:
    // - string: used as-is
    // - object/array: JSON.stringify for AI prompt / chunking
    if (typeof rawData !== 'string') {
      try {
        rawData = JSON.stringify(rawData, null, 2);
      } catch (e) {
        throw new Error('rawData must be a string or JSON-serializable object');
      }
    }

    // Chunk large data if needed (Gemini has token limits)
    const chunkedData = this.chunkData(rawData, 50000); // ~50k characters per chunk

    let allExtracted = {
      competencies: []
    };

    // Process each chunk
    for (const chunk of chunkedData) {
      try {
        const extracted = await aiService.extractFromRawData(chunk);

        // Validate structure
        if (!aiService.validateExtractedData(extracted)) {
          throw new Error('Invalid extracted data structure');
        }

        // Handle different response formats:
        // 1. Direct array format: ["React", "Node.js", ...] (new prompt format)
        // 2. Object format: { competencies: [...] } (backward compatibility)
        if (Array.isArray(extracted)) {
          // New format: direct array of competencies
          allExtracted.competencies.push(...extracted);
        } else if (extracted.competencies && Array.isArray(extracted.competencies)) {
          // Old format: object with competencies array
          allExtracted.competencies.push(...extracted.competencies);
          // Backward compatibility: merge skills array if present
          if (extracted.skills && Array.isArray(extracted.skills)) {
            allExtracted.competencies.push(...extracted.skills);
          }
        }
      } catch (error) {
        console.error(`Error extracting from chunk: ${error.message}`);
        throw error;
      }
    }

    // Remove duplicates by name (case-insensitive)
    allExtracted.competencies = this.deduplicateByName(allExtracted.competencies);

    // Persist extracted items into taxonomy tables (competencies only)
    const stats = await this.persistToTaxonomy(allExtracted);

    // TODO: Emit extraction event for downstream processing
    // eventEmitter.emit('extraction.completed', { userId, extracted: allExtracted, stats });

    return {
      ...allExtracted,
      stats,
    };
  }

  /**
   * Chunk large text data for processing
   * @param {string} data - Text data
   * @param {number} maxChunkSize - Maximum chunk size in characters
   * @returns {string[]} Array of chunks
   */
  chunkData(data, maxChunkSize = 50000) {
    if (data === undefined || data === null) {
      throw new Error('chunkData requires non-null data input');
    }

    // Ensure we are always working with a string, even if a caller passed
    // an object/array directly.
    if (typeof data !== 'string') {
      try {
        data = JSON.stringify(data, null, 2);
      } catch (e) {
        throw new Error('chunkData expected a string or JSON-serializable object');
      }
    }

    if (!data || data.length <= maxChunkSize) {
      return [data];
    }

    const chunks = [];
    let currentChunk = '';

    // Try to split by paragraphs or sentences
    const paragraphs = data.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // If single paragraph is too large, split by sentences
        if (paragraph.length > maxChunkSize) {
          const sentences = paragraph.split(/[.!?]+\s+/);
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize) {
              if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
              }
            }
            currentChunk += sentence + '. ';
          }
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += '\n\n' + paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Remove duplicates by name (case-insensitive)
   * @param {Array} items - Array of items with 'name' property
   * @returns {Array} Deduplicated array
   */
  deduplicateByName(items) {
    const seen = new Set();
    return items.filter(item => {
      const rawName =
        typeof item === 'string'
          ? item
          : item && typeof item.name === 'string'
            ? item.name
            : '';

      const normalizedName = rawName.toLowerCase().trim();
      if (!normalizedName || seen.has(normalizedName)) {
        return false;
      }
      seen.add(normalizedName);
      return true;
    });
  }

  /**
   * Persist extracted competencies into taxonomy tables.
   *
   * - Creates competencies in `competencies` table if they don't already exist
   * - Skills are now treated as competencies, so everything goes into competencies table
   * - Does NOT create hierarchy links here (those are handled by other features)
   *
   * @param {Object} extracted - { competencies: [] }
   * @returns {Promise<{competencies: number}>}
   */
  async persistToTaxonomy(extracted) {
    const stats = {
      competencies: 0,
    };

    if (!extracted) {
      return stats;
    }

    // Persist competencies (includes both traditional competencies and skills)
    if (Array.isArray(extracted.competencies)) {
      for (const item of extracted.competencies) {
        const name =
          typeof item === 'string'
            ? item.trim()
            : (item && typeof item.name === 'string' ? item.name.trim() : '');

        if (!name) continue;

        // Skip if competency already exists (check exact match and semantic duplicates)
        let existing = await competencyRepository.findByName(name);

        // If not found, try semantic duplicate detection
        if (!existing) {
          const competencyService = require('./competencyService');
          existing = await competencyService.findSemanticDuplicate(name);
        }

        if (existing) continue;

        // Let the database generate the UUID for competency_id (default gen_random_uuid()).
        const model = new Competency({
          competency_name: name,
          description: item && typeof item.description === 'string' ? item.description : null,
          parent_competency_id: null,
        });

        await competencyRepository.create(model);
        stats.competencies += 1;
      }
    }

    return stats;
  }
}

module.exports = new ExtractionService();


