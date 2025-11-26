/**
 * Normalization Service
 * 
 * Handles normalization and deduplication of extracted data.
 * Feature 2.3: Normalization & Deduplication
 */

const aiService = require('./aiService');
const skillRepository = require('../repositories/skillRepository');
const competencyRepository = require('../repositories/competencyRepository');

class NormalizationService {
  /**
   * Normalize extracted competencies and skills
   * @param {Object} extractedData - Extracted data with competencies and skills arrays
   * @returns {Promise<Object>} Normalized data with taxonomy ID mappings
   */
  async normalize(extractedData) {
    // Validate input structure
    if (!aiService.validateExtractedData(extractedData)) {
      throw new Error('Invalid extracted data structure');
    }

    // Call AI for normalization
    const normalized = await aiService.normalizeData(extractedData);

    // Gemini may return normalized competencies/skills as plain strings.
    // Convert them to objects with normalized_name so downstream mapping works.
    const normalizedCompetencies = (normalized.competencies || []).map((comp) =>
      typeof comp === 'string' ? { normalized_name: comp } : comp
    );

    const normalizedSkills = (normalized.skills || []).map((skill) =>
      typeof skill === 'string' ? { normalized_name: skill } : skill
    );

    // Validate normalized structure
    if (!normalized.competencies || !Array.isArray(normalized.competencies)) {
      throw new Error('Normalized data must contain competencies array');
    }

    if (!normalized.skills || !Array.isArray(normalized.skills)) {
      throw new Error('Normalized data must contain skills array');
    }

    // Map to taxonomy IDs
    const mappedCompetencies = await this.mapToTaxonomyIds(
      normalizedCompetencies,
      'competency'
    );

    const mappedSkills = await this.mapToTaxonomyIds(
      normalizedSkills,
      'skill'
    );

    return {
      competencies: mappedCompetencies,
      skills: mappedSkills
    };
  }

  /**
   * Map normalized names to taxonomy IDs
   * @param {Array} items - Array of items with normalized names
   * @param {string} type - 'competency' or 'skill'
   * @returns {Promise<Array>} Items with taxonomy IDs
   */
  async mapToTaxonomyIds(items, type) {
    const repository = type === 'competency' ? competencyRepository : skillRepository;
    const mapped = [];

    for (const item of items) {
      if (!item.normalized_name) {
        continue; // Skip items without normalized names
      }

      // Try to find existing item in taxonomy
      let taxonomyId = null;
      const existing = await repository.findByName(item.normalized_name);
      
      if (existing) {
        taxonomyId = type === 'competency' ? existing.competency_id : existing.skill_id;
      } else {
        // Generate new ID if not found (will be created later)
        taxonomyId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      mapped.push({
        ...item,
        taxonomy_id: taxonomyId,
        found_in_taxonomy: !!existing
      });
    }

    return mapped;
  }

  /**
   * Remove duplicates from normalized data
   * @param {Object} normalizedData - Normalized data
   * @returns {Object} Deduplicated data
   */
  deduplicate(normalizedData) {
    // Remove duplicate competencies by normalized_name
    const competencyMap = new Map();
    for (const comp of normalizedData.competencies || []) {
      const key = comp.normalized_name?.toLowerCase().trim();
      if (key && !competencyMap.has(key)) {
        competencyMap.set(key, comp);
      }
    }

    // Remove duplicate skills by normalized_name
    const skillMap = new Map();
    for (const skill of normalizedData.skills || []) {
      const key = skill.normalized_name?.toLowerCase().trim();
      if (key && !skillMap.has(key)) {
        skillMap.set(key, skill);
      }
    }

    return {
      competencies: Array.from(competencyMap.values()),
      skills: Array.from(skillMap.values())
    };
  }
}

module.exports = new NormalizationService();


