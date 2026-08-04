/**
 * Unit tests for VerificationService.buildUpdatedProfilePayload pruning.
 *
 * Exercises the real serializer with mocked repositories only —
 * no Gemini, Coordinator, Directory, or live database.
 */

jest.mock('../../../src/repositories/userCompetencyRepository', () => ({
  findByUser: jest.fn(),
  findByUserAndCompetency: jest.fn(),
  findByUsers: jest.fn()
}));
jest.mock('../../../src/repositories/userSkillRepository', () => ({}));
jest.mock('../../../src/repositories/userCareerPathRepository', () => ({}));
jest.mock('../../../src/services/competencyService', () => ({}));
jest.mock('../../../src/repositories/skillRepository', () => ({}));
jest.mock('../../../src/repositories/competencyRepository', () => ({
  findById: jest.fn(),
  getParentCompetencies: jest.fn()
}));
jest.mock('../../../src/services/gapAnalysisService', () => ({}));
jest.mock('../../../src/services/learnerAIMSClient', () => ({}));
jest.mock('../../../src/services/directoryMSClient', () => ({}));
jest.mock('../../../src/services/userService', () => ({}));

const userCompetencyRepository = require('../../../src/repositories/userCompetencyRepository');
const competencyRepository = require('../../../src/repositories/competencyRepository');
const verificationService = require('../../../src/services/verificationService');

const USER_ID = '82434584-f857-4ad2-87f3-83cbf66f1901';

describe('VerificationService.buildUpdatedProfilePayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockLeafCompetency({
    competencyId = 'comp-js',
    competencyName = 'javascript',
    coverage = 0
  } = {}) {
    const userComp = {
      user_id: USER_ID,
      competency_id: competencyId,
      coverage_percentage: coverage,
      proficiency_level: 'undefined',
      verifiedSkills: []
    };

    userCompetencyRepository.findByUser.mockResolvedValue([userComp]);
    userCompetencyRepository.findByUserAndCompetency.mockResolvedValue(userComp);
    competencyRepository.findById.mockResolvedValue({
      competency_id: competencyId,
      competency_name: competencyName
    });
    competencyRepository.getParentCompetencies.mockResolvedValue([]);
  }

  it('default call prunes zero-coverage leaf competencies', async () => {
    mockLeafCompetency({ coverage: 0 });

    const result = await verificationService.buildUpdatedProfilePayload(USER_ID);

    expect(result.competencies).toEqual([]);
    expect(
      result.competencies.find((c) => c.competencyId === 'comp-js')
    ).toBeUndefined();
  });

  it('includeZeroCoverage retains zero-coverage leaf with coverage still 0', async () => {
    mockLeafCompetency({
      competencyId: 'comp-js',
      competencyName: 'javascript',
      coverage: 0
    });

    const result = await verificationService.buildUpdatedProfilePayload(USER_ID, {
      includeZeroCoverage: true
    });

    expect(result.competencies.length).toBeGreaterThan(0);
    const node = result.competencies.find((c) => c.competencyId === 'comp-js');
    expect(node).toBeDefined();
    expect(node.competencyName).toBe('javascript');
    expect(node.coverage).toBe(0);
    expect(node.level).toBe('undefined');
  });

  it('includeZeroCoverage preserves parent-child hierarchy field names', async () => {
    const parentId = 'comp-parent';
    const childId = 'comp-child';

    const parentUserComp = {
      user_id: USER_ID,
      competency_id: parentId,
      coverage_percentage: 0,
      proficiency_level: 'undefined',
      verifiedSkills: []
    };
    const childUserComp = {
      user_id: USER_ID,
      competency_id: childId,
      coverage_percentage: 0,
      proficiency_level: 'undefined',
      verifiedSkills: []
    };

    userCompetencyRepository.findByUser.mockResolvedValue([parentUserComp, childUserComp]);
    userCompetencyRepository.findByUserAndCompetency.mockImplementation(
      async (_userId, competencyId) => {
        if (competencyId === parentId) return parentUserComp;
        if (competencyId === childId) return childUserComp;
        return null;
      }
    );
    competencyRepository.findById.mockImplementation(async (competencyId) => {
      if (competencyId === parentId) {
        return { competency_id: parentId, competency_name: 'software engineering' };
      }
      if (competencyId === childId) {
        return { competency_id: childId, competency_name: 'javascript' };
      }
      return null;
    });
    competencyRepository.getParentCompetencies.mockImplementation(async (competencyId) => {
      if (competencyId === childId) {
        return [{ competency_id: parentId, competency_name: 'software engineering' }];
      }
      return [];
    });

    const result = await verificationService.buildUpdatedProfilePayload(USER_ID, {
      includeZeroCoverage: true
    });

    expect(result.competencies.length).toBeGreaterThan(0);
    const root = result.competencies[0];
    expect(root).toEqual(
      expect.objectContaining({
        competencyId: parentId,
        competencyName: 'software engineering',
        level: 'undefined',
        coverage: 0
      })
    );
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children[0]).toEqual(
      expect.objectContaining({
        competencyId: childId,
        competencyName: 'javascript',
        level: 'undefined',
        coverage: 0
      })
    );
  });
});
