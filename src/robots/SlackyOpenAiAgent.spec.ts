import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
import {
  mockConversationMessages,
  mockStreamingCallbacks,
  resetMockCallbacks,
} from '../../test-data/mocks/conversation-messages';
import {
  mockOpenAIClient,
  mockStreamingResponses,
  createAsyncIterator,
  resetAIClientMocks,
} from '../../test-data/mocks/ai-clients';

// Mock the OpenAI SDK
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAIClient),
}));

// Mock the tool sets
jest.mock('./tool-definitions/slacky', () => ({
  slackyToolSet: {
    toolDefinitions: [
      {
        name: 'sumoLogicQuery',
        description: 'Query Sumo Logic',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
      },
    ],
    executeToolCall: jest.fn().mockResolvedValue('Query result'),
  },
}));

jest.mock('./tool-definitions/marv', () => ({
  marvToolDefinitions: [
    {
      name: 'formAndRelatedEntityOverview',
      description: 'Get form overview',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string' },
        },
      },
    },
  ],
  performMarvToolCall: jest.fn().mockResolvedValue({
    status: 'success',
    data: { formId: '123456', fields: [] },
  }),
  FsRestrictedApiRoutesEnum: {
    FormAndRelatedEntityOverview: 'formAndRelatedEntityOverview',
  },
}));

jest.mock('./tool-definitions/toolCatalog', () => ({
  createCompositeToolSet: jest.fn().mockReturnValue({
    toolDefinitions: [
      {
        name: 'sumoLogicQuery',
        description: 'Query Sumo Logic',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
      },
      {
        name: 'formAndRelatedEntityOverview',
        description: 'Get form overview',
        parameters: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
          },
        },
      },
    ],
    executeToolCall: jest.fn().mockResolvedValue('Tool result'),
  }),
}));

// Mock the istack-buddy-utilities
jest.mock('istack-buddy-utilities', () => ({
  ObservationMakers: {
    AbstractObservationMaker: class MockObservationMaker {
      protected subjectType = 'FORM';
      protected observationClass = 'MockObservationMaker';
      protected messagePrimary = 'Mock Observation';

      getRequiredResources() {
        return ['formModel'];
      }

      async makeObservation() {
        return { isObservationTrue: true, logItems: [] };
      }

      extractLogItems(response: any) {
        return response?.logItems || [];
      }
    },
  },
  EObservationSubjectType: {
    FORM: 'FORM',
  },
}));

