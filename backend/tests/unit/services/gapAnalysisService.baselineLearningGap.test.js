/**
 * Unit tests for Baseline learning-gap helpers on GapAnalysisService.
 * Does not exercise Career Path or Post-course calculators.
 */

jest.mock('../../../src/repositories/userCompetencyRepository', () => ({}));
jest.mock('../../../src/repositories/userCareerPathRepository', () => ({}));
jest.mock('../../../src/repositories/competencyRepository', () => ({
  findAll: jest.fn(),
  findParent: jest.fn(),
  getParentCompetencies: jest.fn()
}));
jest.mock('../../../src/services/competencyService', () => ({
  getRequiredMGS: jest.fn(),
  getCompetenciesBySkill: jest.fn(),
  getCompetencyById: jest.fn()
}));
jest.mock('../../../src/repositories/skillRepository', () => ({}));

const competencyRepository = require('../../../src/repositories/competencyRepository');
const competencyService = require('../../../src/services/competencyService');
const gapAnalysisService = require('../../../src/services/gapAnalysisService');

const JS = { competency_id: 'comp-js', competency_name: 'javascript' };
const CONTROL_FLOW = { competency_id: 'comp-cf', competency_name: 'control flow and functions' };
const PYTHON = { competency_id: 'comp-py', competency_name: 'python' };
const PARENT = { competency_id: 'comp-se', competency_name: 'software engineering' };

