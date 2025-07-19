import { validate } from 'class-validator';
import { CreateMessageDto, MessageType, UserRole } from './create-message.dto';

describe('CreateMessageDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message content';
      dto.conversationId = 'conv-123';
      dto.fromUserId = 'user-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;
      dto.messageType = MessageType.TEXT;
      dto.threadId = 'thread-123';
      dto.originalMessageId = 'msg-123';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal required fields', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when content is empty', async () => {
      const dto = new CreateMessageDto();
      dto.content = '';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when content is missing', async () => {
      const dto = new CreateMessageDto();
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when conversationId is empty', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = '';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when conversationId is missing', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when fromRole is invalid', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = 'invalid-role' as UserRole;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });

    it('should fail validation when toRole is invalid', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = 'invalid-role' as UserRole;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });

    it('should fail validation when messageType is invalid', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;
      dto.messageType = 'invalid-type' as MessageType;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });
  });

  describe('MessageType enum', () => {
    it('should have correct enum values', () => {
      expect(MessageType.TEXT).toBe('text');
      expect(MessageType.SYSTEM).toBe('system');
      expect(MessageType.ROBOT).toBe('robot');
    });
  });

  describe('UserRole enum', () => {
    it('should have correct enum values', () => {
      expect(UserRole.CUSTOMER).toBe('cx-customer');
      expect(UserRole.AGENT).toBe('cx-agent');
      expect(UserRole.SUPERVISOR).toBe('cx-supervisor');
      expect(UserRole.ROBOT).toBe('robot');
      expect(UserRole.SYSTEM_DEBUG).toBe('system:debug');
    });
  });

  describe('default values', () => {
    it('should have default messageType as TEXT', () => {
      const dto = new CreateMessageDto();
      expect(dto.messageType).toBe(MessageType.TEXT);
    });

    it('should allow null fromUserId', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromUserId = null;
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow optional fields to be undefined', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;
      // fromUserId, messageType, threadId, originalMessageId are undefined

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('all user roles', () => {
    it('should validate with CUSTOMER role', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with AGENT role', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.AGENT;
      dto.toRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with SUPERVISOR role', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.SUPERVISOR;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with ROBOT role', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.ROBOT;
      dto.toRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with SYSTEM_DEBUG role', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.SYSTEM_DEBUG;
      dto.toRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('all message types', () => {
    it('should validate with TEXT message type', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Test message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.CUSTOMER;
      dto.toRole = UserRole.AGENT;
      dto.messageType = MessageType.TEXT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with SYSTEM message type', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'System message';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.SYSTEM_DEBUG;
      dto.toRole = UserRole.AGENT;
      dto.messageType = MessageType.SYSTEM;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with ROBOT message type', async () => {
      const dto = new CreateMessageDto();
      dto.content = 'Robot response';
      dto.conversationId = 'conv-123';
      dto.fromRole = UserRole.ROBOT;
      dto.toRole = UserRole.CUSTOMER;
      dto.messageType = MessageType.ROBOT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
