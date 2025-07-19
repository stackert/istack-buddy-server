import { performSlackyToolCall } from './performSlackyToolCall';
import { marvToolSet } from '../marv';
import { SlackyToolsEnum } from './types';

// Mock the CustomLoggerService
const mockLogger = {
  debug: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('../../../common/logger/custom-logger.service', () => ({
  CustomLoggerService: jest.fn().mockImplementation(() => mockLogger),
}));

// Mock the marvToolSet
jest.mock('../marv', () => ({
  marvToolSet: {
    executeToolCall: jest.fn(),
  },
  FsRestrictedApiRoutesEnum: {
    FormAndRelatedEntityOverview: 'fsRestrictedApiFormAndRelatedEntityOverview',
  },
}));

// Mock fs and path modules
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

const mockMarvToolSet = marvToolSet as jest.Mocked<typeof marvToolSet>;
const mockFs = require('fs');
const mockPath = require('path');

describe('performSlackyToolCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.cwd to return a predictable path
    jest.spyOn(process, 'cwd').mockReturnValue('/test/cwd');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sumo_logic_query', () => {
    it('should handle query with all parameters', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.SumoLogicQuery, {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '12345',
        submissionId: '67890',
      });

      expect(result).toContain('Sumo Logic Query Analysis');
      expect(result).toContain('Form ID: 12345');
      expect(result).toContain('Submission ID: 67890');
    });

    it('should handle query with only required parameters', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.SumoLogicQuery, {
        fromDate: '1640995200000',
        toDate: '1641081600000',
      });

      expect(result).toContain('Sumo Logic Query Analysis');
      expect(result).not.toContain('Form ID:');
      expect(result).not.toContain('Submission ID:');
    });

    it('should handle query with formId only', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.SumoLogicQuery, {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        formId: '12345',
      });

      expect(result).toContain('Sumo Logic Query Analysis');
      expect(result).toContain('Form ID: 12345');
      expect(result).not.toContain('Submission ID:');
    });

    it('should handle query with submissionId only', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.SumoLogicQuery, {
        fromDate: '1640995200000',
        toDate: '1641081600000',
        submissionId: '67890',
      });

      expect(result).toContain('Sumo Logic Query Analysis');
      expect(result).not.toContain('Form ID:');
      expect(result).toContain('Submission ID: 67890');
    });
  });

  describe('sso_autofill_assistance', () => {
    it('should generate SSO troubleshooting response', () => {
      const result = performSlackyToolCall(
        SlackyToolsEnum.SsoAutofillAssistance,
        {
          formId: '12345',
          accountId: '98765',
        },
      );

      expect(result).toContain('SSO Auto-fill Configuration Analysis');
      expect(result).toContain('Form ID: 12345');
      expect(result).toContain('Account ID: 98765');
      expect(result).toContain('SSO Auto-fill Troubleshooting');
    });
  });

  describe('collect_user_feedback', () => {
    it('should handle feedback with conversation category', () => {
      const result = performSlackyToolCall(
        SlackyToolsEnum.CollectUserFeedback,
        {
          feedback: 'Great help with my form issue!',
          category: 'conversation',
        },
      );

      expect(result).toContain('**Feedback Collected Successfully**');
      expect(result).toContain('**Category:** Conversation Quality');
      expect(result).toContain(
        '**Your Feedback:** "Great help with my form issue!"',
      );
      expect(result).toContain('Your feedback has been logged');
    });

    it('should handle feedback with service category', () => {
      const result = performSlackyToolCall(
        SlackyToolsEnum.CollectUserFeedback,
        {
          feedback: 'Service was excellent',
          category: 'service',
        },
      );

      expect(result).toContain('**Category:** Service Experience');
    });

    it('should handle feedback with feature_request category', () => {
      const result = performSlackyToolCall(
        SlackyToolsEnum.CollectUserFeedback,
        {
          feedback: 'Please add more integration options',
          category: 'feature_request',
        },
      );

      expect(result).toContain('**Category:** Feature Request');
      expect(result).toContain(
        "Great suggestion! I've logged this feature request",
      );
    });

    it('should handle feedback with bug_report category', () => {
      const result = performSlackyToolCall(
        SlackyToolsEnum.CollectUserFeedback,
        {
          feedback: 'Form submission is failing',
          category: 'bug_report',
        },
      );

      expect(result).toContain('**Category:** Bug Report');
      expect(result).toContain("I've logged this as a bug report");
    });

    it('should handle feedback with other category', () => {
      const result = performSlackyToolCall(
        SlackyToolsEnum.CollectUserFeedback,
        {
          feedback: 'General comment',
          category: 'other',
        },
      );

      expect(result).toContain('**Category:** General Feedback');
    });

    it('should log feedback to file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      performSlackyToolCall(SlackyToolsEnum.CollectUserFeedback, {
        feedback: 'Test feedback',
        category: 'conversation',
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('feedback-'),
        expect.stringContaining('"type": "feedback"'),
      );
    });

    it('should create feedback directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});

      performSlackyToolCall(SlackyToolsEnum.CollectUserFeedback, {
        feedback: 'Test feedback',
        category: 'conversation',
      });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        '/test/cwd/docs-living/debug-logging/feedback',
        { recursive: true },
      );
    });

    it('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = performSlackyToolCall(
        SlackyToolsEnum.CollectUserFeedback,
        {
          feedback: 'Test feedback',
          category: 'conversation',
        },
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log feedback',
        expect.any(Error),
      );
      expect(result).toContain('**Feedback Collected Successfully**');
    });
  });

  describe('collect_user_rating', () => {
    it('should handle positive rating (5)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 5,
        context: 'Form troubleshooting',
        comment: 'Excellent help!',
      });

      expect(result).toContain('**Rating Received: +5/5**');
      expect(result).toContain(
        '**Rating:** Nominate iStackBuddy for world peace prize',
      );
      expect(result).toContain('**Comment:** "Excellent help!"');
      expect(result).toContain("Thank you so much! I'm thrilled");
    });

    it('should handle positive rating (3)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 3,
        context: 'SSO assistance',
      });

      expect(result).toContain('**Rating Received: +3/5**');
      expect(result).toContain('**Rating:** Very helpful');
      expect(result).toContain("Thank you so much! I'm thrilled");
    });

    it('should handle positive rating (1)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 1,
        context: 'General help',
      });

      expect(result).toContain('**Rating Received: +1/5**');
      expect(result).toContain('**Rating:** A little helpful');
      expect(result).toContain('Thank you for the positive feedback!');
    });

    it('should handle neutral rating (0)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 0,
        context: 'Form issue',
      });

      expect(result).toContain('**Rating Received: +0/5**');
      expect(result).toContain('**Rating:** Not good/not bad');
      expect(result).toContain(
        "Thank you for the honest feedback. I'll use this to understand",
      );
    });

    it('should handle negative rating (-1)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: -1,
        context: 'Incorrect information',
      });

      expect(result).toContain('**Rating Received: -1/5**');
      expect(result).toContain('**Rating:** Information had inaccuracies');
      expect(result).toContain(
        'Thank you for the honest feedback. I apologize',
      );
    });

    it('should handle negative rating (-2)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: -2,
        context: 'Misleading help',
      });

      expect(result).toContain('**Rating Received: -2/5**');
      expect(result).toContain('**Rating:** Misleading or just wrong');
    });

    it('should handle very negative rating (-5)', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: -5,
        context: 'Terrible experience',
      });

      expect(result).toContain('**Rating Received: -5/5**');
      expect(result).toContain('**Rating:** World War III bad');
    });

    it('should handle rating without comment', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 4,
        context: 'Great help',
      });

      expect(result).toContain('**Rating Received: +4/5**');
      expect(result).toContain('**Rating:** Excellent');
      expect(result).not.toContain('**Comment:**');
    });

    it('should validate rating range and reject invalid ratings', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 10,
        context: 'Invalid rating',
      });

      expect(result).toContain('**Invalid Rating**');
      expect(result).toContain('Ratings must be between -5 and +5');
      expect(result).toContain('• -5: World War III bad');
      expect(result).toContain(
        '• +5: Nominate iStackBuddy for world peace prize',
      );
    });

    it('should validate rating range and reject very low ratings', () => {
      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: -10,
        context: 'Invalid rating',
      });

      expect(result).toContain('**Invalid Rating**');
      expect(result).toContain('Ratings must be between -5 and +5');
    });

    it('should log rating to file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 4,
        context: 'Test rating',
        comment: 'Great service',
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('feedback-'),
        expect.stringContaining('"type": "rating"'),
      );
    });

    it('should handle file system errors gracefully for rating', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = performSlackyToolCall(SlackyToolsEnum.CollectUserRating, {
        rating: 3,
        context: 'Test rating',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log feedback',
        expect.any(Error),
      );
      expect(result).toContain('**Rating Received: +3/5**');
    });
  });

  describe('unknown tools', () => {
    it('should return undefined for unknown tool names', () => {
      const result = performSlackyToolCall('unknown_tool', {});

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty tool name', () => {
      const result = performSlackyToolCall('', {});

      expect(result).toBeUndefined();
    });

    it('should return undefined for null tool name', () => {
      const result = performSlackyToolCall(null as any, {});

      expect(result).toBeUndefined();
    });
  });
});
