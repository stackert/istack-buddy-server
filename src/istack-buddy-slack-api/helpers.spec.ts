import {
  getShortCodesFromEventText,
  makeSimplifiedEvent,
  handleFeedbackCommand,
  handleRatingCommand,
} from './helpers';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.cwd mock
    jest.spyOn(process, 'cwd').mockReturnValue('/test/working/dir');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getShortCodesFromEventText', () => {
    it('should extract /marv-session command with formId', () => {
      const text = '@istack-buddy /marv-session formId:12345';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/marv-session']);
    });

    it('should extract /marv-session command with different formId', () => {
      const text = '/marv-session formId:67890';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/marv-session']);
    });

    it('should extract /kb command without parameters', () => {
      const text = '@istack-buddy /kb test';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/kb']);
    });

    it('should extract /kb command with slack parameter', () => {
      const text = '/kb:slack:general How do I use this?';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/kb']);
    });

    it('should extract /kb command with content', () => {
      const text = '/kb What is the meaning of life?';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/kb']);
    });

    it('should extract /feedback command', () => {
      const text = '@istack-buddy /feedback This is great!';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/feedback']);
    });

    it('should extract /feedback command without mention', () => {
      const text = '/feedback Could be better';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/feedback']);
    });

    it('should extract /rating command with positive rating', () => {
      const text = '/rating +5 Excellent service!';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/rating']);
    });

    it('should extract /rating command with negative rating', () => {
      const text = '/rating -2 Not helpful';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/rating']);
    });

    it('should extract /rating command with zero rating', () => {
      const text = '/rating 0 Meh';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/rating']);
    });

    it('should extract /rating command without comment', () => {
      const text = '/rating +3';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/rating']);
    });

    it('should extract multiple commands', () => {
      const text =
        '@istack-buddy /marv-session formId:123 /feedback Great! /rating +4';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/marv-session', '/feedback', '/rating']);
    });

    it('should return empty array for text without commands', () => {
      const text = 'Hello world, how are you?';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual([]);
    });

    it('should handle text with only bot mention', () => {
      const text = '@istack-buddy Hello there';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual([]);
    });

    it('should handle empty text', () => {
      const text = '';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual([]);
    });

    it('should handle whitespace only text', () => {
      const text = '   \n\t  ';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual([]);
    });

    it('should handle complex bot mention format', () => {
      const text = '<@U1234567890> /marv-session formId:123';
      const result = getShortCodesFromEventText(text);
      expect(result).toEqual(['/marv-session']);
    });
  });

  describe('makeSimplifiedEvent', () => {
    it('should create conversation_start event for non-thread message', () => {
      const event = {
        ts: '1234567890.123456',
        text: 'Hello world',
        channel: 'C1234567890',
        user: 'U1234567890',
      };

      const result = makeSimplifiedEvent(event);

      expect(result).toEqual({
        eventType: 'conversation_start',
        conversationId: '1234567890.123456',
        message: 'Hello world',
        eventTs: '1234567890.123456',
      });
    });

    it('should create thread_reply event for thread message', () => {
      const event = {
        ts: '1234567890.654321',
        thread_ts: '1234567890.123456',
        text: 'Reply in thread',
        channel: 'C1234567890',
        user: 'U1234567890',
      };

      const result = makeSimplifiedEvent(event);

      expect(result).toEqual({
        eventType: 'thread_reply',
        conversationId: '1234567890.123456',
        message: 'Reply in thread',
        eventTs: '1234567890.654321',
      });
    });

    it('should handle event with empty text', () => {
      const event = {
        ts: '1234567890.123456',
        text: '',
        channel: 'C1234567890',
        user: 'U1234567890',
      };

      const result = makeSimplifiedEvent(event);

      expect(result).toEqual({
        eventType: 'conversation_start',
        conversationId: '1234567890.123456',
        message: '',
        eventTs: '1234567890.123456',
      });
    });

    it('should handle event with null text', () => {
      const event = {
        ts: '1234567890.123456',
        text: null,
        channel: 'C1234567890',
        user: 'U1234567890',
      };

      const result = makeSimplifiedEvent(event);

      expect(result).toEqual({
        eventType: 'conversation_start',
        conversationId: '1234567890.123456',
        message: null,
        eventTs: '1234567890.123456',
      });
    });
  });

  describe('handleFeedbackCommand', () => {
    const mockEvent = {
      channel: 'C1234567890',
      user: 'U1234567890',
      text: '/feedback This is great!',
    };

    beforeEach(() => {
      mockPath.join
        .mockReturnValueOnce('/test/working/dir/logs')
        .mockReturnValueOnce('/test/working/dir/logs/feedback.json')
        .mockReturnValue('/test/working/dir/logs/feedback.json');
    });

    it('should create logs directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.existsSync.mockReturnValueOnce(false); // logs dir
      mockFs.existsSync.mockReturnValueOnce(false); // feedback file

      const result = handleFeedbackCommand(mockEvent, 'Great feedback!');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/working/dir/logs', {
        recursive: true,
      });
      expect(result).toContain('Thank you for your feedback!');
    });

    it('should append feedback to existing file', () => {
      const existingEntries = [
        {
          channel: 'C1234567890',
          author: 'U1234567890',
          date: '2024-01-01T10:00:00.000Z',
          feedback: 'Previous feedback',
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.existsSync.mockReturnValueOnce(true); // logs dir
      mockFs.existsSync.mockReturnValueOnce(true); // feedback file
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingEntries));
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleFeedbackCommand(mockEvent, 'New feedback!');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/test/working/dir/logs/feedback.json',
        'utf8',
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/working/dir/logs/feedback.json',
        expect.stringContaining('New feedback!'),
      );
      expect(result).toContain('Thank you for your feedback!');
    });

    it('should create new feedback file if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.existsSync.mockReturnValueOnce(false); // logs dir
      mockFs.existsSync.mockReturnValueOnce(false); // feedback file
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleFeedbackCommand(mockEvent, 'First feedback!');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/working/dir/logs/feedback.json',
        expect.stringContaining('First feedback!'),
      );
      expect(result).toContain('Thank you for your feedback!');
    });

    it('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleFeedbackCommand(mockEvent, 'Error feedback!');

      expect(result).toContain('Thank you for your feedback!');
    });

    it('should handle JSON parsing errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.existsSync.mockReturnValueOnce(true); // logs dir
      mockFs.existsSync.mockReturnValueOnce(true); // feedback file
      mockFs.readFileSync.mockReturnValue('invalid json');
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleFeedbackCommand(mockEvent, 'JSON error feedback!');

      expect(result).toContain('Thank you for your feedback!');
    });
  });

  describe('handleRatingCommand', () => {
    const mockEvent = {
      channel: 'C1234567890',
      user: 'U1234567890',
      text: '/rating +5 Excellent!',
    };

    beforeEach(() => {
      mockPath.join
        .mockReturnValueOnce('/test/working/dir/logs')
        .mockReturnValueOnce('/test/working/dir/logs/rating.json')
        .mockReturnValue('/test/working/dir/logs/rating.json');
    });

    it('should reject rating below -5', () => {
      const result = handleRatingCommand(mockEvent, -6, 'Too low');

      expect(result).toContain('Invalid Rating');
      expect(result).toContain('between -5 and +5');
      expect(result).toContain('World War III bad');
    });

    it('should reject rating above +5', () => {
      const result = handleRatingCommand(mockEvent, 10, 'Too high');

      expect(result).toContain('Invalid Rating');
      expect(result).toContain('between -5 and +5');
    });

    it('should accept valid positive rating', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.existsSync.mockReturnValueOnce(false); // logs dir
      mockFs.existsSync.mockReturnValueOnce(false); // rating file
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleRatingCommand(mockEvent, 4, 'Very helpful!');

      expect(result).toContain('Thank you for your rating of +4/5!');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should accept valid negative rating', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.existsSync.mockReturnValueOnce(false); // logs dir
      mockFs.existsSync.mockReturnValueOnce(false); // rating file
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleRatingCommand(mockEvent, -2, 'Not helpful');

      expect(result).toContain('Thank you for your rating of -2/5!');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should accept zero rating', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.existsSync.mockReturnValueOnce(false); // logs dir
      mockFs.existsSync.mockReturnValueOnce(false); // rating file
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleRatingCommand(mockEvent, 0, 'Meh');

      expect(result).toContain('Thank you for your rating of +0/5!');
    });

    it('should handle rating without comment', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.existsSync.mockReturnValueOnce(false); // logs dir
      mockFs.existsSync.mockReturnValueOnce(false); // rating file
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleRatingCommand(mockEvent, 3);

      expect(result).toContain('Thank you for your rating of +3/5!');
    });

    it('should append rating to existing file', () => {
      const existingEntries = [
        {
          channel: 'C1234567890',
          author: 'U1234567890',
          date: '2024-01-01T10:00:00.000Z',
          rating: 4,
          comment: 'Previous rating',
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.existsSync.mockReturnValueOnce(true); // logs dir
      mockFs.existsSync.mockReturnValueOnce(true); // rating file
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingEntries));
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleRatingCommand(mockEvent, 5, 'New rating!');

      expect(mockFs.readFileSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(result).toContain('Thank you for your rating of +5/5!');
    });

    it('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = handleRatingCommand(mockEvent, 3, 'Error rating!');

      expect(result).toContain('Thank you for your rating!');
    });

    it('should handle JSON parsing errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.existsSync.mockReturnValueOnce(true); // logs dir
      mockFs.existsSync.mockReturnValueOnce(true); // rating file
      mockFs.readFileSync.mockReturnValue('invalid json');
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = handleRatingCommand(mockEvent, 2, 'JSON error rating!');

      expect(result).toContain('Thank you for your rating!');
    });

    it('should include rating scale in invalid rating message', () => {
      const result = handleRatingCommand(mockEvent, 100, 'Way too high');

      expect(result).toContain('World War III bad');
      expect(result).toContain('Misleading or just wrong');
      expect(result).toContain('Information had inaccuracies');
      expect(result).toContain('Not good/not bad');
      expect(result).toContain('A little helpful');
      expect(result).toContain('Helpful, will use again');
      expect(result).toContain('Nominate iStackBuddy for world peace prize');
    });
  });
});
