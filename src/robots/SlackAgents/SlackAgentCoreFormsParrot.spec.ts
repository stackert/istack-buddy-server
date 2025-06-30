import { SlackAgentCoreFormsParrot } from './SlackAgentCoreFormsParrot';
import {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
} from '../types';

describe('SlackAgentCoreFormsParrot', () => {
  let robot: SlackAgentCoreFormsParrot;

  beforeEach(() => {
    robot = new SlackAgentCoreFormsParrot();
  });

  describe('Class Properties', () => {
    it('should have correct name property', () => {
      expect(robot.name).toBe('SlackAgentCoreFormsParrot');
    });

    it('should have correct version property', () => {
      expect(robot.version).toBe('1.0.0');
    });

    it('should have correct LLModelName property', () => {
      expect(robot.LLModelName).toBe('openAi.4.3');
    });

    it('should have correct LLModelVersion property', () => {
      expect(robot.LLModelVersion).toBe('4.3');
    });

    it('should inherit getName method from AbstractRobot', () => {
      expect(robot.getName()).toBe('SlackAgentCoreFormsParrot');
    });

    it('should inherit getVersion method from AbstractRobot', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct robotClass property', () => {
      expect(robot.robotClass).toBe('SlackAgentCoreFormsParrot');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(robot.estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
      expect(robot.estimateTokens('')).toBe(0);
      expect(robot.estimateTokens('a')).toBe(1);
    });
  });

  describe('acceptMessageImmediateResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;

    beforeEach(() => {
      mockRobotMessage = {
        messageId: 'slack-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test Slack message',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 10,
      };

      mockMessageEnvelope = {
        messageId: 'slack-envelope-123',
        requestOrResponse: 'request',
        envelopePayload: mockRobotMessage,
      };
    });

    it('should return a promise that resolves immediately', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.envelopePayload).toBeDefined();
    });

    it('should prefix the original message with a random number', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        /^\(\d+\) Test Slack message$/,
      );
    });

    it('should preserve the message structure', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.author_role).toBe('user');
      expect(result.envelopePayload.created_at).toBe('2024-01-01T10:00:00Z');
      expect(result.envelopePayload.content.type).toBe('text/plain');
    });

    it('should handle empty message string', async () => {
      mockMessageEnvelope.envelopePayload.content.payload = '';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(/^\(\d+\) $/);
    });

    it('should handle messages with special characters', async () => {
      mockMessageEnvelope.envelopePayload.content.payload =
        'Special Slack: @#$%^&*()';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        /^\(\d+\) Special Slack: @#\$%\^\&\*\(\)$/,
      );
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;
    let mockDelayedCallback: jest.Mock;

    beforeEach(() => {
      mockRobotMessage = {
        messageId: 'multipart-slack-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test multipart Slack message',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 15,
      };

      mockMessageEnvelope = {
        messageId: 'multipart-slack-envelope-123',
        requestOrResponse: 'request',
        envelopePayload: mockRobotMessage,
      };

      mockDelayedCallback = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return an immediate response', async () => {
      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockDelayedCallback,
      );

      expect(result).toBeDefined();
      expect(result.envelopePayload.content.payload).toMatch(
        /^\d+ Test multipart Slack message$/,
      );
    });

    it('should call delayed callback 3 times at intervals', async () => {
      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockDelayedCallback,
      );

      // Initially no delayed callback
      expect(mockDelayedCallback).not.toHaveBeenCalled();

      // After 500ms, first delayed callback should be called
      jest.advanceTimersByTime(500);
      expect(mockDelayedCallback).toHaveBeenCalledTimes(1);

      // After 1000ms, second delayed callback should be called
      jest.advanceTimersByTime(500);
      expect(mockDelayedCallback).toHaveBeenCalledTimes(2);

      // After 1500ms, third delayed callback should be called
      jest.advanceTimersByTime(500);
      expect(mockDelayedCallback).toHaveBeenCalledTimes(3);

      // Verify the delayed responses contain the original message
      mockDelayedCallback.mock.calls.forEach((call) => {
        const delayedResponse = call[0];
        expect(delayedResponse.envelopePayload.content.payload).toMatch(
          /^\d+ Test multipart Slack message$/,
        );
      });
    });
  });

  describe('Inheritance and Type Checking', () => {
    it('should be an instance of SlackAgentCoreFormsParrot', () => {
      expect(robot).toBeInstanceOf(SlackAgentCoreFormsParrot);
    });

    it('should have the correct constructor name', () => {
      expect(robot.constructor.name).toBe('SlackAgentCoreFormsParrot');
    });
  });

  describe('Static Properties', () => {
    it('should have static description properties', () => {
      expect(SlackAgentCoreFormsParrot.descriptionShort).toBeDefined();
      expect(SlackAgentCoreFormsParrot.descriptionLong).toBeDefined();
      expect(typeof SlackAgentCoreFormsParrot.descriptionShort).toBe('string');
      expect(typeof SlackAgentCoreFormsParrot.descriptionLong).toBe('string');
    });

    it('should have meaningful description content', () => {
      expect(SlackAgentCoreFormsParrot.descriptionShort.length).toBeGreaterThan(
        10,
      );
      expect(SlackAgentCoreFormsParrot.descriptionLong.length).toBeGreaterThan(
        50,
      );
      expect(SlackAgentCoreFormsParrot.descriptionShort).toMatch(/agent/i);
      expect(SlackAgentCoreFormsParrot.descriptionLong).toMatch(/robot/i);
    });
  });
});
