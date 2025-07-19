import { MessageEntity, ConversationEntity } from './message.entity';
import { MessageType, UserRole } from '../dto/create-message.dto';

describe('MessageEntity', () => {
  let messageEntity: MessageEntity;

  beforeEach(() => {
    messageEntity = new MessageEntity();
  });

  describe('Class Structure', () => {
    it('should be instantiable', () => {
      expect(messageEntity).toBeInstanceOf(MessageEntity);
    });

    it('should allow property assignment', () => {
      messageEntity.id = 'msg-123';
      messageEntity.content = 'Test content';
      messageEntity.conversationId = 'conv-123';
      messageEntity.fromUserId = 'user-123';
      messageEntity.fromRole = UserRole.CUSTOMER;
      messageEntity.toRole = UserRole.AGENT;
      messageEntity.messageType = MessageType.TEXT;
      messageEntity.threadId = 'thread-123';
      messageEntity.originalMessageId = 'orig-123';
      messageEntity.createdAt = new Date();
      messageEntity.updatedAt = new Date();

      expect(messageEntity.id).toBe('msg-123');
      expect(messageEntity.content).toBe('Test content');
      expect(messageEntity.conversationId).toBe('conv-123');
      expect(messageEntity.fromUserId).toBe('user-123');
      expect(messageEntity.fromRole).toBe(UserRole.CUSTOMER);
      expect(messageEntity.toRole).toBe(UserRole.AGENT);
      expect(messageEntity.messageType).toBe(MessageType.TEXT);
      expect(messageEntity.threadId).toBe('thread-123');
      expect(messageEntity.originalMessageId).toBe('orig-123');
      expect(messageEntity.createdAt).toBeInstanceOf(Date);
      expect(messageEntity.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Property Assignment', () => {
    it('should allow setting all properties', () => {
      const now = new Date();

      messageEntity.id = 'msg-123';
      messageEntity.content = 'Test message content';
      messageEntity.conversationId = 'conv-123';
      messageEntity.fromUserId = 'user-123';
      messageEntity.fromRole = UserRole.CUSTOMER;
      messageEntity.toRole = UserRole.AGENT;
      messageEntity.messageType = MessageType.TEXT;
      messageEntity.threadId = 'thread-123';
      messageEntity.originalMessageId = 'orig-msg-123';
      messageEntity.createdAt = now;
      messageEntity.updatedAt = now;

      expect(messageEntity.id).toBe('msg-123');
      expect(messageEntity.content).toBe('Test message content');
      expect(messageEntity.conversationId).toBe('conv-123');
      expect(messageEntity.fromUserId).toBe('user-123');
      expect(messageEntity.fromRole).toBe(UserRole.CUSTOMER);
      expect(messageEntity.toRole).toBe(UserRole.AGENT);
      expect(messageEntity.messageType).toBe(MessageType.TEXT);
      expect(messageEntity.threadId).toBe('thread-123');
      expect(messageEntity.originalMessageId).toBe('orig-msg-123');
      expect(messageEntity.createdAt).toBe(now);
      expect(messageEntity.updatedAt).toBe(now);
    });

    it('should allow null fromUserId', () => {
      messageEntity.fromUserId = null;
      expect(messageEntity.fromUserId).toBeNull();
    });

    it('should allow undefined optional properties', () => {
      messageEntity.threadId = undefined;
      messageEntity.originalMessageId = undefined;

      expect(messageEntity.threadId).toBeUndefined();
      expect(messageEntity.originalMessageId).toBeUndefined();
    });
  });

  describe('MessageType Enum', () => {
    it('should accept all MessageType enum values', () => {
      const messageTypes = Object.values(MessageType);

      messageTypes.forEach((messageType) => {
        messageEntity.messageType = messageType;
        expect(messageEntity.messageType).toBe(messageType);
      });
    });
  });

  describe('UserRole Enum', () => {
    it('should accept all UserRole enum values for fromRole', () => {
      const userRoles = Object.values(UserRole);

      userRoles.forEach((role) => {
        messageEntity.fromRole = role;
        expect(messageEntity.fromRole).toBe(role);
      });
    });

    it('should accept all UserRole enum values for toRole', () => {
      const userRoles = Object.values(UserRole);

      userRoles.forEach((role) => {
        messageEntity.toRole = role;
        expect(messageEntity.toRole).toBe(role);
      });
    });
  });

  describe('Date Handling', () => {
    it('should handle Date objects for timestamps', () => {
      const createdAt = new Date('2023-01-01T00:00:00Z');
      const updatedAt = new Date('2023-01-02T00:00:00Z');

      messageEntity.createdAt = createdAt;
      messageEntity.updatedAt = updatedAt;

      expect(messageEntity.createdAt).toBe(createdAt);
      expect(messageEntity.updatedAt).toBe(updatedAt);
    });

    it('should handle different date formats', () => {
      const date1 = new Date();
      const date2 = new Date(Date.now() + 1000);

      messageEntity.createdAt = date1;
      messageEntity.updatedAt = date2;

      expect(messageEntity.createdAt).toBe(date1);
      expect(messageEntity.updatedAt).toBe(date2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      messageEntity.id = '';
      messageEntity.content = '';
      messageEntity.conversationId = '';
      messageEntity.fromUserId = '';
      messageEntity.threadId = '';
      messageEntity.originalMessageId = '';

      expect(messageEntity.id).toBe('');
      expect(messageEntity.content).toBe('');
      expect(messageEntity.conversationId).toBe('');
      expect(messageEntity.fromUserId).toBe('');
      expect(messageEntity.threadId).toBe('');
      expect(messageEntity.originalMessageId).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);

      messageEntity.id = longString;
      messageEntity.content = longString;
      messageEntity.conversationId = longString;

      expect(messageEntity.id).toBe(longString);
      expect(messageEntity.content).toBe(longString);
      expect(messageEntity.conversationId).toBe(longString);
    });

    it('should handle special characters in strings', () => {
      const specialString = 'Test with special chars: !@#$%^&*() 🚀 📚 🌐';

      messageEntity.content = specialString;
      expect(messageEntity.content).toBe(specialString);
    });
  });
});

describe('ConversationEntity', () => {
  let conversationEntity: ConversationEntity;

  beforeEach(() => {
    conversationEntity = new ConversationEntity();
  });

  describe('Class Structure', () => {
    it('should be instantiable', () => {
      expect(conversationEntity).toBeInstanceOf(ConversationEntity);
    });

    it('should allow property assignment', () => {
      conversationEntity.id = 'conv-123';
      conversationEntity.participantIds = ['user-1', 'user-2'];
      conversationEntity.participantRoles = [UserRole.CUSTOMER, UserRole.AGENT];
      conversationEntity.messageCount = 42;
      conversationEntity.lastMessageAt = new Date();
      conversationEntity.isActive = true;
      conversationEntity.createdAt = new Date();
      conversationEntity.updatedAt = new Date();

      expect(conversationEntity.id).toBe('conv-123');
      expect(conversationEntity.participantIds).toEqual(['user-1', 'user-2']);
      expect(conversationEntity.participantRoles).toEqual([
        UserRole.CUSTOMER,
        UserRole.AGENT,
      ]);
      expect(conversationEntity.messageCount).toBe(42);
      expect(conversationEntity.lastMessageAt).toBeInstanceOf(Date);
      expect(conversationEntity.isActive).toBe(true);
      expect(conversationEntity.createdAt).toBeInstanceOf(Date);
      expect(conversationEntity.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Property Assignment', () => {
    it('should allow setting all properties', () => {
      const now = new Date();

      conversationEntity.id = 'conv-123';
      conversationEntity.participantIds = ['user-1', 'user-2', 'user-3'];
      conversationEntity.participantRoles = [
        UserRole.CUSTOMER,
        UserRole.AGENT,
        UserRole.SUPERVISOR,
      ];
      conversationEntity.messageCount = 42;
      conversationEntity.lastMessageAt = now;
      conversationEntity.isActive = true;
      conversationEntity.createdAt = now;
      conversationEntity.updatedAt = now;

      expect(conversationEntity.id).toBe('conv-123');
      expect(conversationEntity.participantIds).toEqual([
        'user-1',
        'user-2',
        'user-3',
      ]);
      expect(conversationEntity.participantRoles).toEqual([
        UserRole.CUSTOMER,
        UserRole.AGENT,
        UserRole.SUPERVISOR,
      ]);
      expect(conversationEntity.messageCount).toBe(42);
      expect(conversationEntity.lastMessageAt).toBe(now);
      expect(conversationEntity.isActive).toBe(true);
      expect(conversationEntity.createdAt).toBe(now);
      expect(conversationEntity.updatedAt).toBe(now);
    });

    it('should handle empty arrays', () => {
      conversationEntity.participantIds = [];
      conversationEntity.participantRoles = [];

      expect(conversationEntity.participantIds).toEqual([]);
      expect(conversationEntity.participantRoles).toEqual([]);
    });

    it('should handle boolean values for isActive', () => {
      conversationEntity.isActive = true;
      expect(conversationEntity.isActive).toBe(true);

      conversationEntity.isActive = false;
      expect(conversationEntity.isActive).toBe(false);
    });

    it('should handle numeric values for messageCount', () => {
      conversationEntity.messageCount = 0;
      expect(conversationEntity.messageCount).toBe(0);

      conversationEntity.messageCount = 1000;
      expect(conversationEntity.messageCount).toBe(1000);

      conversationEntity.messageCount = -1;
      expect(conversationEntity.messageCount).toBe(-1);
    });
  });

  describe('UserRole Array Handling', () => {
    it('should accept arrays with all UserRole enum values', () => {
      const allRoles = Object.values(UserRole);
      conversationEntity.participantRoles = allRoles;
      expect(conversationEntity.participantRoles).toEqual(allRoles);
    });

    it('should handle mixed role arrays', () => {
      const mixedRoles = [UserRole.CUSTOMER, UserRole.AGENT, UserRole.ROBOT];
      conversationEntity.participantRoles = mixedRoles;
      expect(conversationEntity.participantRoles).toEqual(mixedRoles);
    });
  });

  describe('Date Handling', () => {
    it('should handle Date objects for timestamps', () => {
      const createdAt = new Date('2023-01-01T00:00:00Z');
      const updatedAt = new Date('2023-01-02T00:00:00Z');
      const lastMessageAt = new Date('2023-01-03T00:00:00Z');

      conversationEntity.createdAt = createdAt;
      conversationEntity.updatedAt = updatedAt;
      conversationEntity.lastMessageAt = lastMessageAt;

      expect(conversationEntity.createdAt).toBe(createdAt);
      expect(conversationEntity.updatedAt).toBe(updatedAt);
      expect(conversationEntity.lastMessageAt).toBe(lastMessageAt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings for id', () => {
      conversationEntity.id = '';
      expect(conversationEntity.id).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      conversationEntity.id = longString;
      expect(conversationEntity.id).toBe(longString);
    });

    it('should handle special characters in strings', () => {
      const specialString = 'Test with special chars: !@#$%^&*() 🚀 📚 🌐';
      conversationEntity.id = specialString;
      expect(conversationEntity.id).toBe(specialString);
    });

    it('should handle large arrays', () => {
      const largeParticipantIds = Array.from(
        { length: 1000 },
        (_, i) => `user-${i}`,
      );
      const largeParticipantRoles = Array.from(
        { length: 1000 },
        () => UserRole.CUSTOMER,
      );

      conversationEntity.participantIds = largeParticipantIds;
      conversationEntity.participantRoles = largeParticipantRoles;

      expect(conversationEntity.participantIds).toHaveLength(1000);
      expect(conversationEntity.participantRoles).toHaveLength(1000);
    });
  });
});
