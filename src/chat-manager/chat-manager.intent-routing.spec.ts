import { Test, TestingModule } from '@nestjs/testing';
import { ChatManagerService } from './chat-manager.service';
import { ChatConversationListService } from '../ConversationLists/ChatConversationListService';
import { RobotService } from '../robots/robot.service';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import {
  CreateMessageDto,
  MessageType,
  UserRole,
} from './dto/create-message.dto';
import {
  IntentParsingResponse,
  IntentParsingError,
} from '../common/types/intent-parsing.types';

// Mock IntentParsingService
jest.mock('../common/services/intent-parsing.service', () => {
  return {
    IntentParsingService: jest.fn().mockImplementation(() => ({
      parsePromptIntent: jest.fn(),
      registerRobotIntents: jest.fn(),
      getRegisteredIntents: jest.fn(),
    })),
  };
});

// Mock dependencies
const mockChatConversationListService = {
  addMessage: jest.fn(),
  getMessages: jest.fn(),
  getConversations: jest.fn(),
};

const mockRobotService = {
  getRobotByName: jest.fn(),
  getAllRobots: jest.fn(),
};

const mockIntentParsingService = {
  parsePromptIntent: jest.fn(),
  registerRobotIntents: jest.fn(),
  getRegisteredIntents: jest.fn(),
};

// Mock robot instances
const mockAnthropicMarv = {
  name: 'AnthropicMarv',
  acceptMessageStreamResponse: jest.fn(),
  getGetFromRobotToConversationTransformer: jest.fn(),
};

const mockSlackyAgent = {
  name: 'SlackyOpenAiAgent',
  acceptMessageStreamResponse: jest.fn(),
  getGetFromRobotToConversationTransformer: jest.fn(),
};

