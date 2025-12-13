/**
 * Web Extraction Service (Feature 9.2)
 *
 * Uses Gemini (via AIService) and the semantic_extraction_prompt.txt
 * to perform deep semantic extraction from external source URLs.
 *
 * MVP implementation:
 * - Reads URLs from official_sources (reference_index_url)
 * - Calls AIService.extractFromWeb(urls)
 * - Persists extracted competencies & skills into the taxonomy tables
 * - Returns the raw { sources: [...] } JSON plus basic persistence stats
 */

const aiService = require('./aiService');
const crypto = require('crypto');
const officialSourceRepository = require('../repositories/officialSourceRepository');
const competencyRepository = require('../repositories/competencyRepository');
const skillRepository = require('../repositories/skillRepository');
const Competency = require('../models/Competency');
const Skill = require('../models/Skill');

class WebExtractionService {
  /**
   * Generate a pseudo-unique ID for competencies/skills
   * @param {string} prefix
   * @returns {string}
   */
  generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Persist extracted hierarchy from AI into competencies/skills tables.
   *
   * - Creates competencies and sub-competencies (2-layer tree) using CompetencyRepository
   * - Creates skills, subskills, microskills, nanoskills (N-level tree) using SkillRepository
   * - Links top-level skills to competencies via competency_skill (CompetencyRepository.linkSkill)
   *
   * @param {Object} extraction - JSON object with { sources: [...] }
   * @returns {Promise<{competencies: number, skills: number}>}
   */
  async persistExtraction(extraction) {
    console.log('[WebExtractionService.persistExtraction] called');

    const stats = {
      competencies: 0,
      skills: 0
    };

    if (!extraction || !Array.isArray(extraction.sources)) {
      console.warn(
        '[WebExtractionService.persistExtraction] No valid sources array in extraction payload',
        { hasExtraction: !!extraction }
      );
      return stats;
    }

    console.log(
      '[WebExtractionService.persistExtraction] Processing sources',
      { sourceCount: extraction.sources.length }
    );

    for (const source of extraction.sources) {
      if (!source || !source.data || !source.data.Competency) {
        console.warn(
          '[WebExtractionService.persistExtraction] Skipping source without Competency node',
          { sourceUrl: source && source.source_url }
        );
        continue;
      }

      // Derive a compact source identifier to persist on competencies/skills.
      // Prefer an explicit source_id (from official_sources) when present; otherwise
      // fall back to a truncated URL label.
      const rawUrl =
        source && typeof source.source_url === 'string'
          ? source.source_url.trim()
          : '';
      const explicitSourceId =
        source && typeof source.source_id === 'string'
          ? source.source_id.trim()
          : '';
      const sourceIdentifier =
        explicitSourceId ||
        (rawUrl && rawUrl.length > 0 ? rawUrl.slice(0, 100) : 'web_extraction');

      console.log(
        '[WebExtractionService.persistExtraction] Processing source competency tree',
        { sourceUrl: source.source_url, competencyName: source.data.Competency.name }
      );

      await this._processCompetencyNode(
        source.data.Competency,
        null,
        stats,
        sourceIdentifier
      );
    }

    console.log(
      '[WebExtractionService.persistExtraction] Completed persistence',
      { competenciesInserted: stats.competencies, skillsInserted: stats.skills }
    );

    return stats;
  }

  /**
   * Internal helper: create competency + children recursively.
   *
   * @param {Object} node - { name, Subcompetencies?, Skills? }
   * @param {string|null} parentCompetencyId
   * @param {Object} stats
   * @param {string} sourceIdentifier - Short identifier of the source (e.g., official source_id or URL label)
   * @returns {Promise<string>} competency_id
   */
  async _processCompetencyNode(node, parentCompetencyId, stats, sourceIdentifier) {
    const name = (node && node.name && typeof node.name === 'string')
      ? node.name.trim()
      : null;
    if (!name) {
      return null;
    }

    const competencyModel = new Competency({
      competency_id: crypto.randomUUID(),
      competency_name: name,
      description: node.description || null,
      parent_competency_id: parentCompetencyId,
      source: sourceIdentifier || 'web_extraction'
    });

    const competency = await competencyRepository.create(competencyModel);
    stats.competencies += 1;
    const competencyId = competency.competency_id;

    // Handle skills attached to this competency/sub-competency
    if (Array.isArray(node.Skills)) {
      for (const skillNode of node.Skills) {
        const rootSkillId = await this._processSkillNode(
          skillNode,
          null,
          stats,
          sourceIdentifier
        );
        if (rootSkillId) {
          // Link this root skill to the competency (L1 skill for this competency)
          await competencyRepository.linkSkill(competencyId, rootSkillId);
        }
      }
    }

    // Recurse into sub-competencies
    if (Array.isArray(node.Subcompetencies)) {
      for (const subNode of node.Subcompetencies) {
        await this._processCompetencyNode(subNode, competencyId, stats, sourceIdentifier);
      }
    }

    return competencyId;
  }

  /**
   * Internal helper: create skill and all nested children recursively.
   *
   * @param {Object|string} node - skill-like node or plain name
   * @param {string|null} parentSkillId
   * @param {Object} stats
   * @param {string} sourceIdentifier - Short identifier of the source (e.g., official source_id or URL label)
   * @returns {Promise<string>} skill_id
   */
  async _processSkillNode(node, parentSkillId, stats, sourceIdentifier) {
    let name;
    let description = null;

    if (typeof node === 'string') {
      name = node.trim();
    } else if (node && typeof node === 'object') {
      name = typeof node.name === 'string' ? node.name.trim() : null;
      description = typeof node.description === 'string' ? node.description : null;
    }

    if (!name) {
      return null;
    }

    const skillModel = new Skill({
      skill_id: crypto.randomUUID(),
      skill_name: name,
      parent_skill_id: parentSkillId,
      description,
      source: sourceIdentifier || 'web_extraction'
    });

    const skill = await skillRepository.create(skillModel);
    stats.skills += 1;
    const skillId = skill.skill_id;

    // Normalize node object for deeper traversal
    const obj = typeof node === 'string' ? {} : node || {};

    const childCollections = ['Subskills', 'Microskills', 'Nanoskills', 'children'];
    for (const key of childCollections) {
      if (Array.isArray(obj[key])) {
        for (const child of obj[key]) {
          await this._processSkillNode(child, skillId, stats, sourceIdentifier);
        }
      }
    }

    return skillId;
  }

