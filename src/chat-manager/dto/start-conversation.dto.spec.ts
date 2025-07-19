import { validate } from 'class-validator';
import { StartConversationDto } from './start-conversation.dto';
import { UserRole } from './create-message.dto';

describe('StartConversationDto', () => {
  let dto: StartConversationDto;

  beforeEach(() => {
    dto = new StartConversationDto();
  });

  describe('Validation', () => {
    it('should pass validation with valid data', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = 'Test Conversation';
      dto.description = 'Test Description';
      dto.initialParticipants = ['user-1', 'user-2'];

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal required data', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when createdBy is missing', async () => {
      dto.createdByRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('createdBy');
    });

    it('should fail validation when createdBy is empty string', async () => {
      dto.createdBy = '';
      dto.createdByRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('createdBy');
    });

    it('should fail validation when createdByRole is missing', async () => {
      dto.createdBy = 'user-123';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('createdByRole');
    });

    it('should fail validation when createdByRole is invalid', async () => {
      dto.createdBy = 'user-123';
      (dto as any).createdByRole = 'INVALID_ROLE';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('createdByRole');
    });

    it('should pass validation with valid UserRole enum values', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all UserRole enum values', async () => {
      const roles = Object.values(UserRole);

      for (const role of roles) {
        dto.createdBy = 'user-123';
        dto.createdByRole = role;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Optional Fields', () => {
    it('should pass validation when title is provided', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = 'Test Title';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation when title is empty string', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = '';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation when description is provided', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.description = 'Test Description';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation when description is empty string', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.description = '';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation when initialParticipants is provided', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.initialParticipants = ['user-1', 'user-2', 'user-3'];

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation when initialParticipants is empty array', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.initialParticipants = [];

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when initialParticipants contains non-string values', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      (dto as any).initialParticipants = ['user-1', 123, 'user-3'];

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('initialParticipants');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all optional fields being undefined', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = undefined;
      dto.description = undefined;
      dto.initialParticipants = undefined;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(1000);
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = longString;
      dto.description = longString;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle special characters in strings', async () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = 'Test Title with special chars: !@#$%^&*()';
      dto.description = 'Description with emojis: 🚀 📚 🌐';
      dto.initialParticipants = ['user-1', 'user-2'];

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Class Structure', () => {
    it('should be instantiable', () => {
      expect(dto).toBeInstanceOf(StartConversationDto);
    });

    it('should allow property assignment', () => {
      dto.createdBy = 'user-123';
      dto.createdByRole = UserRole.CUSTOMER;
      dto.title = 'Test Title';
      dto.description = 'Test Description';
      dto.initialParticipants = ['user-1', 'user-2'];

      expect(dto.createdBy).toBe('user-123');
      expect(dto.createdByRole).toBe(UserRole.CUSTOMER);
      expect(dto.title).toBe('Test Title');
      expect(dto.description).toBe('Test Description');
      expect(dto.initialParticipants).toEqual(['user-1', 'user-2']);
    });
  });
});
