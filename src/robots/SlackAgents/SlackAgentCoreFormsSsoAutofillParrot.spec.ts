import { SlackAgentCoreFormsSsoAutofillParrot } from './SlackAgentCoreFormsSsoAutofillParrot';
import {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
} from '../types';

describe('SlackAgentCoreFormsSsoAutofillParrot', () => {
  let robot: SlackAgentCoreFormsSsoAutofillParrot;

  beforeEach(() => {
    robot = new SlackAgentCoreFormsSsoAutofillParrot();
  });

  describe('Class Properties', () => {
    it('should have correct name property', () => {
      expect(robot.name).toBe('SlackAgentCoreFormsSsoAutofillParrot');
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
      expect(robot.getName()).toBe('SlackAgentCoreFormsSsoAutofillParrot');
    });

    it('should inherit getVersion method from AbstractRobot', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct robotClass property', () => {
      expect(robot.robotClass).toBe('SlackAgentCoreFormsSsoAutofillParrot');
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
        messageId: 'sso-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test SSO autofill message',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 10,
      };

      mockMessageEnvelope = {
        messageId: 'sso-envelope-123',
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
        /^\(\d+\) Test SSO autofill message$/,
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
        'Special SSO: @#$%^&*()';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        /^\(\d+\) Special SSO: @#\$%\^\&\*\(\)$/,
      );
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;
    let mockDelayedCallback: jest.Mock;

    beforeEach(() => {
      mockRobotMessage = {
        messageId: 'multipart-sso-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test multipart SSO message',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 15,
      };

      mockMessageEnvelope = {
        messageId: 'multipart-sso-envelope-123',
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
        /^\(\d+\) Test multipart SSO message$/,
      );
    });

    it('should call delayed callback once after 500ms', async () => {
      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockDelayedCallback,
      );

      // Initially no delayed callback
      expect(mockDelayedCallback).not.toHaveBeenCalled();

      // After 500ms, delayed callback should be called
      jest.advanceTimersByTime(500);
      expect(mockDelayedCallback).toHaveBeenCalledTimes(1);

      // Verify the delayed response contains the completion message
      const delayedResponse = mockDelayedCallback.mock.calls[0][0];
      expect(delayedResponse.envelopePayload.content.payload).toMatch(
        /^\(\d+\) - complete: Test multipart SSO message$/,
      );
    });
  });

  describe('Inheritance and Type Checking', () => {
    it('should be an instance of SlackAgentCoreFormsSsoAutofillParrot', () => {
      expect(robot).toBeInstanceOf(SlackAgentCoreFormsSsoAutofillParrot);
    });

    it('should have the correct constructor name', () => {
      expect(robot.constructor.name).toBe(
        'SlackAgentCoreFormsSsoAutofillParrot',
      );
    });
  });

  describe('Static Properties', () => {
    it('should have static description properties', () => {
      expect(
        SlackAgentCoreFormsSsoAutofillParrot.descriptionShort,
      ).toBeDefined();
      expect(
        SlackAgentCoreFormsSsoAutofillParrot.descriptionLong,
      ).toBeDefined();
      expect(typeof SlackAgentCoreFormsSsoAutofillParrot.descriptionShort).toBe(
        'string',
      );
      expect(typeof SlackAgentCoreFormsSsoAutofillParrot.descriptionLong).toBe(
        'string',
      );
    });

    it('should have meaningful description content', () => {
      expect(
        SlackAgentCoreFormsSsoAutofillParrot.descriptionShort.length,
      ).toBeGreaterThan(10);
      expect(
        SlackAgentCoreFormsSsoAutofillParrot.descriptionLong.length,
      ).toBeGreaterThan(50);
      expect(SlackAgentCoreFormsSsoAutofillParrot.descriptionShort).toMatch(
        /agent/i,
      );
      expect(SlackAgentCoreFormsSsoAutofillParrot.descriptionLong).toMatch(
        /robot/i,
      );
    });
  });
});
