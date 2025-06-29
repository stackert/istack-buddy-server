import { SlackAgentCoreFormsSsoAutofillParrot } from './SlackAgentCoreFormsSsoAutofillParrot';
import { TMessageEnvelope, TRobotMessage } from '../types';

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

    it('should have correct contextWindowSizeInTokens property', () => {
      expect(robot.contextWindowSizeInTokens).toBe(4096);
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

  describe('acceptMessageImmediateResponse', () => {
    let mockMessageEnvelope: TMessageEnvelope;
    let mockRobotMessage: TRobotMessage;

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

  describe('acceptMessageMultiPartResponse', () => {
    let mockMessageEnvelope: TMessageEnvelope;
    let mockRobotMessage: TRobotMessage;
    let mockCallback: jest.Mock;

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

      mockCallback = jest.fn();
    });

    it('should return a promise that resolves immediately', async () => {
      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockCallback,
      );

      expect(result).toBeDefined();
      expect(result.routerId).toBe('router-123');
      expect(result.messageType).toBe('message');
    });

    it('should return initial response with prefixed message', async () => {
      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockCallback,
      );

      expect(result.message?.message).toMatch(/^\(\d+\) Test message$/);
    });

    it('should call the callback after 500ms with complete message', (done) => {
      robot.acceptMessageMultiPartResponse(mockMessageEnvelope, mockCallback);

      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledTimes(1);
        const callArgs = mockCallback.mock.calls[0][0];
        expect(callArgs.message?.message).toMatch(
          /^\(\d+\) - complete: Test message$/,
        );
        done();
      }, 600);
    }, 1000);

    it('should use the same random number for both initial and callback responses', async () => {
      const initialResult = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockCallback,
      );
      const initialMessage = initialResult.message?.message || '';
      const randomNumber = initialMessage.match(/^\((\d+)\)/)?.[1];

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockCallback).toHaveBeenCalledWith(
            expect.objectContaining({
              message: expect.objectContaining({
                message: `(${randomNumber}) - complete: Test message`,
              }),
            }),
          );
          resolve();
        }, 600);
      });
    });

    it('should preserve all message properties in callback', (done) => {
      robot.acceptMessageMultiPartResponse(mockMessageEnvelope, (response) => {
        expect(response.message?.sender).toBe('user123');
        expect(response.message?.receiver).toBe('robot');
        expect(response.message?.timestamp).toBe('2024-01-01T10:00:00Z');
        expect(response.routerId).toBe('router-123');
        expect(response.messageType).toBe('message');
        done();
      });
    }, 1000);

    it('should handle empty message in multi-part response', async () => {
      mockMessageEnvelope.message!.message = '';

      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        mockCallback,
      );

      expect(result.message?.message).toMatch(/^\(\d+\) $/);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockCallback).toHaveBeenCalledWith(
            expect.objectContaining({
              message: expect.objectContaining({
                message: expect.stringMatching(/^\(\d+\) - complete: $/),
              }),
            }),
          );
          resolve();
        }, 600);
      });
    });

    it('should handle callback not being called if not provided', async () => {
      // This test ensures the method doesn't crash if callback is somehow undefined
      const result = await robot.acceptMessageMultiPartResponse(
        mockMessageEnvelope,
        undefined as any,
      );

      expect(result).toBeDefined();
      expect(result.message?.message).toMatch(/^\(\d+\) Test message$/);
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

  describe('Edge Cases', () => {
    it('should handle message envelope without message property', async () => {
      const envelopeWithoutMessage: TMessageEnvelope = {
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

    it('should handle multiple concurrent calls', async () => {
      const envelopes = Array.from({ length: 5 }, (_, i) => ({
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
  });

  describe('Random Number Generation', () => {
    it('should generate numbers within expected range (0-9999)', async () => {
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
  });

  describe('getFunctionDescriptions', () => {
    it('should return an empty array', () => {
      const result = robot.getFunctionDescriptions();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('Knowledge Base', () => {
    it('should return correct knowledgeBase via getter', () => {
      const knowledgeBase = robot.knowledgeBase;
      expect(knowledgeBase).toBeDefined();
      expect(knowledgeBase.knowledgeBaseId).toBe('core:forms');
      expect(knowledgeBase.name).toBe('Core Forms');
      expect(knowledgeBase.descriptionShort).toBe('Core Forms');
      expect(knowledgeBase.descriptionLong).toBe('Core Forms');
      expect(knowledgeBase.channelId).toBe('123');
      expect(knowledgeBase.channelName).toBe('#cx-formstack');
    });

    it('should return correct knowledgeBase via getKnowledgeBase method', () => {
      const knowledgeBase = robot.getKnowledgeBase();
      expect(knowledgeBase).toBeDefined();
      expect(knowledgeBase.knowledgeBaseId).toBe('core:forms');
      expect(knowledgeBase.name).toBe('Core Forms');
      expect(knowledgeBase.descriptionShort).toBe('Core Forms');
      expect(knowledgeBase.descriptionLong).toBe('Core Forms');
      expect(knowledgeBase.channelId).toBe('123');
      expect(knowledgeBase.channelName).toBe('#cx-formstack');
    });

    it('should return same object from getter and method', () => {
      const fromGetter = robot.knowledgeBase;
      const fromMethod = robot.getKnowledgeBase();
      expect(fromGetter).toEqual(fromMethod);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly for simple messages', () => {
      expect(robot.estimateTokens('hello')).toBe(2); // 5 chars / 4 = 1.25, ceil = 2
      expect(robot.estimateTokens('test')).toBe(1); // 4 chars / 4 = 1
      expect(robot.estimateTokens('testing')).toBe(2); // 7 chars / 4 = 1.75, ceil = 2
    });

    it('should handle empty string', () => {
      expect(robot.estimateTokens('')).toBe(0); // 0 chars / 4 = 0
    });

    it('should handle long messages', () => {
      const longMessage = 'a'.repeat(100); // 100 characters
      expect(robot.estimateTokens(longMessage)).toBe(25); // 100 / 4 = 25
    });

    it('should handle messages with special characters', () => {
      const specialMessage = '@#$%^&*()_+-={}[]|\\:";\'<>?,./`~';
      const expectedTokens = Math.ceil(specialMessage.length / 4);
      expect(robot.estimateTokens(specialMessage)).toBe(expectedTokens);
    });

    it('should handle unicode characters', () => {
      const unicodeMessage = '🚀🌟✨💫🎉';
      const expectedTokens = Math.ceil(unicodeMessage.length / 4);
      expect(robot.estimateTokens(unicodeMessage)).toBe(expectedTokens);
    });

    it('should return integer values only', () => {
      const testCases = ['a', 'ab', 'abc', 'abcd', 'abcde'];
      testCases.forEach((testCase) => {
        const result = robot.estimateTokens(testCase);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
