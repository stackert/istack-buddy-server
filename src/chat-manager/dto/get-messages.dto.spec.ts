import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { GetMessagesDto } from './get-messages.dto';

describe('GetMessagesDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new GetMessagesDto();
      dto.limit = 25;
      dto.offset = 10;
      dto.threadId = 'thread-123';
      dto.userId = 'user-123';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal data', async () => {
      const dto = new GetMessagesDto();
      // All fields are optional, so empty DTO should be valid

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when not provided', () => {
      const dto = new GetMessagesDto();
      expect(dto.limit).toBe(50);
      expect(dto.offset).toBe(0);
    });

    it('should fail validation when limit is less than 1', async () => {
      const dto = new GetMessagesDto();
      dto.limit = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.min).toBeDefined();
    });

    it('should fail validation when limit is greater than 100', async () => {
      const dto = new GetMessagesDto();
      dto.limit = 101;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.max).toBeDefined();
    });

    it('should fail validation when limit is not a number', async () => {
      const dto = new GetMessagesDto();
      (dto as any).limit = 'not-a-number';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNumber).toBeDefined();
    });

    it('should fail validation when offset is less than 0', async () => {
      const dto = new GetMessagesDto();
      dto.offset = -1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.min).toBeDefined();
    });

    it('should fail validation when offset is not a number', async () => {
      const dto = new GetMessagesDto();
      (dto as any).offset = 'not-a-number';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNumber).toBeDefined();
    });

    it('should fail validation when threadId is not a string', async () => {
      const dto = new GetMessagesDto();
      (dto as any).threadId = 123;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should fail validation when userId is not a string', async () => {
      const dto = new GetMessagesDto();
      (dto as any).userId = 123;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isString).toBeDefined();
    });
  });

  describe('transformation', () => {
    it('should transform string limit to number', () => {
      const plainObject = {
        limit: '25',
        offset: '10',
        threadId: 'thread-123',
        userId: 'user-123',
      };

      const dto = plainToClass(GetMessagesDto, plainObject);
      expect(dto.limit).toBe(25);
      expect(dto.offset).toBe(10);
      expect(dto.threadId).toBe('thread-123');
      expect(dto.userId).toBe('user-123');
    });

    it('should transform string offset to number', () => {
      const plainObject = {
        offset: '5',
      };

      const dto = plainToClass(GetMessagesDto, plainObject);
      expect(dto.offset).toBe(5);
    });

    it('should handle invalid string numbers gracefully', () => {
      const plainObject = {
        limit: 'invalid',
        offset: 'invalid',
      };

      const dto = plainToClass(GetMessagesDto, plainObject);
      expect(isNaN(dto.limit!)).toBe(true);
      expect(isNaN(dto.offset!)).toBe(true);
    });

    it('should use default values when transformation fails', () => {
      const plainObject = {};

      const dto = plainToClass(GetMessagesDto, plainObject);
      expect(dto.limit).toBe(50);
      expect(dto.offset).toBe(0);
    });
  });

  describe('boundary values', () => {
    it('should accept limit of 1', async () => {
      const dto = new GetMessagesDto();
      dto.limit = 1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept limit of 100', async () => {
      const dto = new GetMessagesDto();
      dto.limit = 100;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept offset of 0', async () => {
      const dto = new GetMessagesDto();
      dto.offset = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept large offset values', async () => {
      const dto = new GetMessagesDto();
      dto.offset = 1000;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('optional fields', () => {
    it('should allow all fields to be undefined', async () => {
      const dto = new GetMessagesDto();
      dto.limit = undefined;
      dto.offset = undefined;
      dto.threadId = undefined;
      dto.userId = undefined;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow only limit to be set', async () => {
      const dto = new GetMessagesDto();
      dto.limit = 20;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow only offset to be set', async () => {
      const dto = new GetMessagesDto();
      dto.offset = 15;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow only threadId to be set', async () => {
      const dto = new GetMessagesDto();
      dto.threadId = 'thread-456';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow only userId to be set', async () => {
      const dto = new GetMessagesDto();
      dto.userId = 'user-789';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('string field validation', () => {
    it('should accept empty string for threadId', async () => {
      const dto = new GetMessagesDto();
      dto.threadId = '';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty string for userId', async () => {
      const dto = new GetMessagesDto();
      dto.userId = '';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept long strings', async () => {
      const dto = new GetMessagesDto();
      dto.threadId = 'a'.repeat(1000);
      dto.userId = 'b'.repeat(1000);

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept special characters in strings', async () => {
      const dto = new GetMessagesDto();
      dto.threadId = 'thread-123_456@test.com';
      dto.userId = 'user-123_456@test.com';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
