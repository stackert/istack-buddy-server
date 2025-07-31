import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import type { TConversationTextMessageEnvelope } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';

// Mock OpenAI
const mockOpenAI = {
  Chat: {
    Completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('openai', () => ({
  default: jest.fn(() => mockOpenAI),
  OpenAI: jest.fn(() => mockOpenAI),
}));

// Mock the tool modules
jest.mock('./tool-definitions/slacky', () => ({
  slackyToolSet: {
    toolDefinitions: [
      {
        name: 'sumoLogicQuery',
        description: 'Assist users with Sumo Logic queries',
        input_schema: {
          type: 'object',
          properties: {
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
          },
          required: ['fromDate', 'toDate'],
        },
      },
    ],
    executeToolCall: jest.fn(),
  },
}));

jest.mock('./tool-definitions/marv', () => ({
  marvToolDefinitions: [
    {
      name: 'fsRestrictedApiFormAndRelatedEntityOverview',
      description: 'Get comprehensive form overview with statistics',
      input_schema: {
        type: 'object',
        properties: {
          formId: { type: 'string' },
        },
        required: ['formId'],
      },
    },
  ],
  performMarvToolCall: jest.fn(),
  FsRestrictedApiRoutesEnum: {
    FormLogicValidation: 'fsRestrictedApiFormLogicValidation',
    FormCalculationValidation: 'fsRestrictedApiFormCalculationValidation',
    FormAndRelatedEntityOverview: 'fsRestrictedApiFormAndRelatedEntityOverview',
  },
}));

jest.mock('./tool-definitions/toolCatalog', () => ({
  createCompositeToolSet: jest.fn(() => ({
    toolDefinitions: [
      {
        name: 'fsRestrictedApiFormAndRelatedEntityOverview',
        description: 'Get comprehensive form overview with statistics',
        input_schema: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
          },
          required: ['formId'],
        },
      },
    ],
    executeToolCall: jest.fn(),
  })),
}));

