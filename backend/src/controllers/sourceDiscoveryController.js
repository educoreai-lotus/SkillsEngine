/**
 * Source Discovery Controller
 *
 * Admin-only endpoints to trigger official source (URL) discovery
 * via Gemini and persist results into the official_sources table.
 */

const sourceDiscoveryService = require('../services/sourceDiscoveryService');

class SourceDiscoveryController {
  /**
   * POST /api/source-discovery/run
   * Trigger source discovery and return summary.
   */
  async runDiscovery(req, res) {
    try {
      const result = await sourceDiscoveryService.discoverAndStoreSources();
      //console.log('result',result);
      return res.status(201).json({
        success: true,
        inserted: result.inserted,
        sources: result.sources,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Source discovery failed',
      });
    }
  }
}

module.exports = new SourceDiscoveryController();


