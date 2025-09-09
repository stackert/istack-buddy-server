import { SlackyOpenAiAgent } from './SlackyOpenAiAgent';
import { AnthropicMarv } from './AnthropicMarv';
import { IntentData } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

// Mock dependencies
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

jest.mock('../common/logger/custom-logger.service', () => ({
  CustomLoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

jest.mock('../common/services/intent-parsing.service', () => ({
  IntentParsingService: jest.fn().mockImplementation(() => ({
    parsePromptIntent: jest.fn(),
    registerRobotIntents: jest.fn(),
    getRegisteredIntents: jest.fn(),
  })),
}));

describe('Robot executeIntent Methods', () => {
  let mockCallbacks: IStreamingCallbacks;

  beforeEach(() => {
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    // Clear all mocks
    jest.clearAllMocks();

    // Set up mock callbacks
    mockCallbacks = {
      onStreamChunkReceived: jest.fn(),
      onStreamStart: jest.fn(),
      onStreamFinished: jest.fn(),
      onFullMessageReceived: jest.fn(),
      onError: jest.fn(),
    };
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('SlackyOpenAiAgent executeIntent', () => {
    let slackyAgent: SlackyOpenAiAgent;

    beforeEach(() => {
      slackyAgent = new SlackyOpenAiAgent();

      // Mock the acceptMessageStreamResponse method
      jest
        .spyOn(slackyAgent, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {
          // Simulate successful streaming response
          mockCallbacks.onStreamStart({
            id: 'test-id',
            content: { type: 'text/plain', payload: 'Test response' },
            conversationId: 'test-conversation',
            authorUserId: null,
            fromRole: UserRole.ASSISTANT,
            toRole: UserRole.CUSTOMER,
            messageType: 'text',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockCallbacks.onStreamFinished({
            content: { type: 'text/plain', payload: 'Test response' },
          });
        });
    });

    it('should execute intent by converting to message and calling acceptMessageStreamResponse', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Help me with my form',
        subIntents: ['generalAssistance'],
        subjects: { formId: ['123'] },
      };

      await slackyAgent.executeIntent(intentData, mockCallbacks);

      expect(slackyAgent.acceptMessageStreamResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            type: 'text/plain',
            payload: 'Help me with my form',
          },
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
        }),
        mockCallbacks,
      );
    });

    it('should generate unique message ID for intent execution', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test message',
        subIntents: ['test'],
      };

      await slackyAgent.executeIntent(intentData, mockCallbacks);

      const callArgs = (slackyAgent.acceptMessageStreamResponse as jest.Mock)
        .mock.calls[0][0];
      expect(callArgs.id).toMatch(/^intent-execution-\d+$/);
      expect(callArgs.conversationId).toBe('intent-conversation');
    });

    it('should handle intent data with additional parameters', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Complex request',
        subIntents: ['sub1', 'sub2'],
        subjects: {
          formId: ['123', '456'],
          account: ['test-account'],
        },
        customParam: 'custom value',
      };

      await slackyAgent.executeIntent(intentData, mockCallbacks);

      expect(slackyAgent.acceptMessageStreamResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            type: 'text/plain',
            payload: 'Complex request',
          },
        }),
        mockCallbacks,
      );
    });

    it('should log debug information', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test message for logging',
        subIntents: ['test'],
      };

      await slackyAgent.executeIntent(intentData, mockCallbacks);

      const mockLogger = (slackyAgent as any).logger;
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SlackyOpenAiAgent executeIntent called'),
      );
    });

    it('should handle errors from acceptMessageStreamResponse', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Error test',
        subIntents: ['test'],
      };

      const testError = new Error('Streaming error');
      (slackyAgent.acceptMessageStreamResponse as jest.Mock).mockRejectedValue(
        testError,
      );

      await expect(
        slackyAgent.executeIntent(intentData, mockCallbacks),
      ).rejects.toThrow('Streaming error');
    });
  });

  describe('AnthropicMarv executeIntent', () => {
    let marvAgent: AnthropicMarv;

    beforeEach(() => {
      marvAgent = new AnthropicMarv();

      // Mock the acceptMessageStreamResponse method
      jest
        .spyOn(marvAgent, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {
          // Simulate successful streaming response
          mockCallbacks.onStreamStart({
            id: 'test-id',
            content: { type: 'text/plain', payload: 'Marv response' },
            conversationId: 'test-conversation',
            authorUserId: null,
            fromRole: UserRole.ASSISTANT,
            toRole: UserRole.CUSTOMER,
            messageType: 'text',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockCallbacks.onStreamFinished({
            content: { type: 'text/plain', payload: 'Marv response' },
          });
        });
    });

    it('should execute intent as simple pass-through to acceptMessageStreamResponse', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Debug form 123',
        subIntents: ['checkFieldsLogic'],
        subjects: { formId: ['123'] },
      };

      await marvAgent.executeIntent(intentData, mockCallbacks);

      expect(marvAgent.acceptMessageStreamResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            type: 'text/plain',
            payload: 'Debug form 123',
          },
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
        }),
        mockCallbacks,
      );
    });

    it('should generate unique message ID for intent execution', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Test Marv message',
        subIntents: ['test'],
      };

      await marvAgent.executeIntent(intentData, mockCallbacks);

      const callArgs = (marvAgent.acceptMessageStreamResponse as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.id).toMatch(/^intent-execution-\d+$/);
      expect(callArgs.conversationId).toBe('intent-conversation');
    });

    it('should log debug information', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Marv test message',
        subIntents: ['test'],
      };

      await marvAgent.executeIntent(intentData, mockCallbacks);

      const mockLogger = (marvAgent as any).logger;
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Marv executeIntent called'),
      );
    });

    it('should handle form-specific intent data', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Create new form with fields',
        subIntents: ['createForm', 'createFormField'],
        subjects: {
          formId: ['new-form'],
          account: ['test-account'],
        },
        marvSpecificParam: 'form-creation-data',
      };

      await marvAgent.executeIntent(intentData, mockCallbacks);

      expect(marvAgent.acceptMessageStreamResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            type: 'text/plain',
            payload: 'Create new form with fields',
          },
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
        }),
        mockCallbacks,
      );
    });

    it('should handle errors from acceptMessageStreamResponse', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Marv error test',
        subIntents: ['test'],
      };

      const testError = new Error('Marv streaming error');
      (marvAgent.acceptMessageStreamResponse as jest.Mock).mockRejectedValue(
        testError,
      );

      await expect(
        marvAgent.executeIntent(intentData, mockCallbacks),
      ).rejects.toThrow('Marv streaming error');
    });
  });

  describe('executeIntent Message Structure', () => {
    it('should create consistent message structure across robots', async () => {
      const intentData: IntentData = {
        originalUserPrompt: 'Consistent test message',
        subIntents: ['test'],
        subjects: { formId: ['123'] },
      };

      const slackyAgent = new SlackyOpenAiAgent();
      const marvAgent = new AnthropicMarv();

      // Mock both robots
      jest
        .spyOn(slackyAgent, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {});
      jest
        .spyOn(marvAgent, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {});

      // Execute on both robots
      await slackyAgent.executeIntent(intentData, mockCallbacks);
      await marvAgent.executeIntent(intentData, mockCallbacks);

      // Get the message structures
      const slackyMessage = (
        slackyAgent.acceptMessageStreamResponse as jest.Mock
      ).mock.calls[0][0];
      const marvMessage = (marvAgent.acceptMessageStreamResponse as jest.Mock)
        .mock.calls[0][0];

      // Verify consistent structure (excluding unique IDs)
      expect(slackyMessage.content).toEqual(marvMessage.content);
      expect(slackyMessage.fromRole).toBe(marvMessage.fromRole);
      expect(slackyMessage.toRole).toBe(marvMessage.toRole);
      expect(slackyMessage.messageType).toBe(marvMessage.messageType);
      expect(slackyMessage.conversationId).toBe(marvMessage.conversationId);
      expect(slackyMessage.authorUserId).toBe(marvMessage.authorUserId);
    });

    it('should handle empty and null intent data gracefully', async () => {
      const intentData: IntentData = {
        originalUserPrompt: '',
        subIntents: [],
      };

      const slackyAgent = new SlackyOpenAiAgent();
      jest
        .spyOn(slackyAgent, 'acceptMessageStreamResponse')
        .mockImplementation(async () => {});

      await slackyAgent.executeIntent(intentData, mockCallbacks);

      const message = (slackyAgent.acceptMessageStreamResponse as jest.Mock)
        .mock.calls[0][0];
      expect(message.content.payload).toBe('');
      expect(message.content.type).toBe('text/plain');
    });
  });
});
