import { MessageEntity, ConversationEntity } from './message.entity';
import { UserRole } from '../dto/create-message.dto';

describe('MessageEntity', () => {
  it('should create a message entity with all properties', () => {
    const message = new MessageEntity();
    message.id = 'msg-123';
    message.content = 'Hello world';
    message.conversationId = 'conv-456';
    message.fromUserId = 'user-789';
    message.fromRole = UserRole.USER;
    message.toRole = UserRole.ROBOT;
    message.threadId = 'thread-101';
    message.originalMessageId = 'orig-202';
    message.createdAt = new Date('2023-01-01T00:00:00Z');
    message.updatedAt = new Date('2023-01-01T00:00:00Z');

    expect(message.id).toBe('msg-123');
    expect(message.content).toBe('Hello world');
    expect(message.conversationId).toBe('conv-456');
    expect(message.fromUserId).toBe('user-789');
    expect(message.fromRole).toBe(UserRole.USER);
    expect(message.toRole).toBe(UserRole.ROBOT);
    expect(message.threadId).toBe('thread-101');
    expect(message.originalMessageId).toBe('orig-202');
    expect(message.createdAt).toEqual(new Date('2023-01-01T00:00:00Z'));
    expect(message.updatedAt).toEqual(new Date('2023-01-01T00:00:00Z'));
  });

  it('should create a message entity with minimal properties', () => {
    const message = new MessageEntity();
    message.id = 'msg-123';
    message.content = 'Hello world';
    message.conversationId = 'conv-456';
    message.fromUserId = null;
    message.fromRole = UserRole.SYSTEM;
    message.toRole = UserRole.USER;
    message.createdAt = new Date();
    message.updatedAt = new Date();

    expect(message.id).toBe('msg-123');
    expect(message.content).toBe('Hello world');
    expect(message.conversationId).toBe('conv-456');
    expect(message.fromUserId).toBeNull();
    expect(message.fromRole).toBe(UserRole.SYSTEM);
    expect(message.toRole).toBe(UserRole.USER);
    expect(message.threadId).toBeUndefined();
    expect(message.originalMessageId).toBeUndefined();
    expect(message.createdAt).toBeInstanceOf(Date);
    expect(message.updatedAt).toBeInstanceOf(Date);
  });
});

describe('ConversationEntity', () => {
  it('should create a conversation entity with all properties', () => {
    const conversation = new ConversationEntity();
    conversation.id = 'conv-123';
    conversation.participantIds = ['user-1', 'user-2'];
    conversation.participantRoles = [UserRole.USER, UserRole.ROBOT];
    conversation.messageCount = 5;
    conversation.lastMessageAt = new Date('2023-01-01T00:00:00Z');
    conversation.isActive = true;
    conversation.createdAt = new Date('2023-01-01T00:00:00Z');
    conversation.updatedAt = new Date('2023-01-01T00:00:00Z');

    expect(conversation.id).toBe('conv-123');
    expect(conversation.participantIds).toEqual(['user-1', 'user-2']);
    expect(conversation.participantRoles).toEqual([
      UserRole.USER,
      UserRole.ROBOT,
    ]);
    expect(conversation.messageCount).toBe(5);
    expect(conversation.lastMessageAt).toEqual(
      new Date('2023-01-01T00:00:00Z'),
    );
    expect(conversation.isActive).toBe(true);
    expect(conversation.createdAt).toEqual(new Date('2023-01-01T00:00:00Z'));
    expect(conversation.updatedAt).toEqual(new Date('2023-01-01T00:00:00Z'));
  });

  it('should create a conversation entity with minimal properties', () => {
    const conversation = new ConversationEntity();
    conversation.id = 'conv-123';
    conversation.participantIds = ['user-1'];
    conversation.participantRoles = [UserRole.USER];
    conversation.messageCount = 0;
    conversation.lastMessageAt = new Date();
    conversation.isActive = false;
    conversation.createdAt = new Date();
    conversation.updatedAt = new Date();

    expect(conversation.id).toBe('conv-123');
    expect(conversation.participantIds).toEqual(['user-1']);
    expect(conversation.participantRoles).toEqual([UserRole.USER]);
    expect(conversation.messageCount).toBe(0);
    expect(conversation.lastMessageAt).toBeInstanceOf(Date);
    expect(conversation.isActive).toBe(false);
    expect(conversation.createdAt).toBeInstanceOf(Date);
    expect(conversation.updatedAt).toBeInstanceOf(Date);
  });
});
