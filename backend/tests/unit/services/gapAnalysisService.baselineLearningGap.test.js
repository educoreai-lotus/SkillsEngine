/**
 * Unit tests for Baseline learning-gap helpers on GapAnalysisService.
 * Does not exercise Career Path or Post-course calculators.
 */

jest.mock('../../../src/repositories/userCompetencyRepository', () => ({}));
jest.mock('../../../src/repositories/userCareerPathRepository', () => ({}));
jest.mock('../../../src/repositories/competencyRepository', () => ({
  findAll: jest.fn()
}));
jest.mock('../../../src/services/competencyService', () => ({
  getRequiredMGS: jest.fn()
}));
jest.mock('../../../src/repositories/skillRepository', () => ({}));

const competencyRepository = require('../../../src/repositories/competencyRepository');
const competencyService = require('../../../src/services/competencyService');
const gapAnalysisService = require('../../../src/services/gapAnalysisService');

describe('GapAnalysisService Baseline learning-gap helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gapHasSkills', () => {
    it('returns false for {} and empty arrays', () => {
      expect(gapAnalysisService.gapHasSkills({})).toBe(false);
      expect(gapAnalysisService.gapHasSkills({ python: [] })).toBe(false);
      expect(gapAnalysisService.gapHasSkills(null)).toBe(false);
    });

    it('returns true when any competency has at least one skill', () => {
      expect(
        gapAnalysisService.gapHasSkills({
          python: [{ skill_id: 's1', skill_name: 'conditionals' }]
        })
      ).toBe(true);
    });
  });

  describe('findUniqueExactMgsMatch', () => {
    it('returns exact_mgs_match when exactly one competency MGS set equals the result set', async () => {
      competencyRepository.findAll.mockResolvedValue([
        { competency_id: 'comp-py', competency_name: 'python' },
        { competency_id: 'comp-js', competency_name: 'javascript' }
      ]);
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === 'comp-py') {
          return [
            { skill_id: 's-lambda', skill_name: 'lambda functions' },
            { skill_id: 's-cond', skill_name: 'conditionals' }
          ];
        }
        return [{ skill_id: 's-other', skill_name: 'other' }];
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch([
        's-cond',
        's-lambda'
      ]);

      expect(result).toEqual({ name: 'python', source: 'exact_mgs_match' });
      expect(competencyService.getRequiredMGSByName).toBeUndefined();
    });

    it('returns unresolved when no competency MGS set matches', async () => {
      competencyRepository.findAll.mockResolvedValue([
        { competency_id: 'comp-py', competency_name: 'python' }
      ]);
      competencyService.getRequiredMGS.mockResolvedValue([
        { skill_id: 's-lambda', skill_name: 'lambda functions' }
      ]);

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);
      expect(result).toEqual({ name: null, source: 'unresolved' });
    });

    it('returns ambiguous when more than one competency has the same MGS set', async () => {
      competencyRepository.findAll.mockResolvedValue([
        { competency_id: 'comp-a', competency_name: 'python' },
        { competency_id: 'comp-b', competency_name: 'python programming' }
      ]);
      competencyService.getRequiredMGS.mockResolvedValue([
        { skill_id: 's-cond', skill_name: 'conditionals' }
      ]);

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);
      expect(result).toEqual({ name: null, source: 'ambiguous' });
    });
  });
});
