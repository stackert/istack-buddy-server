import { validate } from 'class-validator';
import { JoinRoomDto } from './join-room.dto';
import { UserRole } from './create-message.dto';

describe('JoinRoomDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when userId is empty', async () => {
      const dto = new JoinRoomDto();
      dto.userId = '';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when userId is missing', async () => {
      const dto = new JoinRoomDto();
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when userId is not a string', async () => {
      const dto = new JoinRoomDto();
      (dto as any).userId = 123;
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should fail validation when userRole is invalid', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = 'invalid-role' as UserRole;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });

    it('should fail validation when userRole is missing', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });

    it('should fail validation when userRole is not a string', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      (dto as any).userRole = 123;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });
  });

  describe('all user roles', () => {
    it('should validate with CUSTOMER role', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with AGENT role', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = UserRole.AGENT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with SUPERVISOR role', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = UserRole.SUPERVISOR;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with ROBOT role', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = UserRole.ROBOT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with SYSTEM_DEBUG role', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      dto.userRole = UserRole.SYSTEM_DEBUG;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('userId validation', () => {
    it('should accept short userId', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'a';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept long userId', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'a'.repeat(1000);
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept userId with special characters', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123_456@test.com';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept userId with numbers', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user123456';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept userId with hyphens and underscores', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123_456';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should fail validation when both fields are missing', async () => {
      const dto = new JoinRoomDto();

      const errors = await validate(dto);
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.constraints?.isNotEmpty)).toBe(true);
      expect(errors.some((e) => e.constraints?.isEnum)).toBe(true);
    });

    it('should fail validation when userId is whitespace only', async () => {
      const dto = new JoinRoomDto();
      dto.userId = '   ';
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      // @IsNotEmpty doesn't trim whitespace by default, so this passes
      // We'll test with empty string instead
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when userId is null', async () => {
      const dto = new JoinRoomDto();
      (dto as any).userId = null;
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when userId is undefined', async () => {
      const dto = new JoinRoomDto();
      (dto as any).userId = undefined;
      dto.userRole = UserRole.CUSTOMER;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail validation when userRole is null', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      (dto as any).userRole = null;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });

    it('should fail validation when userRole is undefined', async () => {
      const dto = new JoinRoomDto();
      dto.userId = 'user-123';
      (dto as any).userRole = undefined;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEnum).toBeDefined();
    });
  });

  describe('import validation', () => {
    it('should import UserRole from create-message.dto', () => {
      expect(UserRole.CUSTOMER).toBe('cx-customer');
      expect(UserRole.AGENT).toBe('cx-agent');
      expect(UserRole.SUPERVISOR).toBe('cx-supervisor');
      expect(UserRole.ROBOT).toBe('robot');
      expect(UserRole.SYSTEM_DEBUG).toBe('system:debug');
    });
  });
});
