/**
 * Official Source Repository
 *
 * Data access layer for official_sources table.
 * Uses Supabase client for database operations.
 */

const { getSupabaseClient } = require('../../config/supabase');
const OfficialSource = require('../models/OfficialSource');

class OfficialSourceRepository {
  constructor() {
    this.supabase = null;
  }

  /**
   * Get Supabase client instance
   */
  getClient() {
    if (!this.supabase) {
      this.supabase = getSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * Upsert a single official source by source_id
   * @param {OfficialSource} source
   * @returns {Promise<OfficialSource>}
   */
  async upsert(source) {
    const validation = source.validate();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { data, error } = await this.getClient()
      .from('official_sources')
      .upsert({
        source_id: source.source_id,
        source_name: source.source_name,
        reference_index_url: source.reference_index_url,
        reference_type: source.reference_type,
        access_method: source.access_method,
        hierarchy_support: source.hierarchy_support,
        provides: source.provides,
        coveredTopic: source.coveredTopic,
        skill_focus: source.skill_focus,
        notes: source.notes,
        last_checked: source.last_checked,
        is_extracted: source.is_extracted,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'source_id'
      })
      .select()
      .single();

    if (error) throw error;
    return new OfficialSource(data);
  }

  /**
   * Bulk upsert helper
   * @param {OfficialSource[]} sources
   * @returns {Promise<OfficialSource[]>}
   */
  async bulkUpsert(sources) {
    const saved = [];
    for (const source of sources) {
      const savedSource = await this.upsert(source);
      saved.push(savedSource);
    }
    return saved;
  }

  /**
   * Get minimal view of all existing sources (for de-duplication)
   * @returns {Promise<Array<{source_id: string, reference_index_url: string, is_extracted: boolean}>>}
   */
  async findAllMinimal() {
    const { data, error } = await this.getClient()
      .from('official_sources')
      .select('source_id, reference_index_url, is_extracted');

    if (error) throw error;
    return data;
  }

  /**
   * Mark a source as extracted (or not) by source_id
   * @param {string} sourceId
   * @param {boolean} isExtracted
   * @returns {Promise<OfficialSource>}
   */
  async updateIsExtracted(sourceId, isExtracted) {
    const { data, error } = await this.getClient()
      .from('official_sources')
      .update({
        is_extracted: isExtracted,
        updated_at: new Date().toISOString(),
      })
      .eq('source_id', sourceId)
      .select()
      .single();

    if (error) throw error;
    return new OfficialSource(data);
  }
}

module.exports = new OfficialSourceRepository();


