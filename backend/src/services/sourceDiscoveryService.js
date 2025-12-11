/**
 * Source Discovery Service
 *
 * Uses Gemini (via AIService) and the source_discovery_prompt.txt
 * to discover official external sources (URLs) and persist them
 * into the official_sources table.
 */

const aiService = require('./aiService');
const officialSourceRepository = require('../repositories/officialSourceRepository');
const OfficialSource = require('../models/OfficialSource');
const { access } = require('fs');

class SourceDiscoveryService {
  /**
   * Discover official sources via Gemini and store them in the database.
   *
   * Compares the discovered list with existing rows and only inserts
   * new URLs / source_ids into the official_sources table.
   *
   * @returns {Promise<{inserted: number, skipped: number, totalDiscovered: number, sources: object[]}>}
   */
  async discoverAndStoreSources() {
    const discovered = await aiService.discoverOfficialSources();

    if (!Array.isArray(discovered)) {
      throw new Error('discoverOfficialSources did not return an array');
    }

    // If Gemini returned an empty list, short‑circuit without touching the DB
    if (discovered.length === 0) {
      return {
        inserted: 0,
        skipped: 0,
        totalDiscovered: 0,
        sources: [],
      };
    }

    // Load existing minimal data to avoid inserting duplicates
    const existing = await officialSourceRepository.findAllMinimal();
    const existingIds = new Set(existing.map((e) => e.source_id));
    const existingUrls = new Set(existing.map((e) => e.reference_index_url));

    // Filter out entries that already exist by source_id or URL
    const newEntries = discovered.filter((entry) => {
      const id = entry.source_id;
      const url = entry.reference_index_url;
      if (!id && !url) return false;
      if (id && existingIds.has(id)) return false;
      if (url && existingUrls.has(url)) return false;
      return true;
    });

    const models = newEntries.map((entry) => {
      // Map hierarchy_support string -> boolean flag
      const hs = (entry.hierarchy_support || '').toString().toLowerCase();
      const hierarchySupportBool = hs === 'yes' || hs === 'true';

      return new OfficialSource({
        source_id: entry.source_id,
        source_name: entry.source_name,
        reference_index_url: entry.reference_index_url,
        reference_type: entry.reference_type,
        hierarchy_support: hierarchySupportBool,
        access_method: entry.access_method,
        provides: entry.provides,
        coveredtopic: entry.coveredtopic,
        skill_focus: entry.skill_focus,
        last_checked: new Date().toISOString(),
      });
    });

    const saved = models.length > 0 ? await officialSourceRepository.bulkUpsert(models) : [];

    return {
      inserted: saved.length,
      skipped: discovered.length - newEntries.length,
      totalDiscovered: discovered.length,
      sources: saved.map((s) => s.toJSON()),
    };
  }
}

module.exports = new SourceDiscoveryService();


