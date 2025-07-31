import { AgentRobotParrot } from './AgentRobotParrot';
import {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
} from './types';

describe('AgentRobotParrot', () => {
  let robot: AgentRobotParrot;

  beforeEach(() => {
    robot = new AgentRobotParrot();
  });

  describe('Class Properties', () => {
    it('should have correct name property', () => {
      expect(robot.name).toBe('AgentRobotParrot');
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
      expect(robot.getName()).toBe('AgentRobotParrot');
    });

    it('should inherit getVersion method from AbstractRobot', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct robotClass property', () => {
      expect(robot.robotClass).toBe('AgentRobotParrot');
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
        messageId: 'agent-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test agent task',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 10,
      };

      mockMessageEnvelope = {
        messageId: 'agent-envelope-123',
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
        /^\(\d+\) Test agent task$/,
      );
    });

    it('should preserve the message structure', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.author_role).toBe('user');
      expect(result.envelopePayload.created_at).toBe('2024-01-01T10:00:00Z');
      expect(result.envelopePayload.content.type).toBe('text/plain');
    });

    it('should generate different random numbers for consecutive calls', async () => {
      const envelope1 = JSON.parse(JSON.stringify(mockMessageEnvelope));
      const envelope2 = JSON.parse(JSON.stringify(mockMessageEnvelope));

      const result1 = await robot.acceptMessageImmediateResponse(envelope1);
      const result2 = await robot.acceptMessageImmediateResponse(envelope2);

      const number1 =
        result1.envelopePayload.content.payload.match(/^\((\d+)\)/)?.[1];
      const number2 =
        result2.envelopePayload.content.payload.match(/^\((\d+)\)/)?.[1];

      expect(number1).toBeDefined();
      expect(number2).toBeDefined();
    });

    it('should handle empty message string', async () => {
      mockMessageEnvelope.envelopePayload.content.payload = '';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(/^\(\d+\) $/);
    });

    it('should handle messages with special characters', async () => {
      mockMessageEnvelope.envelopePayload.content.payload =
        'Special task: @#$%^&*()';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        /^\(\d+\) Special task: @#\$%\^\&\*\(\)$/,
      );
    });

    it('should handle very long tasks', async () => {
      const longTask = 'A'.repeat(1000);
      mockMessageEnvelope.envelopePayload.content.payload = longTask;

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        new RegExp(`^\\(\\d+\\) ${longTask}$`),
      );
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;
    let mockDelayedCallback: jest.Mock;

    beforeEach(() => {
      mockRobotMessage = {
        messageId: 'multipart-agent-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test multipart agent task',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 15,
      };

      mockMessageEnvelope = {
        messageId: 'multipart-agent-envelope-123',
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
        /^\(\d+\) Test multipart agent task$/,
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

      // Verify the delayed response contains the original message
      const delayedResponse = mockDelayedCallback.mock.calls[0][0];
      expect(delayedResponse.envelopePayload.content.payload).toMatch(
        /^\(\d+\) - complete: Test multipart agent task$/,
      );
    });

    it('should handle empty task string in multipart response', async () => {
      mockMessageEnvelope.envelopePayload.content.payload = '';

      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockDelayedCallback,
      );

      jest.advanceTimersByTime(500); // Advance enough for callback

      expect(mockDelayedCallback).toHaveBeenCalledTimes(1);

      const delayedResponse = mockDelayedCallback.mock.calls[0][0];
      expect(delayedResponse.envelopePayload.content.payload).toMatch(
        /^\(\d+\) - complete: $/,
      );
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      // Should not throw even if callback throws
      await expect(
        robot.acceptMessageMultiPartResponse(
          mockMessageEnvelope,
          errorCallback,
        ),
      ).resolves.toBeDefined();

      // The callback error should not prevent execution
      expect(() => jest.advanceTimersByTime(500)).toThrow('Callback error');

      // Should have attempted to call the callback once despite errors
      expect(errorCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Inheritance and Type Checking', () => {
    it('should be an instance of AgentRobotParrot', () => {
      expect(robot).toBeInstanceOf(AgentRobotParrot);
    });

    it('should have the correct constructor name', () => {
      expect(robot.constructor.name).toBe('AgentRobotParrot');
    });
  });

  describe('Static Properties', () => {
    it('should have static description properties', () => {
      expect(AgentRobotParrot.descriptionShort).toBeDefined();
      expect(AgentRobotParrot.descriptionLong).toBeDefined();
      expect(typeof AgentRobotParrot.descriptionShort).toBe('string');
      expect(typeof AgentRobotParrot.descriptionLong).toBe('string');
    });

    it('should have meaningful description content', () => {
      expect(AgentRobotParrot.descriptionShort.length).toBeGreaterThan(10);
      expect(AgentRobotParrot.descriptionLong.length).toBeGreaterThan(50);
      expect(AgentRobotParrot.descriptionShort).toMatch(/agent/i);
      expect(AgentRobotParrot.descriptionLong).toMatch(/autonomous/i);
    });
  });
});
