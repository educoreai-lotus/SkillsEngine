/**
 * Unit tests for Baseline-only Learner AI learning-gap handoff.
 *
 * Mocks repositories and MS clients. Does not change Assessment,
 * Directory, Coordinator, or Learner contracts.
 */

jest.mock('../../../src/repositories/userCompetencyRepository', () => ({
  findByUser: jest.fn(),
  findByUserAndCompetency: jest.fn(),
  update: jest.fn()
}));
jest.mock('../../../src/repositories/userSkillRepository', () => ({}));
jest.mock('../../../src/repositories/userCareerPathRepository', () => ({
  findByUser: jest.fn()
}));
jest.mock('../../../src/services/competencyService', () => ({
  getCompetenciesBySkill: jest.fn(),
  getRequiredMGS: jest.fn(),
  getCompetencyById: jest.fn()
}));
jest.mock('../../../src/repositories/skillRepository', () => ({
  findByName: jest.fn(),
  isLeaf: jest.fn()
}));
jest.mock('../../../src/repositories/competencyRepository', () => ({
  findById: jest.fn(),
  findByName: jest.fn(),
  findAll: jest.fn(),
  findParent: jest.fn(),
  getParentCompetencies: jest.fn()
}));
jest.mock('../../../src/services/learnerAIMSClient', () => ({
  sendGapAnalysis: jest.fn()
}));
jest.mock('../../../src/services/directoryMSClient', () => ({
  sendUpdatedProfile: jest.fn()
}));
jest.mock('../../../src/services/userService', () => ({
  getUserProfile: jest.fn()
}));

const userCompetencyRepository = require('../../../src/repositories/userCompetencyRepository');
const userCareerPathRepository = require('../../../src/repositories/userCareerPathRepository');
const competencyService = require('../../../src/services/competencyService');
const skillRepository = require('../../../src/repositories/skillRepository');
const competencyRepository = require('../../../src/repositories/competencyRepository');
const learnerAIMSClient = require('../../../src/services/learnerAIMSClient');
const directoryMSClient = require('../../../src/services/directoryMSClient');
const userService = require('../../../src/services/userService');
const verificationService = require('../../../src/services/verificationService');

const USER_ID = '82434584-f857-4ad2-87f3-83cbf66f1901';
const EXAM_ID = 477;

const SKILLS = {
  lambda: { skill_id: 'skill-lambda', skill_name: 'lambda functions' },
  conditionals: { skill_id: 'skill-cond', skill_name: 'conditionals' },
  defining: { skill_id: 'skill-def', skill_name: 'defining functions' },
  params: { skill_id: 'skill-params', skill_name: 'parameters & return' },
  forLoop: { skill_id: 'skill-for', skill_name: 'for loop' }
};

function resultSkill(key, status, score = 0) {
  return {
    skill_id: SKILLS[key].skill_id,
    skill_name: SKILLS[key].skill_name,
    status,
    score
  };
}

