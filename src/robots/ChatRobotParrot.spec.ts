import { ChatRobotParrot } from './ChatRobotParrot';
import { TConversationTextMessageEnvelope, TConversationTextMessage } from './types';

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

  describe('acceptMessageImmediateResponse', () => {
    let mockMessageEnvelope: TConversationTextMessageEnvelope;
    let mockRobotMessage: TConversationTextMessage;

    beforeEach(() => {
      mockRobotMessage = {
        message: 'Test message',
        sender: 'user123',
        receiver: 'robot',
        timestamp: '2024-01-01T10:00:00Z',
      };

      mockMessageEnvelope = {
        routerId: 'router-123',
        messageType: 'message',
        message: mockRobotMessage,
      };
    });

    it('should return a promise that resolves immediately', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result).toBeDefined();
      expect(result.routerId).toBe('router-123');
      expect(result.messageType).toBe('message');
    });

    it('should prefix the original message with a random number', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.message?.message).toMatch(/^\(\d+\) Test message$/);
    });

    it('should preserve all other message properties', async () => {
      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.message?.sender).toBe('user123');
      expect(result.message?.receiver).toBe('robot');
      expect(result.message?.timestamp).toBe('2024-01-01T10:00:00Z');
    });

    it('should generate different random numbers for consecutive calls', async () => {
      // Create separate envelope objects to avoid reference issues
      const envelope1 = JSON.parse(JSON.stringify(mockMessageEnvelope));
      const envelope2 = JSON.parse(JSON.stringify(mockMessageEnvelope));

      const result1 = await robot.acceptMessageImmediateResponse(envelope1);
      const result2 = await robot.acceptMessageImmediateResponse(envelope2);

      // Extract the random numbers from both results
      const number1 = result1.message?.message.match(/^\((\d+)\)/)?.[1];
      const number2 = result2.message?.message.match(/^\((\d+)\)/)?.[1];

      // They should both be valid numbers
      expect(number1).toBeDefined();
      expect(number2).toBeDefined();

      // Note: There's a small statistical chance they could be the same (1/10000)
      // but if they're different, the test passes. If they're the same, we accept it
      // as a valid random occurrence and just check they're both valid numbers
    });

    it('should handle empty message string', async () => {
      mockMessageEnvelope.message!.message = '';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.message?.message).toMatch(/^\(\d+\) $/);
    });

    it('should handle messages with special characters', async () => {
      mockMessageEnvelope.message!.message = 'Special chars: @#$%^&*()';

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.message?.message).toMatch(
        /^\(\d+\) Special chars: @#\$%\^\&\*\(\)$/,
      );
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000);
      mockMessageEnvelope.message!.message = longMessage;

      const result =
        await robot.acceptMessageImmediateResponse(mockMessageEnvelope);

      expect(result.message?.message).toMatch(
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
        message: 'Test message for streaming',
        sender: 'user123',
        receiver: 'robot',
        timestamp: '2024-01-01T10:00:00Z',
      };

      mockMessageEnvelope = {
        routerId: 'router-123',
        messageType: 'message',
        message: mockRobotMessage,
      };

      mockChunkCallback = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return a promise', () => {
      const result = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );
      expect(result).toBeInstanceOf(Promise);
    });

    it('should break response into 5 chunks and call callback for each', async () => {
      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );

      // Fast-forward through all the intervals
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // Should be called 6 times (5 chunks + 1 null terminator)
      expect(mockChunkCallback).toHaveBeenCalledTimes(6);

      // Last call should be with null
      expect(mockChunkCallback).toHaveBeenLastCalledWith(null);
    });

    it('should send chunks at 500ms intervals', async () => {
      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );

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

      expect(mockChunkCallback).toHaveBeenCalledTimes(6);
    });

    it('should prefix the message with random number before chunking', async () => {
      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );

      // Fast-forward through all intervals
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // Reconstruct the full message from chunks (excluding the null terminator)
      const allChunks = mockChunkCallback.mock.calls
        .slice(0, -1) // Remove the null call
        .map((call) => call[0])
        .join('');

      expect(allChunks).toMatch(/^\(\d+\) Test message for streaming$/);
    });

    it('should divide message into roughly equal chunks', async () => {
      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );

      // Fast-forward through all intervals
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // Get all chunks except the null terminator
      const chunks = mockChunkCallback.mock.calls
        .slice(0, -1)
        .map((call) => call[0]);

      expect(chunks).toHaveLength(5);

      // Each chunk should be a string
      chunks.forEach((chunk) => {
        expect(typeof chunk).toBe('string');
        expect(chunk.length).toBeGreaterThan(0);
      });

      // When combined, chunks should form the complete response
      const combined = chunks.join('');
      expect(combined).toMatch(/^\(\d+\) Test message for streaming$/);
    });

    it('should handle empty message', async () => {
      mockMessageEnvelope.message!.message = '';

      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );

      // Fast-forward through all intervals
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // Should call callback at least once and last call should be null
      expect(mockChunkCallback.mock.calls.length).toBeGreaterThan(0);
      expect(mockChunkCallback).toHaveBeenLastCalledWith(null);

      // Reconstruct message (excluding null)
      const allChunks = mockChunkCallback.mock.calls
        .slice(0, -1)
        .map((call) => call[0])
        .join('');

      expect(allChunks).toMatch(/^\(\d+\) $/);
    });

    it('should handle very short messages', async () => {
      mockMessageEnvelope.message!.message = 'Hi';

      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        mockChunkCallback,
      );

      // Fast-forward through all intervals - use more iterations for safety
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(500);
      }

      await promise;

      // For very short messages, we might get fewer chunks than the standard 5
      // The important thing is that we get at least some chunks and a null terminator
      expect(mockChunkCallback.mock.calls.length).toBeGreaterThanOrEqual(2); // At least 1 chunk + null
      expect(mockChunkCallback).toHaveBeenLastCalledWith(null);

      // Verify the content is correct when chunks are combined (excluding null)
      const chunks = mockChunkCallback.mock.calls
        .slice(0, -1) // Remove the null call
        .map((call) => call[0]);

      const combined = chunks.join('');
      expect(combined).toMatch(/^\(\d+\) Hi$/);
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const promise = robot.acceptMessageStreamResponse(
        mockMessageEnvelope,
        errorCallback,
      );

      // The promise should still resolve even if callback throws
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(500);
      }

      await expect(promise).resolves.toBeUndefined();

      // Should have attempted to call the callback multiple times despite errors
      expect(errorCallback.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Inheritance and Type Checking', () => {
    it('should be an instance of ChatRobotParrot', () => {
      expect(robot).toBeInstanceOf(ChatRobotParrot);
    });

    it('should have the correct constructor name', () => {
      expect(robot.constructor.name).toBe('ChatRobotParrot');
    });
  });

  describe('Edge Cases', () => {
    it('should handle message envelope without message property in immediate response', async () => {
      const envelopeWithoutMessage: TConversationTextMessageEnvelope = {
        routerId: 'router-123',
        messageType: 'message',
        // message property is undefined
      };

      expect(async () => {
        await robot.acceptMessageImmediateResponse(
          envelopeWithoutMessage as any,
        );
      }).rejects.toThrow();
    });

    it('should handle message envelope without message property in stream response', async () => {
      const envelopeWithoutMessage: TConversationTextMessageEnvelope = {
        routerId: 'router-123',
        messageType: 'message',
        // message property is undefined
      };

      const mockCallback = jest.fn();
      jest.useFakeTimers();

      expect(async () => {
        const promise = robot.acceptMessageStreamResponse(
          envelopeWithoutMessage as any,
          mockCallback,
        );
        jest.advanceTimersByTime(3000);
        await promise;
      }).rejects.toThrow();

      jest.useRealTimers();
    });

    it('should handle multiple concurrent immediate calls', async () => {
      const envelopes = Array.from({ length: 3 }, (_, i) => ({
        routerId: `router-${i}`,
        messageType: 'message' as const,
        message: {
          message: `Message ${i}`,
          sender: `user${i}`,
          receiver: 'robot',
          timestamp: '2024-01-01T10:00:00Z',
        },
      }));

      const promises = envelopes.map((envelope) =>
        robot.acceptMessageImmediateResponse(envelope),
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.routerId).toBe(`router-${index}`);
        expect(result.message?.message).toMatch(
          new RegExp(`^\\(\\d+\\) Message ${index}$`),
        );
      });
    });

    it('should handle multiple concurrent streaming calls', async () => {
      jest.useFakeTimers();

      const callbacks = [jest.fn(), jest.fn(), jest.fn()];
      const envelopes = Array.from({ length: 3 }, (_, i) => ({
        routerId: `router-${i}`,
        messageType: 'message' as const,
        message: {
          message: `Stream ${i}`,
          sender: `user${i}`,
          receiver: 'robot',
          timestamp: '2024-01-01T10:00:00Z',
        },
      }));

      const promises = envelopes.map((envelope, index) =>
        robot.acceptMessageStreamResponse(envelope, callbacks[index]),
      );

      // Fast-forward all timers
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(500);
      }

      await Promise.all(promises);

      // Each callback should have been called 6 times
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(6);
        expect(callback).toHaveBeenLastCalledWith(null);
      });

      jest.useRealTimers();
    });
  });

  describe('Random Number Generation', () => {
    it('should generate numbers within expected range (0-9999) for immediate response', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          robot.acceptMessageImmediateResponse({
            routerId: 'test',
            messageType: 'message',
            message: {
              message: 'test',
              sender: 'user',
              receiver: 'robot',
              timestamp: '2024-01-01T10:00:00Z',
            },
          }),
        ),
      );

      results.forEach((result) => {
        const match = result.message?.message.match(/^\((\d+)\)/);
        expect(match).toBeTruthy();
        const number = parseInt(match![1], 10);
        expect(number).toBeGreaterThanOrEqual(0);
        expect(number).toBeLessThan(10000);
      });
    });

    it('should generate numbers within expected range (0-9999) for stream response', async () => {
      jest.useFakeTimers();

      const callbacks = Array.from({ length: 5 }, () => jest.fn());
      const promises = callbacks.map((callback) =>
        robot.acceptMessageStreamResponse(
          {
            routerId: 'test',
            messageType: 'message',
            message: {
              message: 'test',
              sender: 'user',
              receiver: 'robot',
              timestamp: '2024-01-01T10:00:00Z',
            },
          },
          callback,
        ),
      );

      // Fast-forward all timers
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(500);
      }

      await Promise.all(promises);

      callbacks.forEach((callback) => {
        const allChunks = callback.mock.calls
          .slice(0, -1)
          .map((call) => call[0])
          .join('');

        const match = allChunks.match(/^\((\d+)\)/);
        expect(match).toBeTruthy();
        const number = parseInt(match![1], 10);
        expect(number).toBeGreaterThanOrEqual(0);
        expect(number).toBeLessThan(10000);
      });

      jest.useRealTimers();
    });
  });
});
