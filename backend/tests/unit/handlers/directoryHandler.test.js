/**
 * Unit Tests for DirectoryHandler existing-user short-circuit
 *
 * Fully mocked — no Gemini, DB, Coordinator, or Directory calls.
 */

jest.mock('../../../src/services/userService', () => ({
  getUserProfile: jest.fn(),
  createBasicProfile: jest.fn(),
  buildInitialProfile: jest.fn()
}));
jest.mock('../../../src/services/competencyService', () => ({
  buildHierarchyFromCareerPath: jest.fn()
}));
jest.mock('../../../src/services/extractionService', () => ({
  extractFromUserData: jest.fn()
}));
jest.mock('../../../src/services/normalizationService', () => ({
  normalize: jest.fn(),
  deduplicate: jest.fn((data) => data)
}));
jest.mock('../../../src/repositories/competencyRepository', () => ({}));
jest.mock('../../../src/repositories/userCareerPathRepository', () => ({}));
jest.mock('../../../src/repositories/userCompetencyRepository', () => ({
  findByUser: jest.fn()
}));
jest.mock('../../../src/services/verificationService', () => ({
  buildUpdatedProfilePayload: jest.fn()
}));

const userService = require('../../../src/services/userService');
const competencyService = require('../../../src/services/competencyService');
const extractionService = require('../../../src/services/extractionService');
const normalizationService = require('../../../src/services/normalizationService');
const userCompetencyRepository = require('../../../src/repositories/userCompetencyRepository');
const verificationService = require('../../../src/services/verificationService');
const directoryHandler = require('../../../src/handlers/directory/index');

const USER_ID = '82434584-f857-4ad2-87f3-83cbf66f1901';
const EMPTY_TEMPLATE = {
  user_id: 0,
  competencies: [],
  relevance_score: 0
};