  /**
   * Extract from explicitly provided URLs (bypasses DB lookup).
   *
   * @param {string[]} urls
   * @returns {Promise<Object>} JSON object with { sources: [...], stats: {...} }
   */
  async extractFromUrls(urls) {
    const allSources = [];
    const aggregatedStats = { competencies: 0, skills: 0 };

    // Process each URL independently: call Gemini, validate + normalize, then persist.
    for (const url of urls || []) {
      if (!url || typeof url !== 'string' || !url.trim()) {
        continue;
      }

      const rawExtraction = await aiService.extractFromWeb(url);

      // Basic validation of extraction structure (shape-level)
      if (
        !rawExtraction ||
        !Array.isArray(rawExtraction.sources) ||
        rawExtraction.sources.length === 0
      ) {
        console.warn('[WebExtractionService.extractFromUrls] Skipping URL with no valid sources', { url });
        continue;
      }

      // Semantic validation step BEFORE normalization (AI-based)
      const validation = await aiService.validateWebExtractionResult(rawExtraction);
      if (!validation || validation.valid !== true) {
        console.warn(
          '[WebExtractionService.extractFromUrls] Validation failed, skipping normalization and persistence',
          {
            url,
            reason: validation && validation.reason ? validation.reason : 'Unknown validation failure'
          }
        );
        continue;
      }

      // Normalize + clean the hierarchical structure using the dedicated prompt
      const normalizedExtraction = await aiService.normalizeWebExtractionResult(rawExtraction);
      const stats = await this.persistExtraction(normalizedExtraction);

      if (Array.isArray(normalizedExtraction.sources)) {
        allSources.push(...normalizedExtraction.sources);
      }

      aggregatedStats.competencies += stats.competencies || 0;
      aggregatedStats.skills += stats.skills || 0;
    }

    return {
      sources: allSources,
      stats: aggregatedStats,
    };
  }

  /**
   * Extract from all known official sources (Feature 9.1 output).
   *
   * Uses official_sources.reference_index_url as the URL list.
   *
   * @returns {Promise<Object>} JSON object with { sources: [...], stats: {...} }
   */
  async extractFromOfficialSources() {
    const minimal = await officialSourceRepository.findAllMinimal();

    if (!Array.isArray(minimal) || minimal.length === 0) {
      return { sources: [], stats: { competencies: 0, skills: 0 } };
    }

    const allSources = [];
    const aggregatedStats = { competencies: 0, skills: 0 };

    // Same per-source pipeline as extractFromUrls:
    // Gemini call → validation → normalization → persistence per URL,
    // but skip any source that has already been extracted.
    for (const entry of minimal) {
      const url = typeof entry.reference_index_url === 'string'
        ? entry.reference_index_url.trim()
        : '';

      if (!url) {
        continue;
      }

      // Skip URLs that have already been extracted
      if (entry.is_extracted) {
        console.log('[WebExtractionService.extractFromOfficialSources] Skipping already-extracted URL', {
          source_id: entry.source_id,
          url,
        });
        continue;
      }

      const rawExtraction = await aiService.extractFromWeb(url);

      if (
        !rawExtraction ||
        !Array.isArray(rawExtraction.sources) ||
        rawExtraction.sources.length === 0
      ) {
        console.warn('[WebExtractionService.extractFromOfficialSources] Skipping URL with no valid sources', {
          source_id: entry.source_id,
          url,
        });
        continue;
      }

      // Attach official source_id to each extracted source so that downstream
      // persistence can record where competencies/skills came from.
      if (Array.isArray(rawExtraction.sources)) {
        rawExtraction.sources = rawExtraction.sources.map((s) => ({
          ...s,
          source_id: entry.source_id
        }));
      }

      // Semantic validation step BEFORE normalization (AI-based)
      const validation = await aiService.validateWebExtractionResult(rawExtraction);
      if (!validation || validation.valid !== true) {
        console.warn(
          '[WebExtractionService.extractFromOfficialSources] Validation failed, skipping normalization and persistence',
          {
            source_id: entry.source_id,
            url,
            reason: validation && validation.reason ? validation.reason : 'Unknown validation failure'
          }
        );
        continue;
      }

      const normalizedExtraction = await aiService.normalizeWebExtractionResult(rawExtraction);
      const stats = await this.persistExtraction(normalizedExtraction);

      // Mark this source as extracted after successful persistence
      try {
        await officialSourceRepository.updateIsExtracted(entry.source_id, true);
      } catch (err) {
        console.warn(
          '[WebExtractionService.extractFromOfficialSources] Failed to update is_extracted flag',
          { source_id: entry.source_id, error: err.message }
        );
      }

      if (Array.isArray(normalizedExtraction.sources)) {
        allSources.push(...normalizedExtraction.sources);
      }

      aggregatedStats.competencies += stats.competencies || 0;
      aggregatedStats.skills += stats.skills || 0;
    }

    return {
      sources: allSources,
      stats: aggregatedStats,
    };
  }
}

module.exports = new WebExtractionService();