describe('SlackyOpenAiAgent', () => {
  let robot: SlackyOpenAiAgent;

  beforeEach(() => {
    robot = new SlackyOpenAiAgent();
    jest.clearAllMocks();

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    // Clean up any monitoring intervals
    robot.stopMonitoring();
  });

  describe('Basic Properties', () => {
    it('should have correct basic properties', () => {
      expect(robot.name).toBe('SlackyOpenAiAgent');
      expect(robot.version).toBe('1.0.0');
      expect(robot.LLModelName).toBe('gpt-4o');
      expect(robot.LLModelVersion).toBe('gpt-4o-2024-05-13');
      expect(robot.contextWindowSizeInTokens).toBe(128000);
    });

    it('should have correct static descriptions', () => {
      expect(SlackyOpenAiAgent.descriptionShort).toContain(
        'Slack-specialized OpenAI agent',
      );
      expect(SlackyOpenAiAgent.descriptionLong).toContain(
        'Slack integration with OpenAI',
      );
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      const message = 'Hello world';
      const estimatedTokens = robot.estimateTokens(message);
      expect(estimatedTokens).toBe(Math.ceil(message.length / 4));
    });
  });

  describe('Client Creation', () => {
    it('should throw error when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => {
        (robot as any).getClient();
      }).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should create client when OPENAI_API_KEY is set', () => {
      expect(() => {
        (robot as any).getClient();
      }).not.toThrow();
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool calls successfully', async () => {
      const mockResult = {
        isSuccess: true,
        response: { formId: '123', submissions: '5' },
      };
      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall.mockResolvedValue(mockResult);

      const result = await (robot as any).executeToolCall(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        {
          formId: '123',
        },
      );

      expect(mockCompositeToolSet.executeToolCall).toHaveBeenCalledWith(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        { formId: '123' },
      );
      expect(result).toBe(mockResult);
    });

    it('should handle tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');
      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall.mockRejectedValue(mockError);

      const result = await (robot as any).executeToolCall(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        {
          formId: '123',
        },
      );

      expect(result).toContain(
        'Error executing fsRestrictedApiFormAndRelatedEntityOverview: Tool execution failed',
      );
    });
  });

  describe('Message History Building', () => {
    it('should build OpenAI message history correctly', () => {
      const mockHistory = [
        { fromRole: UserRole.CUSTOMER, content: 'User message 1' },
        { fromRole: UserRole.ROBOT, content: 'Assistant response 1' },
        { fromRole: UserRole.CUSTOMER, content: 'User message 2' },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        mockHistory as any,
      );

      expect(messages).toHaveLength(4); // 3 history + 1 current
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('User message 1');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Assistant response 1');
      expect(messages[2].role).toBe('user');
      expect(messages[2].content).toBe('User message 2');
      expect(messages[3].role).toBe('user');
      expect(messages[3].content).toBe('Current message');
    });

    it('should not duplicate current message if already in history', () => {
      const mockHistory = [
        { fromRole: UserRole.CUSTOMER, content: 'User message 1' },
        { fromRole: UserRole.CUSTOMER, content: 'Current message' },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        mockHistory as any,
      );

      expect(messages).toHaveLength(2); // Should not add duplicate
      expect(messages[1].content).toBe('Current message');
    });
  });

  describe('Direct Feedback Commands', () => {
    it('should handle /help command', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands('/help');
      expect(result).toContain('iStackBuddy (Slacky OpenAI) - Help');
    });

    it('should handle /feedback command', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/feedback This is great!',
      );
      expect(result).toContain('Thank you for your feedback');
      expect(result).toContain('This is great!');
    });

    it('should handle /rate command with positive rating', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate 5 Excellent service',
      );
      expect(result).toContain('Thank you for your rating');
      expect(result).toContain("I'm glad I could help");
    });

    it('should return null for unrecognized commands', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        'Hello world',
      );
      expect(result).toBeNull();
    });
  });

  describe('acceptMessageMultiPartResponse', () => {
    it('should return immediate acknowledgment and start monitoring', async () => {
      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Tell me about form 123',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 5,
        },
      };

      const delayedMessages: TConversationTextMessageEnvelope[] = [];
      const delayedCallback = (message: TConversationTextMessageEnvelope) => {
        delayedMessages.push(message);
      };

      const response = await robot.acceptMessageMultiPartResponse(
        messageEnvelope,
        delayedCallback,
      );

      // Should return immediate acknowledgment
      expect(response.messageId).toContain('ack-');
      expect(response.envelopePayload.content.payload).toBe('Working on it...');
      expect(response.requestOrResponse).toBe('response');
    });
  });

  describe('Tool Response Generation', () => {
    it('should create meaningful response from successful tool results', () => {
      const toolResults = [
        {
          tool_call_id: 'call_123',
          role: 'tool',
          content: {
            isSuccess: true,
            response: {
              formId: '5375703',
              submissions: '2',
              version: '4',
              fieldCount: 56,
              isActive: true,
              url: 'https://example.com/form',
              submitActions: [
                { id: '123', name: 'Action 1' },
                { id: '456', name: 'Action 2' },
              ],
            },
          },
        },
      ];

      const response = (robot as any).createFallbackResponse(toolResults);

      expect(response).toContain('## Form Overview: 5375703');
      expect(response).toContain('**Total Submissions:** 2');
      expect(response).toContain('**Version:** 4');
      expect(response).toContain('**Field Count:** 56');
      expect(response).toContain('**Status:** Active');
      expect(response).toContain('**Submit Actions (2):**');
      expect(response).toContain('• Action 1 (ID: 123)');
      expect(response).toContain('• Action 2 (ID: 456)');
    });

    it('should handle tool errors gracefully', () => {
      const toolResults = [
        {
          tool_call_id: 'call_123',
          role: 'tool',
          content: {
            isSuccess: false,
            response: null,
            errorItems: ['The form was not found'],
          },
        },
      ];

      const response = (robot as any).createFallbackResponse(toolResults);

      expect(response).toContain(
        'I attempted to process your request but encountered some issues:',
      );
      expect(response).toContain('• The form was not found');
      expect(response).toContain(
        'Please verify the form ID or try a different approach.',
      );
    });
  });

  describe('Monitoring System', () => {
    it('should start and stop monitoring correctly', () => {
      // Start monitoring
      (robot as any).startResponseMonitoring(
        { messageId: 'test' } as TConversationTextMessageEnvelope,
        jest.fn(),
      );

      expect((robot as any).isActivelyListeningForResponse).toBe(true);
      expect((robot as any).activeMonitoringIntervals.size).toBeGreaterThan(0);

      // Stop monitoring
      robot.stopMonitoring();

      expect((robot as any).isActivelyListeningForResponse).toBe(false);
      expect((robot as any).activeMonitoringIntervals.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key in immediate response', async () => {
      delete process.env.OPENAI_API_KEY;

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const response =
        await robot.acceptMessageImmediateResponse(messageEnvelope);

      expect(response.envelopePayload.content.payload).toContain(
        'encountered an error',
      );
      expect(response.envelopePayload.content.payload).toContain(
        'OPENAI_API_KEY',
      );
    });
  });

  describe('Streaming Response', () => {
    it('should handle streaming response successfully', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: jest.fn(() => {
          let count = 0;
          return {
            next: () => {
              if (count === 0) {
                count++;
                return Promise.resolve({
                  value: {
                    choices: [{ delta: { content: 'Hello' } }],
                  },
                  done: false,
                });
              } else if (count === 1) {
                count++;
                return Promise.resolve({
                  value: {
                    choices: [{ delta: { content: ' World' } }],
                  },
                  done: false,
                });
              }
              return Promise.resolve({ done: true });
            },
          };
        }),
      };

      // Mock the getClient method to return a proper client
      jest.spyOn(robot as any, 'getClient').mockReturnValue({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockStream),
          },
        },
      });

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const chunks: string[] = [];
      const chunkCallback = (chunk: string) => {
        chunks.push(chunk);
      };

      await robot.acceptMessageStreamResponse(messageEnvelope, chunkCallback);

      expect(chunks).toEqual(['Hello', ' World']);
    });

    it('should handle streaming response errors', async () => {
      mockOpenAI.Chat.Completions.create.mockRejectedValue(
        new Error('Streaming failed'),
      );

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const chunks: string[] = [];
      const chunkCallback = (chunk: string) => {
        chunks.push(chunk);
      };

      await robot.acceptMessageStreamResponse(messageEnvelope, chunkCallback);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('Error in streaming response');
    });
  });

  describe('Tool Status Management', () => {
    it('should update tool status correctly', () => {
      // Initialize toolStatus if it doesn't exist
      if (!(robot as any).toolStatus) {
        (robot as any).toolStatus = {
          executing: [],
          completed: [],
          error: [],
        };
      }

      (robot as any).updateToolStatus('test-tool', 'executing');
      expect((robot as any).toolStatus.executing).toContain('test-tool');

      (robot as any).updateToolStatus('test-tool', 'completed');
      expect((robot as any).toolStatus.executing).not.toContain('test-tool');
      expect((robot as any).toolStatus.completed).toContain('test-tool');
    });

    it('should get tool status correctly', () => {
      // Initialize toolStatus if it doesn't exist
      if (!(robot as any).toolStatus) {
        (robot as any).toolStatus = {
          executing: [],
          completed: [],
          error: [],
        };
      }

      (robot as any).updateToolStatus('test-tool', 'executing');
      const status = (robot as any).getToolStatus();
      expect(status).toContain('Executing tools: test-tool');
    });

    it('should create tool status response', () => {
      // Initialize toolStatus if it doesn't exist
      if (!(robot as any).toolStatus) {
        (robot as any).toolStatus = {
          executing: [],
          completed: [],
          error: [],
        };
      }

      (robot as any).updateToolStatus('test-tool', 'executing');
      const response = (robot as any).createToolStatusResponse(
        'Test status message',
      );

      expect(response.envelopePayload.content.payload).toContain(
        'Test status message',
      );
      expect(response.envelopePayload.content.type).toBe('text/plain');
    });
  });

  describe('Unread Messages', () => {
    it('should get unread messages correctly', async () => {
      // Set up conversation history with messages
      (robot as any).conversationHistory = [
        {
          messageId: 'msg1',
          fromRole: 'customer',
          content: 'Message 1',
        },
        {
          messageId: 'msg2',
          fromRole: 'customer',
          content: 'Message 2',
        },
        {
          messageId: 'msg3',
          fromRole: 'customer',
          content: 'Message 3',
        },
      ];

      const unreadMessages = await (robot as any).getUnreadMessages('msg3');

      // Should return messages before msg3 (excluding msg3 itself)
      expect(unreadMessages).toHaveLength(2);
      expect(unreadMessages[0].messageId).toBe('msg1');
      expect(unreadMessages[1].messageId).toBe('msg2');
    });

    it('should filter out already read messages', async () => {
      // Set up conversation history with messages
      (robot as any).conversationHistory = [
        {
          messageId: 'msg1',
          fromRole: 'customer',
          content: 'Message 1',
        },
        {
          messageId: 'msg2',
          fromRole: 'customer',
          content: 'Message 2',
        },
      ];

      // Mark msg1 as read
      (robot as any).readMessageIds.add('msg1');

      const unreadMessages = await (robot as any).getUnreadMessages('msg2');

      // Should return only unread messages before msg2 (excluding msg2 itself)
      expect(unreadMessages).toHaveLength(0); // msg1 is already read, msg2 is excluded
    });

    it('should handle errors in getUnreadMessages', async () => {
      // Mock the conversationHistory to cause an error
      const originalHistory = (robot as any).conversationHistory;
      (robot as any).conversationHistory = null;

      const unreadMessages = await (robot as any).getUnreadMessages('msg1');

      expect(unreadMessages).toEqual([]);

      // Restore original history
      (robot as any).conversationHistory = originalHistory;
    });
  });

  describe('Tool Execution with Multiple Calls', () => {
    it('should execute multiple tool calls successfully', async () => {
      const mockToolCalls = [
        {
          id: 'call1',
          function: {
            name: 'tool1',
            arguments: JSON.stringify({ param: 'value1' }),
          },
        },
        {
          id: 'call2',
          function: {
            name: 'tool2',
            arguments: JSON.stringify({ param: 'value2' }),
          },
        },
      ];

      const mockCompositeToolSet = (robot as any).compositeToolSet;
      mockCompositeToolSet.executeToolCall
        .mockResolvedValueOnce('Result 1')
        .mockResolvedValueOnce('Result 2');

      const results = await (robot as any).executeToolAllCalls(mockToolCalls);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        tool_call_id: 'call1',
        role: 'tool',
        content: 'Result 1',
      });
      expect(results[1]).toEqual({
        tool_call_id: 'call2',
        role: 'tool',
        content: 'Result 2',
      });
    });

    it('should handle tool call errors in executeToolAllCalls', async () => {
      const mockToolCalls = [
        {
          id: 'call1',
          function: { name: 'tool1', arguments: '{"param": "value1"}' },
        },
      ];

      // Mock the executeToolCall to throw an error
      jest
        .spyOn(robot as any, 'executeToolCall')
        .mockRejectedValue(new Error('Tool failed'));

      const result = await (robot as any).executeToolAllCalls(mockToolCalls);

      expect(result).toHaveLength(1);
      expect(result[0].tool_call_id).toBe('call1');
      expect(result[0].role).toBe('tool');
      expect(result[0].content).toContain('Error executing tool: Tool failed');
    });

    it('should handle invalid JSON in tool arguments', async () => {
      const mockToolCalls = [
        {
          id: 'call1',
          function: {
            name: 'tool1',
            arguments: 'invalid json',
          },
        },
      ];

      const results = await (robot as any).executeToolAllCalls(mockToolCalls);

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('Error executing tool');
    });
  });

  describe('Direct Feedback Commands - Extended', () => {
    it('should handle /rate command with negative rating', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate -2 Poor service',
      );
      expect(result).toContain('Thank you for your rating');
      expect(result).toContain("I'm sorry I couldn't help better");
    });

    it('should handle /rate command without comment', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate 3',
      );
      expect(result).toContain('Thank you for your rating');
      expect(result).toContain('I appreciate your feedback');
    });

    it('should handle /feedback command without message', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/feedback',
      );
      expect(result).toBeNull(); // No message provided, so returns null
    });

    it('should handle invalid rating values', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate 10',
      );
      expect(result).toContain('Please provide a rating between -5 and +5');
      expect(result).toContain('between -5 and +5');
    });

    it('should handle non-numeric rating', async () => {
      const result = await (robot as any).handleDirectFeedbackCommands(
        '/rate abc',
      );
      expect(result).toBeNull(); // Invalid rating, so returns null
    });
  });

  describe('Message History Building - Extended', () => {
    it('should handle empty history', () => {
      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        [],
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Current message');
    });

    it('should handle history with different user roles', () => {
      const mockHistory = [
        { fromRole: UserRole.CUSTOMER, content: 'User message' },
        { fromRole: UserRole.ROBOT, content: 'Assistant response' },
        { fromRole: UserRole.CUSTOMER, content: 'Another user message' },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        mockHistory as any,
      );

      expect(messages).toHaveLength(4); // 3 history + 1 current
      expect(messages[0].role).toBe('user'); // Customer message
      expect(messages[1].role).toBe('assistant'); // Robot message
      expect(messages[2].role).toBe('user'); // Customer message
      expect(messages[3].role).toBe('user'); // Current message
    });

    it('should handle history with unknown roles', () => {
      const mockHistory = [
        { fromRole: 'unknown' as any, content: 'Unknown role message' },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        'Current message',
        mockHistory as any,
      );

      expect(messages).toHaveLength(1); // Only current message because unknown role is filtered out
      expect(messages[0].role).toBe('user');
    });
  });

  describe('Fallback Response Generation - Extended', () => {
    it('should handle empty tool results', () => {
      const response = (robot as any).createFallbackResponse([]);
      expect(response).toContain('I processed your request');
      expect(response).toContain("didn't receive the expected results");
    });

    it('should handle tool results with missing data', () => {
      const toolResults = [
        {
          tool_call_id: 'call_123',
          role: 'tool',
          content: {
            isSuccess: true,
            response: {
              formId: '123',
              // Missing other fields
            },
          },
        },
      ];

      const response = (robot as any).createFallbackResponse(toolResults);
      expect(response).toContain('## Form Overview: 123');
      expect(response).not.toContain('**Total Submissions:**');
      expect(response).not.toContain('**Version:**');
    });

    it('should handle multiple tool results', () => {
      const toolResults = [
        {
          tool_call_id: 'call_1',
          role: 'tool',
          content: {
            isSuccess: true,
            response: { formId: '123', submissions: '5' },
          },
        },
        {
          tool_call_id: 'call_2',
          role: 'tool',
          content: {
            isSuccess: false,
            response: null,
            errorItems: ['Error in second tool'],
          },
        },
      ];

      const response = (robot as any).createFallbackResponse(toolResults);
      expect(response).toContain('I attempted to process your request');
      expect(response).toContain('• Error in second tool');
    });
  });

  describe('Process Request Async', () => {
    it('should handle successful request processing', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'Test response',
                  },
                },
              ],
            }),
          },
        },
      };

      jest.spyOn(robot as any, 'getClient').mockReturnValue(mockClient);

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const mockCallback = jest.fn();
      (robot as any).currentCallback = mockCallback;

      await (robot as any).processRequestAsync(messageEnvelope);

      expect(mockCallback).toHaveBeenCalled();
      expect((robot as any).hasSentFinalResponse).toBe(true);
    });

    it('should handle request processing errors', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      };

      jest.spyOn(robot as any, 'getClient').mockReturnValue(mockClient);

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      await (robot as any).processRequestAsync(messageEnvelope);

      // Should have updated tool status to error
      expect((robot as any).toolStatus.errors).toContain('request-processing');
    });
  });

  describe('Immediate Response - Extended', () => {
    it('should handle immediate response with tools', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'I need to use a tool',
                  },
                  finish_reason: 'tool_calls',
                },
              ],
              usage: { total_tokens: 100 },
            }),
          },
        },
      };

      jest.spyOn(robot as any, 'getClient').mockReturnValue(mockClient);

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const response =
        await robot.acceptMessageImmediateResponse(messageEnvelope);

      expect(response.messageId).toContain('response-');
      expect(response.requestOrResponse).toBe('response');
      expect(response.envelopePayload.author_role).toBe('assistant');
    });

    it('should handle immediate response without tools', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'Simple response',
                  },
                },
              ],
              usage: { total_tokens: 50 },
            }),
          },
        },
      };

      jest.spyOn(robot as any, 'getClient').mockReturnValue(mockClient);

      const messageEnvelope: TConversationTextMessageEnvelope = {
        messageId: 'test-msg',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg-1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'Test message',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 2,
        },
      };

      const response =
        await robot.acceptMessageImmediateResponse(messageEnvelope);

      expect(response.envelopePayload.content.payload).toBe('Simple response');
    });
  });

  describe('Conversation Context - Form Analysis Scenario', () => {
    it('should maintain conversation context for form analysis', async () => {
      // Simulate the conversation flow described by the user
      const robot = new SlackyOpenAiAgent();

      // First message: "what can you tell me about form 5375703"
      const firstMessage: TConversationTextMessageEnvelope = {
        messageId: 'msg1',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg1',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'what can you tell me about form 5375703',
          },
          created_at: '2024-01-01T00:00:00Z',
          estimated_token_count: 10,
        },
      };

      // Mock the conversation history to include the first exchange
      const mockHistory: IConversationMessage[] = [
        {
          id: 'msg1',
          content: 'what can you tell me about form 5375703',
          conversationId: 'conv1',
          fromUserId: 'user1',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'resp1',
          content:
            'I found information about form 5375703. This form has 15 submissions and is currently active.',
          conversationId: 'conv1',
          fromUserId: 'robot1',
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
          messageType: MessageType.TEXT,
          createdAt: new Date('2024-01-01T00:00:30Z'),
          updatedAt: new Date('2024-01-01T00:00:30Z'),
        },
      ];

      // Mock the getHistory callback
      const getHistory = () => mockHistory;

      // Process the second message: "can you find any issues with the form"
      const secondMessage: TConversationTextMessageEnvelope = {
        messageId: 'msg2',
        requestOrResponse: 'request',
        envelopePayload: {
          messageId: 'msg2',
          author_role: 'user',
          content: {
            type: 'text/plain',
            payload: 'can you find any issues with the form',
          },
          created_at: '2024-01-01T00:01:00Z',
          estimated_token_count: 8,
        },
      };

      // Mock OpenAI response to simulate tool calling
      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: 'I need to analyze the form for issues.',
              tool_calls: [
                {
                  id: 'call1',
                  function: {
                    name: 'fsRestrictedApiFormAndRelatedEntityOverview',
                    arguments: JSON.stringify({ formId: '5375703' }),
                  },
                },
              ],
            },
          },
        ],
      };

      // Mock the tool execution
      jest.spyOn(robot as any, 'executeToolCall').mockResolvedValue(
        JSON.stringify({
          isSuccess: true,
          response: {
            formId: '5375703',
            submissions: 15,
            isActive: true,
            fieldCount: 8,
            submitActions: [{ id: 'action1', name: 'Email Notification' }],
          },
        }),
      );

      // Mock the OpenAI client
      const mockClient = {
        chat: {
          completions: {
            create: jest
              .fn()
              .mockResolvedValueOnce(mockOpenAIResponse) // First call with tool
              .mockResolvedValueOnce({
                // Second call for final response
                choices: [
                  {
                    message: {
                      content:
                        'Based on my analysis of form 5375703, I found the following issues...',
                    },
                  },
                ],
              }),
          },
        },
      };
      jest.spyOn(robot as any, 'getClient').mockReturnValue(mockClient as any);

      // Process the second message with history
      const response = await robot.acceptMessageImmediateResponse(
        secondMessage,
        getHistory,
      );

      // Verify that the response contains meaningful information about form 5375703
      expect(response.envelopePayload.content.payload).toContain('5375703');
      expect(response.envelopePayload.content.payload).not.toContain(
        'undefined',
      );

      // Verify that the tool was called with the correct form ID
      expect(robot['executeToolCall']).toHaveBeenCalledWith(
        'fsRestrictedApiFormAndRelatedEntityOverview',
        { formId: '5375703' },
      );
    });
  });
});
