import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { KnowledgeBaseJobExecutor } from './knowledge-base-job-executor.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { IStreamingCallbacks } from '../robots/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';

describe('KnowledgeBaseJobExecutor', () => {
  let service: KnowledgeBaseJobExecutor;
  let mockChatManagerService: jest.Mocked<ChatManagerService>;
  let mockRobotService: jest.Mocked<RobotService>;
  let mockIStackInfoService: jest.Mocked<IStackInfoService>;

  const mockPreQueryResponse = {
    query: 'form',
    minConfidence: 0.7,
    pageSize: 10,
    originalText: 'form',
    normalizedText: 'A Customer is inquiring about the Formstack platform...',
    aiTechnicalObservation: 'Technical analysis of form inquiry',
    keywords: ['form', 'configuration'],
    nouns: ['customer', 'platform'],
    properNouns: ['Formstack'],
    domains: ['BACKEND:SUBMIT-ACTIONS'],
    isWordSearch: false,
    applicableKnowledgeBase: ['CONTEXT-DOCUMENTS', 'SLACK'],
    subjects: null,
    userPromptText: 'form inquiry',
    chunks: [
      {
        index: 0,
        chunk_text: 'form',
        chunk_embedding: [0.1, 0.2, 0.3],
      },
    ],
  };

  const mockTopResultsResponse = {
    searchSemantic: {
      SLACK: [
        {
          conversation_id: 'conv_123',
          conversationTextNormalized: 'Form submission issue discussion',
          aiTechnicalObservation: 'Technical insight about form issues',
          confidence: '0.95',
          channelId: 'SLACK:cx-formstack',
          keywords: ['form', 'submission'],
          nouns: ['user', 'form'],
          properNouns: ['Formstack'],
          domains: ['BACKEND:SUBMIT-ACTIONS'],
          subjects: {},
          citations: {
            text: 'conversation: conv_123',
            link: 'https://slack.com/archives/...',
          },
        },
      ],
    },
    searchTypesExecuted: ['searchSemantic'],
    totalSearchTypes: 1,
  };

  beforeEach(async () => {
    const mockChatManager = {
      addMessage: jest.fn(),
      createMessage: jest.fn(),
      addMessageUserOnly: jest.fn(),
      addMessageWithRobotResponse: jest.fn(),
      addMessageErrorNotification: jest.fn(),
      addMessageSystemNotification: jest.fn(),
      addMessageAsContext: jest.fn(),
      addMessageToGetRobotResponse: jest.fn(),
    };

    const mockRobot = {
      getRobotByName: jest.fn(),
    };

    const mockInfoService = {
      knowledgeBase: {
        preQuery: jest.fn(),
        topResults: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseJobExecutor,
        {
          provide: ChatManagerService,
          useValue: mockChatManager,
        },
        {
          provide: RobotService,
          useValue: mockRobot,
        },
        {
          provide: IStackInfoService,
          useValue: mockInfoService,
        },
      ],
    }).compile();

    service = module.get<KnowledgeBaseJobExecutor>(KnowledgeBaseJobExecutor);
    mockChatManagerService = module.get(ChatManagerService);
    mockRobotService = module.get(RobotService);
    mockIStackInfoService = module.get(IStackInfoService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupportedIntents', () => {
    it('should return searchKnowledgeBase intent with proper subIntents', () => {
      const intents = service.getSupportedIntents();

      expect(intents).toHaveLength(1);
      expect(intents[0].intent).toBe('searchKnowledgeBase');
      expect(intents[0].subIntents).toContain('semanticSearch');
      expect(intents[0].subIntents).toContain('keywordSearch');
      expect(intents[0].subIntents).toContain('topResults');
    });
  });

  describe('executeIntent', () => {
    const mockCallbacks: IStreamingCallbacks = {
      conversationId: 'test-conversation',
      onStreamStart: jest.fn(),
      onStreamChunkReceived: jest.fn(),
      onStreamFinished: jest.fn(),
      onFullMessageReceived: jest.fn(),
      onError: jest.fn(),
    };

    const mockIntentData = {
      intent: 'searchKnowledgeBase',
      originalUserPrompt: 'How do I configure forms?',
      subIntents: ['topResults'],
      subjects: {
        query: ['form'],
        minConfidence: ['0.7'],
        pageSize: ['10'],
      },
      conversationId: 'test-conversation-id',
    };

    beforeEach(() => {
      mockIStackInfoService.knowledgeBase.preQuery.mockResolvedValue(
        mockPreQueryResponse,
      );
      mockIStackInfoService.knowledgeBase.topResults.mockResolvedValue(
        mockTopResultsResponse,
      );
      mockChatManagerService.addMessageUserOnly.mockResolvedValue({
        id: 'msg-123',
        conversationId: 'test-conversation',
        content: { type: 'text/markdown', payload: 'test' },
        authorUserId: null,
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      mockChatManagerService.addMessageWithRobotResponse.mockResolvedValue({
        id: 'msg-456',
        conversationId: 'test-conversation',
        content: { type: 'text/markdown', payload: 'robot prompt' },
        authorUserId: null,
        fromRole: UserRole.USER,
        toRole: UserRole.ROBOT,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    it('should execute knowledge base search workflow successfully', async () => {
      await service.executeIntent(mockIntentData, mockCallbacks);

      // Verify preQuery was called
      expect(mockIStackInfoService.knowledgeBase.preQuery).toHaveBeenCalledWith(
        'How do I configure forms?',
      );

      // Verify topResults was called with preQuery response
      expect(
        mockIStackInfoService.knowledgeBase.topResults,
      ).toHaveBeenCalledWith(mockPreQueryResponse);

      // Verify system notification was sent
      expect(
        mockChatManagerService.addMessageSystemNotification,
      ).toHaveBeenCalledWith(
        'test-conversation-id',
        expect.objectContaining({
          type: 'text/markdown',
        }),
      );

      // Verify context was added
      expect(mockChatManagerService.addMessageAsContext).toHaveBeenCalledWith(
        'test-conversation-id',
        expect.objectContaining({
          type: 'context/document',
        }),
      );

      // Verify robot response was triggered
      expect(
        mockChatManagerService.addMessageToGetRobotResponse,
      ).toHaveBeenCalledWith(
        'test-conversation-id',
        expect.objectContaining({
          type: 'text/plain',
        }),
      );
    });

    it('should throw error when conversationId is missing from intentData', async () => {
      const intentDataWithoutConversationId = { ...mockIntentData };
      delete intentDataWithoutConversationId.conversationId;

      await expect(
        service.executeIntent(intentDataWithoutConversationId),
      ).rejects.toThrow('conversationId is required in intentData');
    });

    it('should handle missing originalUserPrompt gracefully', async () => {
      const intentDataWithoutPrompt = { ...mockIntentData };
      delete intentDataWithoutPrompt.originalUserPrompt;

      // Service should complete without throwing (it handles missing prompt gracefully)
      await expect(
        service.executeIntent(intentDataWithoutPrompt),
      ).resolves.not.toThrow();
    });

    it('should handle preQuery service errors', async () => {
      mockIStackInfoService.knowledgeBase.preQuery.mockRejectedValue(
        new Error('PreQuery service error'),
      );

      await service.executeIntent(mockIntentData);

      // Service should send error notification to chat manager
      expect(
        mockChatManagerService.addMessageErrorNotification,
      ).toHaveBeenCalledWith(
        'test-conversation-id',
        expect.objectContaining({
          type: 'text/plain',
          payload: expect.stringContaining('PreQuery service error'),
        }),
      );
    });

    it('should handle topResults service errors', async () => {
      mockIStackInfoService.knowledgeBase.topResults.mockRejectedValue(
        new Error('TopResults service error'),
      );

      await service.executeIntent(mockIntentData);

      // Service should send error notification to chat manager
      expect(
        mockChatManagerService.addMessageErrorNotification,
      ).toHaveBeenCalledWith(
        'test-conversation-id',
        expect.objectContaining({
          type: 'text/plain',
          payload: expect.stringContaining('TopResults service error'),
        }),
      );
    });
  });

  describe('createSearchResultsSummary', () => {
    it('should create human-readable summary of search results', () => {
      const summary = (service as any).createSearchResultsSummary(
        mockTopResultsResponse,
        'How do I configure forms?',
      );

      expect(summary).toContain('🔍 **Knowledge Base Search Results**');
      expect(summary).toContain('How do I configure forms?');
      expect(summary).toContain('searchSemantic');
      expect(summary).toContain('SLACK: 1 results');
      expect(summary).toContain('Confidence: 0.95');
    });

    it('should handle empty search results', () => {
      const emptyResults = {
        searchTypesExecuted: [],
        totalSearchTypes: 0,
      };

      const summary = (service as any).createSearchResultsSummary(
        emptyResults,
        'test query',
      );

      expect(summary).toContain('🔍 **Knowledge Base Search Results**');
      expect(summary).toContain('test query');
      expect(summary).toContain('0 ()');
    });
  });

  describe('fetchSearchResults', () => {
    it('should call topResults with preQuery data', async () => {
      mockIStackInfoService.knowledgeBase.topResults.mockResolvedValue(
        mockTopResultsResponse,
      );

      const result = await (service as any).fetchSearchResults(
        mockPreQueryResponse,
      );

      expect(
        mockIStackInfoService.knowledgeBase.topResults,
      ).toHaveBeenCalledWith(mockPreQueryResponse);
      expect(result).toEqual(mockTopResultsResponse);
    });
  });
});