describe('DirectoryHandler.handleOnboardAndIngest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normalizationService.deduplicate.mockImplementation((data) => data);
  });

  describe('existing user with no stored competencies', () => {
    it('returns status processing and does not start onboarding', async () => {
      userService.getUserProfile.mockResolvedValue({ user: { user_id: USER_ID } });
      userCompetencyRepository.findByUser.mockResolvedValue([]);

      const result = await directoryHandler.handleOnboardAndIngest(
        { user_id: USER_ID },
        EMPTY_TEMPLATE
      );

      expect(result.status).toBe('processing');
      expect(result.competencies).toEqual([]);
      expect(result.message).toBe('Profile generation in progress');
      expect(result.message).not.toBe('User already exists');
      expect(result.userId).toBe(USER_ID);
      expect(result.relevance_score).toBe(0);

      expect(userService.createBasicProfile).not.toHaveBeenCalled();
      expect(competencyService.buildHierarchyFromCareerPath).not.toHaveBeenCalled();
      expect(extractionService.extractFromUserData).not.toHaveBeenCalled();
      expect(normalizationService.normalize).not.toHaveBeenCalled();
      expect(userService.buildInitialProfile).not.toHaveBeenCalled();
      expect(verificationService.buildUpdatedProfilePayload).not.toHaveBeenCalled();
    });
  });

  describe('existing user with stored competencies', () => {
    it('returns status completed with stored hierarchy and passes includeZeroCoverage', async () => {
      const hierarchy = [
        {
          competencyId: 'comp-js',
          competencyName: 'javascript',
          level: 'undefined',
          coverage: 0
        },
        {
          competencyId: 'comp-py',
          competencyName: 'python',
          level: 'undefined',
          coverage: 0
        }
      ];

      userService.getUserProfile.mockResolvedValue({ user: { user_id: USER_ID } });
      userCompetencyRepository.findByUser.mockResolvedValue([
        { user_id: USER_ID, competency_id: 'comp-js' },
        { user_id: USER_ID, competency_id: 'comp-py' }
      ]);
      verificationService.buildUpdatedProfilePayload.mockResolvedValue({
        userId: USER_ID,
        relevanceScore: 0,
        competencies: hierarchy
      });

      const result = await directoryHandler.handleOnboardAndIngest(
        { user_id: USER_ID },
        EMPTY_TEMPLATE
      );

      expect(result.status).toBe('completed');
      expect(result.competencies).toEqual(hierarchy);
      expect(result.competencies.length).toBeGreaterThan(0);
      expect(result.userId).toBe(USER_ID);
      expect(result.relevance_score).toBe(0);
      expect(result.relevanceScore).toBe(0);
      expect(result.message).not.toBe('User already exists');

      expect(userService.createBasicProfile).not.toHaveBeenCalled();
      expect(extractionService.extractFromUserData).not.toHaveBeenCalled();
      expect(normalizationService.normalize).not.toHaveBeenCalled();
      expect(userService.buildInitialProfile).not.toHaveBeenCalled();
      expect(verificationService.buildUpdatedProfilePayload).toHaveBeenCalledWith(
        USER_ID,
        { includeZeroCoverage: true }
      );
    });

    it('returns processing when reconstructed hierarchy is empty', async () => {
      userService.getUserProfile.mockResolvedValue({ user: { user_id: USER_ID } });
      userCompetencyRepository.findByUser.mockResolvedValue([
        { user_id: USER_ID, competency_id: 'comp-js' }
      ]);
      verificationService.buildUpdatedProfilePayload.mockResolvedValue({
        userId: USER_ID,
        relevanceScore: 0,
        competencies: []
      });

      const result = await directoryHandler.handleOnboardAndIngest(
        { user_id: USER_ID },
        EMPTY_TEMPLATE
      );

      expect(result.status).toBe('processing');
      expect(result.competencies).toEqual([]);
      expect(result.message).toBe('Profile generation in progress');
      expect(userService.createBasicProfile).not.toHaveBeenCalled();
      expect(extractionService.extractFromUserData).not.toHaveBeenCalled();
      expect(normalizationService.normalize).not.toHaveBeenCalled();
      expect(userService.buildInitialProfile).not.toHaveBeenCalled();
      expect(verificationService.buildUpdatedProfilePayload).toHaveBeenCalledWith(
        USER_ID,
        { includeZeroCoverage: true }
      );
    });
  });

  describe('new user', () => {
    it('continues the original onboarding/ingestion flow unchanged', async () => {
      userService.getUserProfile.mockRejectedValue(new Error(`User with ID ${USER_ID} not found`));

      const profile = {
        userId: USER_ID,
        relevanceScore: 0,
        competencies: [
          {
            competencyId: 'comp-js',
            competencyName: 'javascript',
            level: 'undefined',
            coverage: 0
          }
        ]
      };

      userService.createBasicProfile.mockResolvedValue({
        user_id: USER_ID,
        raw_data: { manual: { skills: ['javascript'] } },
        path_career: 'senior developer'
      });
      competencyService.buildHierarchyFromCareerPath.mockResolvedValue({ competenciesCreated: 1 });
      extractionService.extractFromUserData.mockResolvedValue({
        competencies: ['javascript']
      });
      normalizationService.normalize.mockResolvedValue({
        competencies: [{ normalized_name: 'javascript' }]
      });
      userService.buildInitialProfile.mockResolvedValue(profile);

      const result = await directoryHandler.handleOnboardAndIngest(
        {
          user_id: USER_ID,
          raw_data: { manual: { skills: ['javascript'] } },
          path_career: 'senior developer'
        },
        EMPTY_TEMPLATE
      );

      expect(userService.createBasicProfile).toHaveBeenCalled();
      expect(competencyService.buildHierarchyFromCareerPath).toHaveBeenCalledWith(
        'senior developer'
      );
      expect(extractionService.extractFromUserData).toHaveBeenCalled();
      expect(normalizationService.normalize).toHaveBeenCalled();
      expect(normalizationService.deduplicate).toHaveBeenCalled();
      expect(userService.buildInitialProfile).toHaveBeenCalled();
      expect(userCompetencyRepository.findByUser).not.toHaveBeenCalled();
      expect(verificationService.buildUpdatedProfilePayload).not.toHaveBeenCalled();

      expect(result.userId).toBe(USER_ID);
      expect(result.competencies).toEqual(profile.competencies);
      expect(result.relevanceScore).toBe(0);
      expect(result.status).toBeUndefined();
    });
  });

  describe('response template precedence', () => {
    it('does not let template competencies: [] overwrite a real hierarchy', async () => {
      const hierarchy = [
        {
          competencyId: 'comp-1',
          competencyName: 'javascript',
          level: 'undefined',
          coverage: 0,
          children: []
        }
      ];

      userService.getUserProfile.mockResolvedValue({ user: { user_id: USER_ID } });
      userCompetencyRepository.findByUser.mockResolvedValue([
        { user_id: USER_ID, competency_id: 'comp-1' }
      ]);
      verificationService.buildUpdatedProfilePayload.mockResolvedValue({
        userId: USER_ID,
        relevanceScore: 0,
        competencies: hierarchy
      });

      const result = await directoryHandler.handleOnboardAndIngest(
        { user_id: USER_ID },
        {
          user_id: 0,
          competencies: [],
          relevance_score: 0
        }
      );

      expect(result.status).toBe('completed');
      expect(result.competencies).toEqual(hierarchy);
      expect(result.competencies).not.toEqual([]);
      expect(result.userId).toBe(USER_ID);
      expect(verificationService.buildUpdatedProfilePayload).toHaveBeenCalledWith(
        USER_ID,
        { includeZeroCoverage: true }
      );
    });
  });

  describe('no duplicate processing', () => {
    it('returns processing without invoking first-time profile generation', async () => {
      userService.getUserProfile.mockResolvedValue({ user: { user_id: USER_ID } });
      userCompetencyRepository.findByUser.mockResolvedValue([]);

      const result = await directoryHandler.handleOnboardAndIngest(
        {
          user_id: USER_ID,
          raw_data: { linkedin: 'data' },
          path_career: 'senior developer'
        },
        EMPTY_TEMPLATE
      );

      expect(result.status).toBe('processing');
      expect(result.competencies).toEqual([]);
      expect(userService.createBasicProfile).not.toHaveBeenCalled();
      expect(competencyService.buildHierarchyFromCareerPath).not.toHaveBeenCalled();
      expect(extractionService.extractFromUserData).not.toHaveBeenCalled();
      expect(normalizationService.normalize).not.toHaveBeenCalled();
      expect(userService.buildInitialProfile).not.toHaveBeenCalled();
      expect(verificationService.buildUpdatedProfilePayload).not.toHaveBeenCalled();
    });
  });
});
