import { AbstractConversationListCxGroup } from './AbstractConversationListCxGroup';
import { AbstractConversationListItem } from './AbstractConversationListItem';
import type {
  TConversationListItem,
  TConversationItemAuthorRoles,
} from './types';

// Test implementation extending AbstractConversationList
class TestConversationList extends AbstractConversationListCxGroup<TConversationListItem> {
  constructor(id: string, name: string, description: string) {
    super(id, name, description, new Date(), new Date());
  }
}

// Test implementation extending AbstractConversationListItem
class TestConversationListItem
  extends AbstractConversationListItem
  implements TConversationListItem
{
  constructor(
    id: string,
    authorId: string,
    authorRole: TConversationItemAuthorRoles,
    content: { type: 'text/plain'; payload: string },
    estimatedTokenCount: number = 0,
    roleVisibilities?: TConversationItemAuthorRoles[],
  ) {
    const visibilities =
      roleVisibilities ||
      AbstractConversationListItem.getDefaultVisibilities(authorRole);
    super(
      id,
      authorId,
      authorRole,
      content,
      new Date(),
      new Date(),
      estimatedTokenCount,
      visibilities,
    );
  }
}

describe('AbstractConversationList', () => {
  let conversationList: TestConversationList;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    conversationList = new TestConversationList(
      'test-conv-1',
      'Test Conversation',
      'A test conversation for unit testing',
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should create instance with proper properties', () => {
      expect(conversationList.id).toBe('test-conv-1');
      expect(conversationList.name).toBe('Test Conversation');
      expect(conversationList.description).toBe(
        'A test conversation for unit testing',
      );
    });

    it('should start with zero messages', () => {
      expect(conversationList.getMessageCount()).toBe(0);
    });
  });

  describe('getMostRecentMessage', () => {
    it('should return null when no messages exist', () => {
      expect(conversationList.getMostRecentMessage()).toBeNull();
    });

    it('should return the most recent message', () => {
      const firstMessage = new TestConversationListItem(
        'msg-1',
        'user-1',
        'cx-customer',
        { type: 'text/plain', payload: 'First' },
        10,
      );
      const secondMessage = new TestConversationListItem(
        'msg-2',
        'user-2',
        'cx-agent',
        { type: 'text/plain', payload: 'Second' },
        12,
      );

      conversationList.appendConversationMessage(firstMessage);
      conversationList.appendConversationMessage(secondMessage);

      const mostRecent = conversationList.getMostRecentMessage();
      expect(mostRecent).toBe(secondMessage);
    });
  });

  describe('canInteractWithRobots static method', () => {
    it('should identify roles that can interact with robots', () => {
      expect(
        AbstractConversationListCxGroup.canInteractWithRobots('cx-agent'),
      ).toBe(true);
      expect(
        AbstractConversationListCxGroup.canInteractWithRobots('cx-supervisor'),
      ).toBe(true);
      expect(
        AbstractConversationListCxGroup.canInteractWithRobots(
          'conversation-admin',
        ),
      ).toBe(true);
      expect(
        AbstractConversationListCxGroup.canInteractWithRobots('cx-customer'),
      ).toBe(false);
      expect(
        AbstractConversationListCxGroup.canInteractWithRobots('robot'),
      ).toBe(false);
    });
  });
});
