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
   * Extract competencies and skills from raw user data
   * @param {string} userId - User ID
   * @param {string} rawData - Raw data (resume, LinkedIn, GitHub, etc.)
   * @returns {Promise<Object>} Extracted data with competencies and skills arrays
   */
  async extractFromUserData(userId, rawData) {
    // Validate user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Chunk large data if needed (Gemini has token limits)
    const chunkedData = this.chunkData(rawData, 50000); // ~50k characters per chunk

    let allExtracted = {
      competencies: [],
      skills: []
    };

    // Process each chunk
    for (const chunk of chunkedData) {
      try {
        const extracted = await aiService.extractFromRawData(chunk);

        // Validate structure (must have top-level competencies[] and skills[])
        if (!aiService.validateExtractedData(extracted)) {
          throw new Error('Invalid extracted data structure');
        }

        // Merge results (AI returns { competencies: [], skills: [] })
        allExtracted.competencies.push(...(extracted.competencies || []));
        allExtracted.skills.push(...(extracted.skills || []));
      } catch (error) {
        console.error(`Error extracting from chunk: ${error.message}`);
        throw error;
      }
    }

    // Remove duplicates by name (case-insensitive)
    allExtracted.competencies = this.deduplicateByName(allExtracted.competencies);
    allExtracted.skills = this.deduplicateByName(allExtracted.skills);

    // Persist extracted items into taxonomy tables (competencies & skills)
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
   * Persist extracted competencies & skills into taxonomy tables.
   *
   * - Creates competencies in `competencies` table if they don't already exist
   * - Creates skills in `skills` table if they don't already exist
   * - Does NOT create hierarchy links here (those are handled by other features)
   *
   * @param {Object} extracted - { competencies: [], skills: [] }
   * @returns {Promise<{competencies: number, skills: number}>}
   */
  async persistToTaxonomy(extracted) {
    const stats = {
      competencies: 0,
      skills: 0,
    };

    if (!extracted) {
      return stats;
    }

    // Persist competencies
    if (Array.isArray(extracted.competencies)) {
      for (const item of extracted.competencies) {
        const name =
          typeof item === 'string'
            ? item.trim()
            : (item && typeof item.name === 'string' ? item.name.trim() : '');

        if (!name) continue;

        // Skip if competency already exists (case-insensitive match)
        const existing = await competencyRepository.findByName(name);
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

    // Persist skills
    if (Array.isArray(extracted.skills)) {
      for (const item of extracted.skills) {
        const name =
          typeof item === 'string'
            ? item.trim()
            : (item && typeof item.name === 'string' ? item.name.trim() : '');

        if (!name) continue;

        // Skip if skill already exists (case-insensitive match)
        const existing = await skillRepository.findByName(name);
        if (existing) continue;

        // Let the database generate the UUID for skill_id (default gen_random_uuid()).
        const model = new Skill({
          skill_name: name,
          parent_skill_id: null,
          description: item && typeof item.description === 'string' ? item.description : null,
        });

        await skillRepository.create(model);
        stats.skills += 1;
      }
    }

    return stats;
  }
}

module.exports = new ExtractionService();


