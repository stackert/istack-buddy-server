import { Test, TestingModule } from '@nestjs/testing';
import { ConversationListSlackAppService } from './ConversationListSlackAppService';
import { ConversationListSlackApp } from './ConversationListSlackApp';

describe('ConversationListSlackAppService', () => {
  let service: ConversationListSlackAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationListSlackAppService],
    }).compile();

    service = module.get<ConversationListSlackAppService>(
      ConversationListSlackAppService,
    );
  });

  afterEach(() => {
    service.clearAllConversations();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extend ConversationListService', () => {
    expect(service).toBeInstanceOf(ConversationListSlackAppService);
  });

  describe('constructor', () => {
    it('should create ConversationListSlackApp instances', () => {
      const conversation = service.getConversationOrCreate(
        'test-conv',
        'Test',
        'Test Description',
      );
      expect(conversation).toBeInstanceOf(ConversationListSlackApp);
    });
  });

  describe('getCustomerSupportConversationOrCreate', () => {
    it('should create customer support conversation with correct naming', () => {
      const customerId = 'CUST123';
      const conversationId = 'conv-123';

      const conversation = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );

      expect(conversation).toBeInstanceOf(ConversationListSlackApp);
      expect(service.hasConversation(conversationId)).toBe(true);
    });

    it('should return existing conversation if it already exists', () => {
      const customerId = 'CUST456';
      const conversationId = 'conv-456';

      const firstCall = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );
      const secondCall = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
      );

      expect(firstCall).toBe(secondCall);
    });

    it('should handle acceptKey parameter', () => {
      const customerId = 'CUST789';
      const conversationId = 'conv-789';
      const acceptKey = 'security-key';

      const conversation = service.getCustomerSupportConversationOrCreate(
        conversationId,
        customerId,
        acceptKey,
      );

      expect(conversation).toBeInstanceOf(ConversationListSlackApp);
      expect(service.hasConversation(conversationId)).toBe(true);
    });

    it('should create multiple customer support conversations', () => {
      const conv1 = service.getCustomerSupportConversationOrCreate(
        'conv1',
        'CUST1',
      );
      const conv2 = service.getCustomerSupportConversationOrCreate(
        'conv2',
        'CUST2',
      );

      expect(conv1).not.toBe(conv2);
      expect(service.getConversationCount()).toBe(2);
    });
  });

  describe('getTeamConversationOrCreate', () => {
    it('should create team conversation with correct naming', () => {
      const teamName = 'Engineering Team';
      const conversationId = 'team-conv-123';

      const conversation = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
      );

      expect(conversation).toBeInstanceOf(ConversationListSlackApp);
      expect(service.hasConversation(conversationId)).toBe(true);
    });

    it('should return existing conversation if it already exists', () => {
      const teamName = 'Design Team';
      const conversationId = 'team-conv-456';

      const firstCall = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
      );
      const secondCall = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
      );

      expect(firstCall).toBe(secondCall);
    });

    it('should handle acceptKey parameter', () => {
      const teamName = 'Marketing Team';
      const conversationId = 'team-conv-789';
      const acceptKey = 'team-security-key';

      const conversation = service.getTeamConversationOrCreate(
        conversationId,
        teamName,
        acceptKey,
      );

      expect(conversation).toBeInstanceOf(ConversationListSlackApp);
      expect(service.hasConversation(conversationId)).toBe(true);
    });

    it('should create multiple team conversations', () => {
      const conv1 = service.getTeamConversationOrCreate('team1', 'Team Alpha');
      const conv2 = service.getTeamConversationOrCreate('team2', 'Team Beta');

      expect(conv1).not.toBe(conv2);
      expect(service.getConversationCount()).toBe(2);
    });
  });

  describe('inherited methods', () => {
    it('should support getConversationById', () => {
      const conversation = service.getConversationOrCreate(
        'test',
        'Test',
        'Test',
      );
      const found = service.getConversationById('test');
      expect(found).toBe(conversation);
    });

    it('should support hasConversation', () => {
      expect(service.hasConversation('non-existent')).toBe(false);
      service.getConversationOrCreate('test', 'Test', 'Test');
      expect(service.hasConversation('test')).toBe(true);
    });

    it('should support removeConversation', () => {
      service.getConversationOrCreate('test', 'Test', 'Test');
      expect(service.hasConversation('test')).toBe(true);

      const result = service.removeConversation('test');
      expect(result).toBe(true);
      expect(service.hasConversation('test')).toBe(false);
    });

    it('should support getAllConversationIds', () => {
      service.getConversationOrCreate('conv1', 'Conv1', 'Desc1');
      service.getConversationOrCreate('conv2', 'Conv2', 'Desc2');

      const ids = service.getAllConversationIds();
      expect(ids).toContain('conv1');
      expect(ids).toContain('conv2');
      expect(ids).toHaveLength(2);
    });

    it('should support getAllConversations', () => {
      const conv1 = service.getConversationOrCreate('conv1', 'Conv1', 'Desc1');
      const conv2 = service.getConversationOrCreate('conv2', 'Conv2', 'Desc2');

      const conversations = service.getAllConversations();
      expect(conversations).toContain(conv1);
      expect(conversations).toContain(conv2);
      expect(conversations).toHaveLength(2);
    });

    it('should support getConversationCount', () => {
      expect(service.getConversationCount()).toBe(0);
      service.getConversationOrCreate('conv1', 'Conv1', 'Desc1');
      expect(service.getConversationCount()).toBe(1);
    });

    it('should support clearAllConversations', () => {
      service.getConversationOrCreate('conv1', 'Conv1', 'Desc1');
      service.getConversationOrCreate('conv2', 'Conv2', 'Desc2');
      expect(service.getConversationCount()).toBe(2);

      service.clearAllConversations();
      expect(service.getConversationCount()).toBe(0);
    });
  });

  describe('mixed conversation types', () => {
    it('should handle both customer support and team conversations', () => {
      const customerConv = service.getCustomerSupportConversationOrCreate(
        'cust-conv',
        'CUST123',
      );
      const teamConv = service.getTeamConversationOrCreate(
        'team-conv',
        'Engineering',
      );

      expect(customerConv).toBeInstanceOf(ConversationListSlackApp);
      expect(teamConv).toBeInstanceOf(ConversationListSlackApp);
      expect(customerConv).not.toBe(teamConv);
      expect(service.getConversationCount()).toBe(2);
    });

    it('should handle regular and specialized conversation creation', () => {
      const regularConv = service.getConversationOrCreate(
        'regular',
        'Regular',
        'Regular Description',
      );
      const customerConv = service.getCustomerSupportConversationOrCreate(
        'customer',
        'CUST456',
      );
      const teamConv = service.getTeamConversationOrCreate(
        'team',
        'Design Team',
      );

      expect(regularConv).toBeInstanceOf(ConversationListSlackApp);
      expect(customerConv).toBeInstanceOf(ConversationListSlackApp);
      expect(teamConv).toBeInstanceOf(ConversationListSlackApp);
      expect(service.getConversationCount()).toBe(3);
    });
  });
});