describe('ChatManagerService - Intent Routing Integration', () => {
  let service: ChatManagerService;

  beforeEach(async () => {
    // Set environment variable to prevent OpenAI constructor error
    process.env.OPENAI_API_KEY = 'test-api-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatManagerService,
        {
          provide: ChatConversationListService,
          useValue: mockChatConversationListService,
        },
        {
          provide: RobotService,
          useValue: mockRobotService,
        },
      ],
    }).compile();

    service = module.get<ChatManagerService>(ChatManagerService);

    // Mock the IntentParsingService instance
    (service as any).intentParsingService = mockIntentParsingService;

    // Clear all mocks
    jest.clearAllMocks();

    // Set up default mock behaviors
    mockRobotService.getRobotByName.mockImplementation((name: string) => {
      switch (name) {
        case 'AnthropicMarv':
          return mockAnthropicMarv;
        case 'SlackyOpenAiAgent':
          return mockSlackyAgent;
        default:
          return null;
      }
    });

    mockAnthropicMarv.getGetFromRobotToConversationTransformer.mockReturnValue(
      () => ({}),
    );
    mockSlackyAgent.getGetFromRobotToConversationTransformer.mockReturnValue(
      () => ({}),
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('handleRobotMessage with Intent Routing', () => {
    it('should use intent parsing to select AnthropicMarv robot', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Debug form 123',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const intentResult: IntentParsingResponse = {
        robotName: 'AnthropicMarv',
        intent: 'debugForm',
        intentData: {
          originalUserPrompt: 'Debug form 123',
          subIntents: ['checkFieldsLogic'],
          subjects: { formId: ['123'] },
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        intentResult,
      );
      mockAnthropicMarv.acceptMessageStreamResponse.mockResolvedValue(
        undefined,
      );

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      await service.handleRobotMessage(createMessageDto);

      expect(mockIntentParsingService.parsePromptIntent).toHaveBeenCalledWith(
        'Debug form 123',
        { currentRobot: undefined },
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
      expect(mockAnthropicMarv.acceptMessageStreamResponse).toHaveBeenCalled();
    });

    it('should use intent parsing to select SlackyOpenAiAgent robot', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Help me with general assistance',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const intentResult: IntentParsingResponse = {
        robotName: 'SlackyOpenAiAgent',
        intent: 'assistUser',
        intentData: {
          originalUserPrompt: 'Help me with general assistance',
          subIntents: ['generalAssistance'],
          subjects: {},
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        intentResult,
      );
      mockSlackyAgent.acceptMessageStreamResponse.mockResolvedValue(undefined);

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      await service.handleRobotMessage(createMessageDto);

      expect(mockIntentParsingService.parsePromptIntent).toHaveBeenCalledWith(
        'Help me with general assistance',
        { currentRobot: undefined },
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'SlackyOpenAiAgent',
      );
      expect(mockSlackyAgent.acceptMessageStreamResponse).toHaveBeenCalled();
    });

    it('should fallback to AnthropicMarv when intent parsing fails', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Unclear request',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const intentError: IntentParsingError = {
        error: 'Parsing failed',
        reason: 'Unclear intent',
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(intentError);
      mockAnthropicMarv.acceptMessageStreamResponse.mockResolvedValue(
        undefined,
      );

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      // Spy on console.warn to verify fallback logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.handleRobotMessage(createMessageDto);

      expect(mockIntentParsingService.parsePromptIntent).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Intent parsing failed: Parsing failed. Falling back to AnthropicMarv',
        ),
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
      expect(mockAnthropicMarv.acceptMessageStreamResponse).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should fallback to AnthropicMarv when selected robot is not found', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Test message',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const intentResult: IntentParsingResponse = {
        robotName: 'NonExistentRobot',
        intent: 'testIntent',
        intentData: {
          originalUserPrompt: 'Test message',
          subIntents: ['test'],
          subjects: {},
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        intentResult,
      );
      mockAnthropicMarv.acceptMessageStreamResponse.mockResolvedValue(
        undefined,
      );

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      // Spy on console.warn to verify fallback logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.handleRobotMessage(createMessageDto);

      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'NonExistentRobot',
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Robot NonExistentRobot not found, falling back to AnthropicMarv',
        ),
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
      expect(mockAnthropicMarv.acceptMessageStreamResponse).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should fallback to AnthropicMarv when intent parsing throws exception', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Exception test',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      mockIntentParsingService.parsePromptIntent.mockRejectedValue(
        new Error('Service error'),
      );
      mockAnthropicMarv.acceptMessageStreamResponse.mockResolvedValue(
        undefined,
      );

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      // Spy on console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.handleRobotMessage(createMessageDto);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error in handleRobotMessage: Service error. Falling back to AnthropicMarv',
        ),
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
      expect(mockAnthropicMarv.acceptMessageStreamResponse).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log successful intent parsing result', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Search for documentation',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const intentResult: IntentParsingResponse = {
        robotName: 'SlackyOpenAiAgent',
        intent: 'searchKnowledge',
        intentData: {
          originalUserPrompt: 'Search for documentation',
          subIntents: ['findContextDocumentHelpArticles'],
          subjects: { query: ['documentation'] },
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        intentResult,
      );
      mockSlackyAgent.acceptMessageStreamResponse.mockResolvedValue(undefined);

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      // Spy on console.log to verify success logging
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.handleRobotMessage(createMessageDto);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Intent parsing selected robot: SlackyOpenAiAgent with intent: searchKnowledge',
        ),
      );

      consoleSpy.mockRestore();
    });

    it('should pass correct parameters to handleRobotStreamingResponse', async () => {
      const createMessageDto: CreateMessageDto = {
        conversationId: 'specific-conversation',
        fromUserId: 'specific-user',
        content: 'Specific test message',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      const intentResult: IntentParsingResponse = {
        robotName: 'AnthropicMarv',
        intent: 'debugForm',
        intentData: {
          originalUserPrompt: 'Specific test message',
          subIntents: ['checkFieldsLogic'],
          subjects: { formId: ['456'] },
        },
      };

      mockIntentParsingService.parsePromptIntent.mockResolvedValue(
        intentResult,
      );
      mockAnthropicMarv.acceptMessageStreamResponse.mockResolvedValue(
        undefined,
      );

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      // Spy on handleRobotStreamingResponse to verify parameters
      const handleRobotStreamingResponseSpy = jest
        .spyOn(service, 'handleRobotStreamingResponse')
        .mockResolvedValue();

      await service.handleRobotMessage(createMessageDto);

      expect(handleRobotStreamingResponseSpy).toHaveBeenCalledWith(
        'specific-conversation',
        'AnthropicMarv',
        'Specific test message',
        expect.any(Object), // callbacks
      );

      handleRobotStreamingResponseSpy.mockRestore();
    });

    it('should maintain backward compatibility when intent parsing is disabled', async () => {
      // Temporarily replace the intent parsing service with null to simulate disabled state
      (service as any).intentParsingService = null;

      const createMessageDto: CreateMessageDto = {
        conversationId: 'test-conversation',
        fromUserId: 'test-user',
        content: 'Backward compatibility test',
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
      };

      mockAnthropicMarv.acceptMessageStreamResponse.mockResolvedValue(
        undefined,
      );

      // Mock the getHistory method
      jest.spyOn(service, 'getHistory').mockReturnValue([]);

      // Spy on console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.handleRobotMessage(createMessageDto);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in handleRobotMessage'),
      );
      expect(mockRobotService.getRobotByName).toHaveBeenCalledWith(
        'AnthropicMarv',
      );
      expect(mockAnthropicMarv.acceptMessageStreamResponse).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