describe('GapAnalysisService Baseline learning-gap helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    competencyRepository.findAll.mockResolvedValue([]);
    competencyRepository.findParent.mockResolvedValue(null);
    competencyRepository.getParentCompetencies.mockResolvedValue([]);
    competencyService.getCompetenciesBySkill.mockResolvedValue([]);
    competencyService.getRequiredMGS.mockResolvedValue([]);
    competencyService.getCompetencyById.mockResolvedValue(null);
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
    it('Test 1: large JavaScript set resolves uniquely without a full competency scan', async () => {
      const skillIds = Array.from({ length: 166 }, (_, i) => `skill-js-${i}`);
      competencyService.getCompetenciesBySkill.mockResolvedValue([JS]);
      competencyRepository.findParent.mockResolvedValue(null);
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return skillIds.map((skill_id) => ({ skill_id, skill_name: skill_id }));
        }
        return [{ skill_id: 'other', skill_name: 'other' }];
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch(skillIds);

      expect(result).toEqual({ name: 'javascript', source: 'exact_mgs_match' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
      expect(competencyRepository.getParentCompetencies).not.toHaveBeenCalled();
      expect(competencyService.getCompetenciesBySkill).toHaveBeenCalledTimes(166);
      expect(competencyService.getRequiredMGS).toHaveBeenCalledTimes(1);
      expect(competencyService.getRequiredMGS).toHaveBeenCalledWith(JS.competency_id);
    });

    it('Test 2: child-only reverse-map still preserves the root via parent_competency_id', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([CONTROL_FLOW]);
      competencyRepository.findParent.mockImplementation(async (id) => {
        if (id === CONTROL_FLOW.competency_id) {
          return JS;
        }
        return null;
      });
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return [
            { skill_id: 's-for', skill_name: 'for loop' },
            { skill_id: 's-if', skill_name: 'conditionals' }
          ];
        }
        if (id === CONTROL_FLOW.competency_id) {
          return [{ skill_id: 's-for', skill_name: 'for loop' }];
        }
        return [];
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-for', 's-if']);

      expect(result).toEqual({ name: 'javascript', source: 'exact_mgs_match' });
      expect(competencyRepository.findParent).toHaveBeenCalledWith(CONTROL_FLOW.competency_id);
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
      expect(competencyRepository.getParentCompetencies).not.toHaveBeenCalled();
    });

    it('Test 3: many-to-many skill does not decide the target alone', async () => {
      competencyService.getCompetenciesBySkill.mockImplementation(async (skillId) => {
        if (skillId === 's-for') {
          return [CONTROL_FLOW, JS];
        }
        if (skillId === 's-if') {
          return [JS];
        }
        return [];
      });
      competencyRepository.findParent.mockResolvedValue(null);
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return [
            { skill_id: 's-for', skill_name: 'for loop' },
            { skill_id: 's-if', skill_name: 'conditionals' }
          ];
        }
        return [{ skill_id: 's-for', skill_name: 'for loop' }];
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-for', 's-if']);

      expect(result).toEqual({ name: 'javascript', source: 'exact_mgs_match' });
      expect(competencyService.getRequiredMGS).not.toHaveBeenCalledWith(CONTROL_FLOW.competency_id);
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('Test 4: zero intersection is unresolved and does not scan all competencies', async () => {
      competencyService.getCompetenciesBySkill.mockImplementation(async (skillId) => {
        if (skillId === 's-a') {
          return [JS];
        }
        if (skillId === 's-b') {
          return [PYTHON];
        }
        return [];
      });
      competencyRepository.findParent.mockResolvedValue(null);

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-a', 's-b']);

      expect(result).toEqual({ name: null, source: 'unresolved' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
      expect(competencyService.getRequiredMGS).not.toHaveBeenCalled();
    });

    it('Test 5: surviving candidate whose MGS differs is unresolved', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([JS]);
      competencyRepository.findParent.mockResolvedValue(null);
      competencyService.getRequiredMGS.mockResolvedValue([
        { skill_id: 's-other', skill_name: 'other' }
      ]);

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);

      expect(result).toEqual({ name: null, source: 'unresolved' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('Test 6: two candidates with identical exact MGS are ambiguous', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([
        { competency_id: 'comp-a', competency_name: 'python' },
        { competency_id: 'comp-b', competency_name: 'python programming' }
      ]);
      competencyRepository.findParent.mockResolvedValue(null);
      competencyService.getRequiredMGS.mockResolvedValue([
        { skill_id: 's-cond', skill_name: 'conditionals' }
      ]);

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);

      expect(result).toEqual({ name: null, source: 'ambiguous' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('Test 7: getRequiredMGS timeout on any final candidate is fail-closed', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([JS, PARENT]);
      competencyRepository.findParent.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return PARENT;
        }
        return null;
      });
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === PARENT.competency_id) {
          throw new Error('canceling statement due to statement timeout');
        }
        if (id === JS.competency_id) {
          return [{ skill_id: 's-cond', skill_name: 'conditionals' }];
        }
        return [];
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);

      expect(result).toEqual({ name: null, source: 'verification_failed' });
      expect(result.name).not.toBe('javascript');
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('fail-closed: exact match plus a throwing sibling is unresolved, not the match', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([JS, PARENT]);
      competencyRepository.findParent.mockResolvedValue(null);
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return [{ skill_id: 's-cond', skill_name: 'conditionals' }];
        }
        throw new Error('canceling statement due to statement timeout');
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);

      expect(result).toEqual({ name: null, source: 'verification_failed' });
      expect(result.name).not.toBe('javascript');
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('fail-closed: single candidate getRequiredMGS throw is unresolved', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([JS]);
      competencyRepository.findParent.mockResolvedValue(null);
      competencyService.getRequiredMGS.mockRejectedValue(
        new Error('canceling statement due to statement timeout')
      );

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);

      expect(result).toEqual({ name: null, source: 'verification_failed' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('rejects a parent superset that survives intersection', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([JS]);
      competencyRepository.findParent.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return PARENT;
        }
        return null;
      });
      competencyService.getRequiredMGS.mockImplementation(async (id) => {
        if (id === JS.competency_id) {
          return [{ skill_id: 's-cond', skill_name: 'conditionals' }];
        }
        return [
          { skill_id: 's-cond', skill_name: 'conditionals' },
          { skill_id: 's-extra', skill_name: 'design patterns' }
        ];
      });

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-cond']);

      expect(result).toEqual({ name: 'javascript', source: 'exact_mgs_match' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
    });

    it('returns unresolved when a skill has no reverse-mapped competencies', async () => {
      competencyService.getCompetenciesBySkill.mockResolvedValue([]);

      const result = await gapAnalysisService.findUniqueExactMgsMatch(['s-orphan']);

      expect(result).toEqual({ name: null, source: 'unresolved' });
      expect(competencyRepository.findAll).not.toHaveBeenCalled();
      expect(competencyService.getRequiredMGS).not.toHaveBeenCalled();
    });
  });
});
