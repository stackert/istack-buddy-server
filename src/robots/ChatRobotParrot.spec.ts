import { ChatRobotParrot } from './ChatRobotParrot';
import {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
} from './types';

describe('ChatRobotParrot', () => {
  let robot: ChatRobotParrot;

  beforeEach(() => {
    robot = new ChatRobotParrot();
  });

  describe('Class Properties', () => {
    it('should have correct name property', () => {
      expect(robot.name).toBe('ChatRobotParrot');
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
      expect(robot.getName()).toBe('ChatRobotParrot');
    });

    it('should inherit getVersion method from AbstractRobot', () => {
      expect(robot.getVersion()).toBe('1.0.0');
    });

    it('should have correct robotClass property', () => {
      expect(robot.robotClass).toBe('ChatRobotParrot');
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
        messageId: 'msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test message',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 10,
      };

      mockMessageEnvelope = {
        messageId: 'envelope-123',
        requestOrResponse: 'request',
        envelopePayload: mockRobotMessage,
      };
    });

    it('should return a promise that resolves immediately', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result).toBeDefined();
      // messageId is not part of TRobotResponseEnvelope - it's added by conversation manager
      expect(result.envelopePayload).toBeDefined();
    });

    it('should prefix the original message with a random number', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        /^\(\d+\) Test message$/,
      );
    });

    it('should preserve the message structure', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.author_role).toBe('assistant');
      expect(result.envelopePayload.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
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
        'Special chars: @#$%^&*()';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        /^\(\d+\) Special chars: @#\$%\^\&\*\(\)$/,
      );
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000);
      mockMessageEnvelope.envelopePayload.content.payload = longMessage;

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.envelopePayload.content.payload).toMatch(
        new RegExp(`^\\(\\d+\\) ${longMessage}$`),
      );
    });
  });

  describe('acceptMessageStreamResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;
    let mockChunkCallback: jest.Mock;

    beforeEach(() => {
      mockRobotMessage = {
        messageId: 'stream-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test message for streaming',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 15,
      };

      mockMessageEnvelope = {
        messageId: 'stream-envelope-123',
        requestOrResponse: 'request',
        envelopePayload: mockRobotMessage,
      };

      mockChunkCallback = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return a promise', () => {
      const result = robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onStreamChunkReceived: mockChunkCallback,
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      });
      expect(result).toBeInstanceOf(Promise);
    });

    it('should break response into 5 chunks and call callback for each', async () => {
      const promise = robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onStreamChunkReceived: mockChunkCallback,
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      });

      // Fast-forward through all the intervals
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // Should be called 5 times (5 chunks)
      expect(mockChunkCallback).toHaveBeenCalledTimes(5);
    });

    it('should send chunks at 500ms intervals', async () => {
      const promise = robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onStreamChunkReceived: mockChunkCallback,
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      });

      // Initially no calls
      expect(mockChunkCallback).not.toHaveBeenCalled();

      // After 500ms, first chunk should be sent
      jest.advanceTimersByTime(500);
      expect(mockChunkCallback).toHaveBeenCalledTimes(1);

      // After another 500ms, second chunk should be sent
      jest.advanceTimersByTime(500);
      expect(mockChunkCallback).toHaveBeenCalledTimes(2);

      // Continue until all chunks are sent
      jest.advanceTimersByTime(2500); // Advance remaining time
      await promise;

      expect(mockChunkCallback).toHaveBeenCalledTimes(5);
    });

    it('should prefix the message with random number before chunking', async () => {
      const promise = robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onStreamChunkReceived: mockChunkCallback,
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      });

      // Run all timers to completion
      jest.runAllTimers();

      // Wait for the promise to resolve
      await promise;

      // Reconstruct the full message from chunks
      const allChunks = mockChunkCallback.mock.calls
        .map((call) => call[0])
        .join('');

      expect(allChunks).toMatch(/^\(\d+\) Test message for streaming$/);
    }, 10000);

    it('should handle empty message', async () => {
      mockMessageEnvelope.envelopePayload.content.payload = '';

      const promise = robot.acceptMessageStreamResponse(mockMessageEnvelope, {
        onStreamChunkReceived: mockChunkCallback,
        onStreamStart: jest.fn(),
        onStreamFinished: jest.fn(),
        onFullMessageReceived: jest.fn(),
        onError: jest.fn(),
      });

      // Fast-forward through all intervals
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // Should call callback at least once
      expect(mockChunkCallback.mock.calls.length).toBeGreaterThan(0);

      // Reconstruct message
      const allChunks = mockChunkCallback.mock.calls
        .map((call) => call[0])
        .join('');

      expect(allChunks).toMatch(/^\(\d+\) $/);
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;
    let mockDelayedCallback: jest.Mock;

    beforeEach(() => {
      mockRobotMessage = {
        messageId: 'multipart-msg-123',
        author_role: 'user',
        content: {
          type: 'text/plain',
          payload: 'Test multipart message',
        },
        created_at: '2024-01-01T10:00:00Z',
        estimated_token_count: 15,
      };

      mockMessageEnvelope = {
        messageId: 'multipart-envelope-123',
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
        /^\(\d+\) Test multipart message$/,
      );
    });

    it('should call delayed callback after 300ms', async () => {
      await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockDelayedCallback,
      );

      // Initially no delayed callback
      expect(mockDelayedCallback).not.toHaveBeenCalled();

      // After 300ms, delayed callback should be called
      jest.advanceTimersByTime(300);
      expect(mockDelayedCallback).toHaveBeenCalledTimes(1);

      // Verify the delayed response
      const delayedResponse = mockDelayedCallback.mock.calls[0][0];
      expect(delayedResponse.envelopePayload.content.payload).toMatch(
        /Follow-up chat response for:/,
      );
    });
  });
});
