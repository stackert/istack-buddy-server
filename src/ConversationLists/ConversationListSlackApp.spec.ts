import {
  ConversationListSlackApp,
  ConversationListItem,
  ConversationListFactory,
  ConversationMessageFactory,
} from './ConversationListSlackApp';
import type { TConversationItemAuthorRoles } from './types';

describe('ConversationListItem', () => {
  const testDate = new Date('2024-01-01T00:00:00.000Z');
  const testContent = { type: 'text/plain' as const, payload: 'Test message' };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(testDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create a conversation list item with all properties', () => {
    const item = new ConversationListItem(
      'msg-1',
      'user-1',
      'cx-customer',
      testContent,
      testDate,
      testDate,
      50,
      ['cx-customer', 'cx-agent'],
    );

    expect(item.id).toBe('msg-1');
    expect(item.authorId).toBe('user-1');
    expect(item.authorRole).toBe('cx-customer');
    expect(item.content).toEqual(testContent);
    expect(item.estimatedTokenCount).toBe(50);
    expect(item.roleVisibilities).toEqual(['cx-customer', 'cx-agent']);
  });
});

describe('ConversationMessageFactory', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createMessage', () => {
    it('should create a message with default visibilities', () => {
      const message = ConversationMessageFactory.createMessage(
        'msg-1',
        'user-1',
        'cx-customer',
        { type: 'text/plain', payload: 'Hello' },
        25,
      );

      expect(message.id).toBe('msg-1');
      expect(message.authorId).toBe('user-1');
      expect(message.authorRole).toBe('cx-customer');
      expect(message.estimatedTokenCount).toBe(25);
      expect(message.roleVisibilities).toEqual([
        'cx-customer',
        'cx-agent',
        'cx-supervisor',
        'conversation-admin',
      ]);
    });

    it('should create a message with custom visibilities', () => {
      const customVisibilities: TConversationItemAuthorRoles[] = [
        'cx-agent',
        'cx-supervisor',
      ];
      const message = ConversationMessageFactory.createMessage(
        'msg-1',
        'user-1',
        'cx-customer',
        { type: 'text/plain', payload: 'Hello' },
        25,
        customVisibilities,
      );

      expect(message.roleVisibilities).toEqual(customVisibilities);
    });
  });

  describe('createCustomerMessage', () => {
    it('should create a customer message with proper defaults', () => {
      const message = ConversationMessageFactory.createCustomerMessage(
        'msg-1',
        'customer-1',
        'Hello, I need help',
        30,
      );

      expect(message.authorRole).toBe('cx-customer');
      expect(message.content.type).toBe('text/plain');
      expect(message.content.payload).toBe('Hello, I need help');
      expect(message.estimatedTokenCount).toBe(30);
    });
  });

  describe('createAgentMessage', () => {
    it('should create an agent message with proper defaults', () => {
      const message = ConversationMessageFactory.createAgentMessage(
        'msg-1',
        'agent-1',
        'How can I help you?',
        20,
      );

      expect(message.authorRole).toBe('cx-agent');
      expect(message.content.type).toBe('text/plain');
      expect(message.content.payload).toBe('How can I help you?');
      expect(message.estimatedTokenCount).toBe(20);
    });
  });

  describe('createRobotMessage', () => {
    it('should create a robot message with proper defaults', () => {
      const content = {
        type: 'application/json' as const,
        payload: { answer: 'AI response' },
      };
      const message = ConversationMessageFactory.createRobotMessage(
        'msg-1',
        'robot-1',
        content,
        100,
      );

      expect(message.authorRole).toBe('robot');
      expect(message.content).toEqual(content);
      expect(message.estimatedTokenCount).toBe(100);
      expect(message.roleVisibilities).toEqual([
        'cx-agent',
        'cx-supervisor',
        'conversation-admin',
      ]);
    });
  });

  describe('createSharedRobotMessage', () => {
    it('should create a shared robot message visible to customers', () => {
      const content = {
        type: 'text/plain' as const,
        payload: 'AI response for customer',
      };
      const message = ConversationMessageFactory.createSharedRobotMessage(
        'msg-1',
        'robot-1',
        content,
        80,
      );

      expect(message.authorRole).toBe('cx-robot');
      expect(message.content).toEqual(content);
      expect(message.roleVisibilities).toEqual([
        'cx-customer',
        'cx-agent',
        'cx-supervisor',
        'conversation-admin',
      ]);
    });
  });

  describe('createSupervisorMessage', () => {
    it('should create a supervisor message with limited visibility', () => {
      const message = ConversationMessageFactory.createSupervisorMessage(
        'msg-1',
        'supervisor-1',
        'Internal note',
        15,
      );

      expect(message.authorRole).toBe('cx-supervisor');
      expect(message.content.payload).toBe('Internal note');
      expect(message.roleVisibilities).toEqual([
        'cx-supervisor',
        'conversation-admin',
      ]);
    });
  });

  describe('createSharedVersionOfRobotMessage', () => {
    it('should create a shared version of a robot message', () => {
      const originalRobotMessage =
        ConversationMessageFactory.createRobotMessage(
          'original-msg',
          'robot-1',
          { type: 'text/plain', payload: 'Original robot response' },
          50,
        );

      const sharedMessage =
        ConversationMessageFactory.createSharedVersionOfRobotMessage(
          originalRobotMessage,
          'shared-msg-1',
        );

      expect(sharedMessage.id).toBe('shared-msg-1');
      expect(sharedMessage.authorRole).toBe('cx-robot');
      expect(sharedMessage.content).toEqual(originalRobotMessage.content);
      expect(sharedMessage.roleVisibilities).toEqual([
        'cx-customer',
        'cx-agent',
        'cx-supervisor',
        'conversation-admin',
      ]);
    });

    it('should throw error when trying to share non-robot message', () => {
      const agentMessage = ConversationMessageFactory.createAgentMessage(
        'agent-msg',
        'agent-1',
        'Agent message',
        20,
      );

      expect(() => {
        ConversationMessageFactory.createSharedVersionOfRobotMessage(
          agentMessage,
          'shared-msg-1',
        );
      }).toThrow('Can only share robot messages');
    });
  });
});