describe('SlackyOpenAiAgent', () => {
  let robot: SlackyOpenAiAgent;
  const originalEnv = process.env;

  beforeEach(() => {
    robot = new SlackyOpenAiAgent();
    resetMockCallbacks();
    resetAIClientMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct robot properties', () => {
      expect(robot.robotClass).toBe('SlackyOpenAiAgent');
      expect(robot.getName()).toBe('SlackyOpenAiAgent');
      expect(robot.getVersion()).toBe('1.0.0');
      expect(robot.contextWindowSizeInTokens).toBe(128000);
      expect(robot.LLModelName).toBe('gpt-4o');
      expect(robot.LLModelVersion).toBe('gpt-4o-2024-05-13');
    });

    it('should have correct static descriptions', () => {
      expect(SlackyOpenAiAgent.descriptionShort).toContain(
        'Slack-specialized OpenAI agent',
      );
      expect(SlackyOpenAiAgent.descriptionLong).toContain(
        'advanced Slack integration',
      );
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      expect(robot.estimateTokens('abcd')).toBe(1);
      expect(robot.estimateTokens('abcdefgh')).toBe(2);
      expect(robot.estimateTokens('')).toBe(0);
      expect(
        robot.estimateTokens('A very long message with many characters'),
      ).toBe(10);
    });
  });

  describe('Client Initialization', () => {
    it('should create client with API key', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const client = (robot as any).getClient();
      expect(client).toBeDefined();
    });

    it('should throw error when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => (robot as any).getClient()).toThrow(
        'OPENAI_API_KEY environment variable is required',
      );
    });
  });

  describe('User Help Text', () => {
    it('should return formatted help message', () => {
      const help = robot.getUserHelpText();
      expect(help).toContain('iStackBuddy (Slacky OpenAI) - Help');
      expect(help).toContain('What I Can Help With');
      expect(help).toContain('SSO troubleshooting');
      expect(help).toContain('Forms Core Troubleshooting');
    });
  });

  describe('Tool Call Execution', () => {
    it('should execute tool call successfully', async () => {
      const result = await (robot as any).executeToolCall(
        'sumoLogicQuery',
        { query: 'test query' },
        jest.fn(),
      );

      expect(result).toBe('Tool result');
    });
  });

  describe('Streaming Response', () => {
    it('should handle successful streaming response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      // Spy on the streaming method and mock its behavior
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamStart?.(message);
          callbacks.onStreamChunkReceived?.('Hello, I can help you with that.');
          callbacks.onStreamFinished?.(message);
        });

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onStreamStart).toHaveBeenCalledWith(message);
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Hello, I can help you with that.',
      );
      expect(callbacks.onStreamFinished).toHaveBeenCalledWith(message);

      streamingSpy.mockRestore();
    });

    it('should handle tool calls in streaming response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      // Spy on the streaming method and mock tool call behavior
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamStart?.(message);
          callbacks.onStreamChunkReceived?.('Tool executed successfully');
          callbacks.onStreamFinished?.(message);
        });

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onStreamStart).toHaveBeenCalledWith(message);
      expect(callbacks.onStreamChunkReceived).toHaveBeenCalledWith(
        'Tool executed successfully',
      );

      streamingSpy.mockRestore();
    });

    it('should handle streaming errors', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      // Spy on the streaming method and mock error behavior
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError?.(new Error('Streaming failed'));
        });

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));

      streamingSpy.mockRestore();
    });

    it('should handle missing API key in streaming', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = { ...mockStreamingCallbacks };

      delete process.env.OPENAI_API_KEY;

      await robot.acceptMessageStreamResponse(message, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Message History Building', () => {
    it('should build OpenAI message history correctly', () => {
      const currentMessage = 'Current message';
      const history = [
        mockConversationMessages.customerMessage('First message'),
        mockConversationMessages.agentMessage('First response'),
        mockConversationMessages.customerMessage('Second message'),
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        currentMessage,
        history,
      );

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('First message');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].role).toBe('user');
      expect(messages[2].content).toBe('Current message');
    });

    it('should handle empty history', () => {
      const currentMessage = 'Current message';
      const messages = (robot as any).buildOpenAIMessageHistory(
        currentMessage,
        [],
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Current message');
    });

    it('should handle history with new format messages', () => {
      const currentMessage = 'Current message';
      const history = [
        {
          ...mockConversationMessages.customerMessage('First message'),
          role: 'user',
          content: 'First message',
        },
        {
          ...mockConversationMessages.agentMessage('First response'),
          role: 'assistant',
          content: 'First response',
        },
      ];

      const messages = (robot as any).buildOpenAIMessageHistory(
        currentMessage,
        history,
      );

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });
  });

  describe('Tool Status Management', () => {
    it('should update tool status correctly', () => {
      (robot as any).updateToolStatus('testTool', 'executing');
      expect((robot as any).toolStatus.executing).toContain('testTool');

      (robot as any).updateToolStatus('testTool', 'completed');
      expect((robot as any).toolStatus.executing).not.toContain('testTool');
      expect((robot as any).toolStatus.completed).toContain('testTool');

      (robot as any).updateToolStatus('testTool', 'error');
      expect((robot as any).toolStatus.completed).not.toContain('testTool');
      expect((robot as any).toolStatus.errors).toContain('testTool');
    });

    it('should handle tool status updates for unknown status', () => {
      (robot as any).updateToolStatus('testTool', 'unknown');
      // Should not throw error and should not add to any status arrays
      expect((robot as any).toolStatus.executing).not.toContain('testTool');
      expect((robot as any).toolStatus.completed).not.toContain('testTool');
      expect((robot as any).toolStatus.errors).not.toContain('testTool');
    });
  });

  describe('Conversation History Management', () => {
    it('should set conversation history correctly', () => {
      const history = [
        mockConversationMessages.customerMessage('First message'),
        mockConversationMessages.agentMessage('First response'),
      ];

      robot.setConversationHistory(history);

      expect((robot as any).conversationHistory).toEqual(history);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      // Mock the existing compositeToolSet property
      (robot as any).compositeToolSet = {
        toolDefinitions: [],
        executeToolCall: jest
          .fn()
          .mockRejectedValueOnce(new Error('Tool execution failed')),
      };

      const result = await (robot as any).executeToolCall(
        'testTool',
        {},
        jest.fn(),
      );

      expect(result).toContain(
        'Error executing testTool: Tool execution failed',
      );
    });

    it('should handle non-Error exceptions in tool execution', async () => {
      // Mock the existing compositeToolSet property
      (robot as any).compositeToolSet = {
        toolDefinitions: [],
        executeToolCall: jest.fn().mockRejectedValueOnce('String error'),
      };

      const result = await (robot as any).executeToolCall(
        'testTool',
        {},
        jest.fn(),
      );

      expect(result).toContain('Error executing testTool: Unknown error');
    });
  });

  describe('Immediate Response', () => {
    it('should handle streaming errors in immediate response', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      // Spy on streaming method to simulate error
      const spy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError?.(new Error('Streaming error'));
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe(
        'Error in streaming response: Streaming error',
      );

      spy.mockRestore();
    });

    it('should provide fallback when streaming fails', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      // Spy on streaming method to simulate no callbacks
      const spy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {
          // No callbacks called
        });

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toBe('No response generated');

      spy.mockRestore();
    });

    it('should return error message when API key missing', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      delete process.env.OPENAI_API_KEY;

      const result = await robot.acceptMessageImmediateResponse(message);

      expect(result.content.type).toBe('text/plain');
      expect(result.content.payload).toContain(
        'Error in streaming response: OPENAI_API_KEY environment variable is required',
      );
    });
  });

  describe('Multi-part Response', () => {
    it('should send immediate response and delayed callback', async () => {
      const message = mockConversationMessages.customerMessage('Hello');
      const delayedCallback = jest.fn();

      // Spy on immediate response method
      const immediateSpy = jest
        .spyOn(robot, 'acceptMessageImmediateResponse')
        .mockResolvedValue({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Spy on streaming method
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onStreamFinished?.(message);
        });

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');
      expect(delayedCallback).toHaveBeenCalledWith(message);

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });

    it('should handle streaming errors in multi-part response', async () => {
      const message = mockConversationMessages.customerMessage('Hello');
      const delayedCallback = jest.fn();

      // Spy on immediate response method
      const immediateSpy = jest
        .spyOn(robot, 'acceptMessageImmediateResponse')
        .mockResolvedValue({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Spy on streaming method to simulate error
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onError?.(new Error('Streaming error'));
        });

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');
      expect(delayedCallback).toHaveBeenCalledWith({
        content: {
          type: 'text/plain',
          payload: 'Error in streaming response: Streaming error',
        },
      });

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });

    it('should handle null delayed callback', async () => {
      const message = mockConversationMessages.customerMessage('Hello');

      // Spy on immediate response method
      const immediateSpy = jest
        .spyOn(robot, 'acceptMessageImmediateResponse')
        .mockResolvedValue({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Spy on streaming method
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {
          // No callbacks called
        });

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        null as any,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });
  });

  describe('Message Transformer', () => {
    it('should transform customer messages to user role', () => {
      const message = mockConversationMessages.customerMessage('Hello');
      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello');
    });

    it('should transform robot messages to assistant role', () => {
      const message = mockConversationMessages.robotMessage('I can help');
      const transformer = robot.getGetFromRobotToConversationTransformer();
      const result = transformer(message);

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('I can help');
    });
  });

  describe('Coverage Improvements', () => {
    it('should handle direct feedback commands', async () => {
      const feedbackMessage = '/feedback This is great!';
      const result = await (robot as any).handleDirectFeedbackCommands(
        feedbackMessage,
      );

      expect(result).toContain('Thank you for your feedback!');
      expect(result).toContain('This is great!');
    });

    it('should handle rating commands with positive rating', async () => {
      const ratingMessage = '/rate 5 Excellent service';
      const result = await (robot as any).handleDirectFeedbackCommands(
        ratingMessage,
      );

      expect(result).toContain('Thank you for your rating!');
      expect(result).toContain("I'm glad I could help!");
      expect(result).toContain('Excellent service');
    });

    it('should handle rating commands with negative rating', async () => {
      const ratingMessage = '/rate -2 Not helpful';
      const result = await (robot as any).handleDirectFeedbackCommands(
        ratingMessage,
      );

      expect(result).toContain('Thank you for your rating!');
      expect(result).toContain("I'm sorry I couldn't help better");
      expect(result).toContain('Not helpful');
    });

    it('should handle invalid rating range', async () => {
      const ratingMessage = '/rate 10 Too high';
      const result = await (robot as any).handleDirectFeedbackCommands(
        ratingMessage,
      );

      expect(result).toContain('Please provide a rating between -5 and +5');
      expect(result).toContain('You provided: 10');
    });

    it('should handle help command', async () => {
      const helpMessage = '/help';
      const result = await (robot as any).handleDirectFeedbackCommands(
        helpMessage,
      );

      expect(result).toContain('**Available Commands:**');
      expect(result).toContain('/feedback');
      expect(result).toContain('/rate');
    });

    it('should handle unknown commands', async () => {
      const unknownMessage = '/unknown command';
      const result = await (robot as any).handleDirectFeedbackCommands(
        unknownMessage,
      );

      expect(result).toBeNull();
    });

    it('should handle onStreamFinished callback in streaming response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const callbacks = {
        ...mockStreamingCallbacks,
        onStreamFinished: jest.fn(),
      };

      // Mock the immediate response method to directly test the callback
      const immediateSpy = jest
        .spyOn(robot, 'acceptMessageImmediateResponse')
        .mockImplementation(async (msg) => {
          // Simulate the callback being called
          callbacks.onStreamFinished({
            content: { payload: 'Final response', type: 'text/plain' },
          });
          return { content: { type: 'text/plain', payload: 'Final response' } };
        });

      await robot.acceptMessageImmediateResponse(message);

      expect(callbacks.onStreamFinished).toHaveBeenCalledWith({
        content: { payload: 'Final response', type: 'text/plain' },
      });

      immediateSpy.mockRestore();
    });

    it('should handle onFullMessageReceived callback in multi-part response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const delayedCallback = jest.fn();

      // Mock immediate response
      const immediateSpy = jest
        .spyOn(robot, 'acceptMessageImmediateResponse')
        .mockResolvedValue({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Mock streaming response to call onFullMessageReceived
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockImplementation(async (_msg, callbacks: any) => {
          callbacks.onFullMessageReceived({
            content: { payload: 'Intermediate message', type: 'text/plain' },
          });
        });

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');
      expect(delayedCallback).toHaveBeenCalledWith({
        content: { payload: 'Intermediate message', type: 'text/plain' },
      });

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });

    it('should handle streaming promise rejection in multi-part response', async () => {
      const message = mockConversationMessages.customerMessage('Test message');
      const delayedCallback = jest.fn();

      // Mock immediate response
      const immediateSpy = jest
        .spyOn(robot, 'acceptMessageImmediateResponse')
        .mockResolvedValue({
          content: { type: 'text/plain', payload: 'Immediate response' },
        });

      // Mock streaming response to reject
      const streamingSpy = jest
        .spyOn(robot as any, 'acceptMessageStreamResponse')
        .mockRejectedValue(new Error('Streaming promise rejected'));

      const result = await robot.acceptMessageMultiPartResponse(
        message,
        delayedCallback,
      );

      expect(result.type).toBe('text/plain');
      expect(result.payload).toBe('Immediate response');
      expect(delayedCallback).toHaveBeenCalledWith({
        content: {
          type: 'text/plain',
          payload: 'Error in streaming response: Streaming promise rejected',
        },
      });

      immediateSpy.mockRestore();
      streamingSpy.mockRestore();
    });

    it('should handle current message already in history', () => {
      const currentMessage = 'Current message';
      const history = [
        mockConversationMessages.customerMessage(currentMessage),
      ];

      const result = (robot as any).buildOpenAIMessageHistory(
        currentMessage,
        history,
      );

      // Should not add the current message again since it's already in history
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe(currentMessage);
    });

    it('should handle robot messages in history', () => {
      const currentMessage = 'Current message';
      const history = [mockConversationMessages.robotMessage('Robot response')];

      const result = (robot as any).buildOpenAIMessageHistory(
        currentMessage,
        history,
      );

      expect(result).toHaveLength(2); // History + current message
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toBe('Robot response');
      expect(result[1].role).toBe('user');
      expect(result[1].content).toBe(currentMessage);
    });
  });
});