describe('VerificationService.processBaselineExamResults learning gap', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userCareerPathRepository.findByUser.mockResolvedValue([]);
    userCompetencyRepository.findByUser.mockResolvedValue([]);
    userCompetencyRepository.findByUserAndCompetency.mockResolvedValue(null);
    userCompetencyRepository.update.mockResolvedValue({});
    skillRepository.isLeaf.mockResolvedValue(true);
    skillRepository.findByName.mockResolvedValue(null);
    competencyService.getCompetenciesBySkill.mockResolvedValue([]);
    competencyService.getRequiredMGS.mockResolvedValue([]);
    competencyService.getCompetencyById.mockResolvedValue(null);
    competencyRepository.findByName.mockResolvedValue(null);
    competencyRepository.findById.mockResolvedValue(null);
    competencyRepository.findAll.mockResolvedValue([]);
    competencyRepository.findParent.mockResolvedValue(null);
    competencyRepository.getParentCompetencies.mockResolvedValue([]);
    userService.getUserProfile.mockResolvedValue({
      user: {
        user_name: 'Ada',
        path_career: 'senior developer',
        company_id: 'company-1',
        company_name: 'Acme'
      }
    });
    learnerAIMSClient.sendGapAnalysis.mockResolvedValue({});
    directoryMSClient.sendUpdatedProfile.mockResolvedValue({});
  });

  function mockPythonName() {
    competencyRepository.findByName.mockImplementation(async (name) => {
      if (typeof name === 'string' && name.toLowerCase().trim() === 'python') {
        return { competency_id: 'comp-python', competency_name: 'python' };
      }
      return null;
    });
  }

  it('Case 1: failed skill + resolved target sends Learner path request once', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      passed: true,
      competency_name: 'python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis).toHaveBeenCalledTimes(1);
    expect(learnerAIMSClient.sendGapAnalysis).toHaveBeenCalledWith(
      USER_ID,
      {
        python: [{ skill_id: SKILLS.conditionals.skill_id, skill_name: 'conditionals' }]
      },
      'narrow',
      'python',
      'fail'
    );
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
  });

  it('Case 2: acquired is omitted and failed is included', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [
        resultSkill('lambda', 'acquired', 100),
        resultSkill('conditionals', 'failed', 43)
      ]
    });

    const [, gap] = learnerAIMSClient.sendGapAnalysis.mock.calls[0];
    const sentIds = gap.python.map((s) => s.skill_id);
    expect(sentIds).toEqual([SKILLS.conditionals.skill_id]);
    expect(sentIds).not.toContain(SKILLS.lambda.skill_id);
  });

  it('Case 3: unpersisted acquired skill is still excluded from the gap', async () => {
    mockPythonName();
    competencyService.getCompetenciesBySkill.mockImplementation(async (skillId) => {
      if (skillId === SKILLS.forLoop.skill_id) {
        return [{
          competency_id: 'comp-control-flow',
          competency_name: 'control flow and functions'
        }];
      }
      return [];
    });
    userCompetencyRepository.findByUserAndCompetency.mockResolvedValue(null);

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [
        resultSkill('forLoop', 'acquired', 100),
        resultSkill('conditionals', 'failed', 43)
      ]
    });

    expect(userCompetencyRepository.update).not.toHaveBeenCalled();
    const [, gap] = learnerAIMSClient.sendGapAnalysis.mock.calls[0];
    expect(gap.python.map((s) => s.skill_id)).toEqual([SKILLS.conditionals.skill_id]);
    expect(gap.python.map((s) => s.skill_id)).not.toContain(SKILLS.forLoop.skill_id);
  });

  it('Case 4: all acquired skills do not call Learner AI', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [
        resultSkill('lambda', 'acquired', 100),
        resultSkill('forLoop', 'acquired', 100)
      ]
    });

    expect(learnerAIMSClient.sendGapAnalysis).not.toHaveBeenCalled();
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
  });

  it('Case 5: error status is excluded from the Baseline gap', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [
        resultSkill('defining', 'error', 0),
        resultSkill('params', 'error', 0),
        resultSkill('conditionals', 'failed', 43)
      ]
    });

    const [, gap] = learnerAIMSClient.sendGapAnalysis.mock.calls[0];
    const sentIds = gap.python.map((s) => s.skill_id);
    expect(sentIds).toEqual([SKILLS.conditionals.skill_id]);
    expect(sentIds).not.toContain(SKILLS.defining.skill_id);
    expect(sentIds).not.toContain(SKILLS.params.skill_id);
  });

  it('Case 6: failed skill already in persisted verifiedSkills is excluded', async () => {
    mockPythonName();
    userCompetencyRepository.findByUser.mockResolvedValue([{
      user_id: USER_ID,
      competency_id: 'comp-owned',
      verifiedSkills: [{
        skill_id: SKILLS.conditionals.skill_id,
        skill_name: 'conditionals',
        verified: true
      }]
    }]);

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis).not.toHaveBeenCalled();
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
  });

  it('Case 7: already-present competency_name is used and MGS inference is skipped', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'Python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(competencyRepository.findByName).toHaveBeenCalled();
    expect(competencyRepository.findAll).not.toHaveBeenCalled();
    expect(competencyService.getCompetenciesBySkill).not.toHaveBeenCalled();
    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][3]).toBe('python');
  });

  it('Case 8: already-present competency_id resolves to the canonical name', async () => {
    competencyService.getCompetencyById.mockResolvedValue({
      competency_id: 'comp-python',
      competency_name: 'python'
    });

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_id: 'comp-python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(competencyService.getCompetencyById).toHaveBeenCalledWith('comp-python');
    expect(competencyRepository.findAll).not.toHaveBeenCalled();
    expect(competencyService.getCompetenciesBySkill).not.toHaveBeenCalled();
    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][3]).toBe('python');
  });

  it('Case 9: unique exact MGS-set match resolves the target and sends', async () => {
    competencyService.getCompetenciesBySkill.mockResolvedValue([
      { competency_id: 'comp-python', competency_name: 'python' }
    ]);
    competencyRepository.findParent.mockResolvedValue(null);
    competencyService.getRequiredMGS.mockResolvedValue([
      { skill_id: SKILLS.conditionals.skill_id, skill_name: 'conditionals' }
    ]);

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis).toHaveBeenCalledTimes(1);
    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][3]).toBe('python');
    expect(competencyRepository.findAll).not.toHaveBeenCalled();
  });

  it('Case 10: no exact MGS match skips Learner and continues Directory', async () => {
    competencyService.getCompetenciesBySkill.mockResolvedValue([
      { competency_id: 'comp-python', competency_name: 'python' }
    ]);
    competencyRepository.findParent.mockResolvedValue(null);
    competencyService.getRequiredMGS.mockResolvedValue([
      { skill_id: SKILLS.lambda.skill_id, skill_name: 'lambda functions' }
    ]);

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis).not.toHaveBeenCalled();
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
    expect(competencyRepository.findAll).not.toHaveBeenCalled();
  });

  it('Case 11: multiple exact MGS matches skip Learner fail-safe', async () => {
    competencyService.getCompetenciesBySkill.mockResolvedValue([
      { competency_id: 'comp-a', competency_name: 'python' },
      { competency_id: 'comp-b', competency_name: 'python programming' }
    ]);
    competencyRepository.findParent.mockResolvedValue(null);
    competencyService.getRequiredMGS.mockResolvedValue([
      { skill_id: SKILLS.conditionals.skill_id, skill_name: 'conditionals' }
    ]);

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis).not.toHaveBeenCalled();
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
    expect(competencyRepository.findAll).not.toHaveBeenCalled();
  });

  it('Case 12: true empty gap does not send', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: []
    });

    expect(learnerAIMSClient.sendGapAnalysis).not.toHaveBeenCalled();
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
  });

  it('Case 13: Learner client throw does not block Directory update', async () => {
    mockPythonName();
    learnerAIMSClient.sendGapAnalysis.mockRejectedValue(new Error('Coordinator timeout'));

    const result = await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(result).toEqual({});
    expect(directoryMSClient.sendUpdatedProfile).toHaveBeenCalledTimes(1);
  });

  it('Case 14: outgoing target is python, not path_career senior developer', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][3]).toBe('python');
    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][3]).not.toBe('senior developer');
  });

  it('Case 15: outgoing exam status is fail, not pass', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      passed: true,
      final_grade: 81,
      competency_name: 'python',
      skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][4]).toBe('fail');
    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][4]).not.toBe('pass');
    expect(learnerAIMSClient.sendGapAnalysis.mock.calls[0][4]).not.toBe('passed');
  });

  it('supports verified_skills alias for raw Baseline evidence', async () => {
    mockPythonName();

    await verificationService.processBaselineExamResults(USER_ID, {
      exam_id: EXAM_ID,
      exam_type: 'baseline',
      competency_name: 'python',
      verified_skills: [resultSkill('conditionals', 'failed', 43)]
    });

    expect(learnerAIMSClient.sendGapAnalysis).toHaveBeenCalledTimes(1);
  });
});