describe('ConversationList', () => {
  let conversationList: ConversationListSlackApp;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    conversationList = new ConversationListSlackApp(
      'conv-1',
      'Test Conversation',
      'A test conversation',
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a conversation list with proper properties', () => {
      expect(conversationList.id).toBe('conv-1');
      expect(conversationList.name).toBe('Test Conversation');
      expect(conversationList.description).toBe('A test conversation');
      expect(conversationList.getMessageCount()).toBe(0);
    });
  });

  describe('addMessage', () => {
    it('should add a pre-created message to the conversation', () => {
      const message = ConversationMessageFactory.createCustomerMessage(
        'msg-1',
        'customer-1',
        'Hello',
        10,
      );

      const addedMessage = conversationList.addMessage(message);

      expect(addedMessage).toBe(message);
      expect(conversationList.getMessageCount()).toBe(1);
    });
    it('addMessage will be the message returned by getMostRecentMessage', () => {
      const message = ConversationMessageFactory.createCustomerMessage(
        'msg-1',
        'customer-1',
        'Hello',
        10,
      );

      const addedMessage = conversationList.addMessage(message);
      const mostRecentMessage = conversationList.getMostRecentMessage();
      expect(mostRecentMessage).toStrictEqual(addedMessage);
      // expect(addedMessage).toBe(message);
      // expect(conversationList.getMessageCount()).toBe(1);
    });
  });

  describe('convenience methods for adding messages', () => {
    it('should add agent message', () => {
      const message = conversationList.addAgentMessage(
        'msg-1',
        'agent-1',
        'Agent message',
        12,
      );

      expect(message.authorRole).toBe('cx-agent');
      expect(message.content.payload).toBe('Agent message');
      expect(conversationList.getMessageCount()).toBe(1);
    });

    it('should add robot message', () => {
      const content = {
        type: 'text/plain' as const,
        payload: 'Robot response',
      };
      const message = conversationList.addRobotMessage(
        'msg-1',
        'robot-1',
        content,
        25,
      );

      expect(message.authorRole).toBe('robot');
      expect(message.content).toEqual(content);
      expect(conversationList.getMessageCount()).toBe(1);
    });
  });

  describe('getMostRecentMessage', () => {
    it('should return null when no messages exist', () => {
      expect(conversationList.getMostRecentMessage()).toBeNull();
    });
  });

  describe('summarization functionality', () => {
    beforeEach(() => {
      conversationList.addAgentMessage(
        'msg-2',
        'agent-1',
        'Second message',
        12,
      );
      conversationList.addRobotMessage(
        'msg-3',
        'robot-1',
        { type: 'text/plain', payload: 'Third message' },
        15,
      );
    });

    it('should get messages to summarize when none have been summarized', () => {
      const toSummarize = conversationList.getMessagesToSummarize();
      expect(toSummarize).toHaveLength(3);
    });

    it('should track summarization progress', () => {
      expect(conversationList.getLastSummarizedIndex()).toBe(-1);
      expect(conversationList.getLastSummarizedAt()).toBeNull();

      conversationList.markSummarizedUpTo(1);
      expect(conversationList.getLastSummarizedIndex()).toBe(1);
      expect(conversationList.getLastSummarizedAt()).toBeInstanceOf(Date);

      const remaining = conversationList.getMessagesToSummarize();
      expect(remaining).toHaveLength(1); // Only the last message
    });

    it('should mark all messages as summarized', () => {
      conversationList.markAllAsSummarized();
      expect(conversationList.getLastSummarizedIndex()).toBe(2); // 3 messages, index 2 is last
      expect(conversationList.getMessagesToSummarize()).toHaveLength(0);
    });
  });

  describe('role-based filtering', () => {
    beforeEach(() => {
      // Add various types of messages
      conversationList.addAgentMessage('msg-2', 'agent-1', 'Agent message', 12);
      conversationList.addRobotMessage(
        'msg-3',
        'robot-1',
        { type: 'text/plain', payload: 'Robot message' },
        15,
      );
    });

    it('should filter messages for agent role', () => {
      const agentMessages = conversationList.getAgentVisibleMessages();
      expect(agentMessages).toHaveLength(4); // customer, agent, robot, shared robot
      expect(agentMessages.map((m) => m.authorRole)).toEqual([
        'cx-customer',
        'cx-agent',
        'robot',
        'cx-robot',
      ]);
    });
  });

  describe('robot processing methods', () => {
    beforeEach(() => {
      conversationList.addAgentMessage('msg-2', 'agent-1', 'Agent message', 12);
      conversationList.addRobotMessage(
        'msg-3',
        'robot-1',
        { type: 'text/plain', payload: 'Robot message' },
        15,
      );
    });

    it('should get messages for robot processing', () => {
      const robotMessages = conversationList.getMessagesForRobotProcessing();
      expect(robotMessages).toHaveLength(3); // agent, robot, and supervisor messages
      expect(robotMessages.map((m) => m.authorRole)).toEqual([
        'cx-agent',
        'robot',
        'cx-supervisor',
      ]);
    });

    it('should calculate total token count for robot processing', () => {
      const totalTokens = conversationList.calculateTotalTokenCountForRobot();
      expect(totalTokens).toBe(35); // 12 (agent) + 15 (robot) + 8 (supervisor)
    });

    it('should get robot messages only', () => {
      const robotMessages = conversationList.getRobotMessages();
      expect(robotMessages).toHaveLength(1);
      expect(robotMessages[0].authorRole).toBe('robot');
    });
  });
});

describe('ConversationListFactory', () => {
  it('should create a conversation', () => {
    const conversation = ConversationListFactory.createConversation(
      'conv-1',
      'Test Conversation',
      'Test description',
    );

    expect(conversation.id).toBe('conv-1');
    expect(conversation.name).toBe('Test Conversation');
    expect(conversation.description).toBe('Test description');
  });

  it('should create a customer support conversation', () => {
    const conversation =
      ConversationListFactory.createCustomerSupportConversation(
        'conv-1',
        'customer-123',
      );

    expect(conversation.id).toBe('conv-1');
    expect(conversation.name).toBe('Customer Support - customer-123');
    expect(conversation.description).toBe(
      'Customer support conversation for customer customer-123',
    );
  });
});
