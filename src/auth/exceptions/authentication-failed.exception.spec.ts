import { HttpStatus } from '@nestjs/common';
import { AuthenticationFailedException } from './authentication-failed.exception';

describe('AuthenticationFailedException', () => {
  describe('Constructor', () => {
    it('should create an exception with default message and no userId', () => {
      const exception = new AuthenticationFailedException();

      expect(exception).toBeInstanceOf(AuthenticationFailedException);
      expect(exception.name).toBe('AuthenticationFailedException');
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed',
        error: 'Unauthorized',
        userId: null,
      });
    });

    it('should create an exception with custom message and no userId', () => {
      const customMessage = 'Invalid credentials provided';
      const exception = new AuthenticationFailedException(customMessage);

      expect(exception).toBeInstanceOf(AuthenticationFailedException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: customMessage,
        error: 'Unauthorized',
        userId: null,
      });
    });

    it('should create an exception with default message and userId', () => {
      const userId = 'user-123';
      const exception = new AuthenticationFailedException(undefined, userId);

      expect(exception).toBeInstanceOf(AuthenticationFailedException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed',
        error: 'Unauthorized',
        userId: userId,
      });
    });

    it('should create an exception with custom message and userId', () => {
      const customMessage = 'Account locked due to multiple failed attempts';
      const userId = 'user-456';
      const exception = new AuthenticationFailedException(
        customMessage,
        userId,
      );

      expect(exception).toBeInstanceOf(AuthenticationFailedException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: customMessage,
        error: 'Unauthorized',
        userId: userId,
      });
    });

    it('should create an exception with empty string message and empty string userId', () => {
      const exception = new AuthenticationFailedException('', '');

      expect(exception).toBeInstanceOf(AuthenticationFailedException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed', // Should fallback to default when empty string
        error: 'Unauthorized',
        userId: null, // Should fallback to null when empty string
      });
    });
  });

  describe('HTTP Exception Properties', () => {
    it('should have correct HTTP status code', () => {
      const exception = new AuthenticationFailedException();
      expect(exception.getStatus()).toBe(401);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should be throwable as an exception', () => {
      expect(() => {
        throw new AuthenticationFailedException('Test authentication failure');
      }).toThrow(AuthenticationFailedException);
    });

    it('should be catchable in try-catch blocks', () => {
      let caughtException: AuthenticationFailedException | null = null;

      try {
        throw new AuthenticationFailedException('Test exception', 'user-789');
      } catch (error) {
        caughtException = error as AuthenticationFailedException;
      }

      expect(caughtException).toBeInstanceOf(AuthenticationFailedException);
      expect(caughtException?.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = caughtException?.getResponse() as any;
      expect(response.message).toBe('Test exception');
      expect(response.userId).toBe('user-789');
    });
  });

  describe('Response Structure', () => {
    it('should always include required fields in response object', () => {
      const exception = new AuthenticationFailedException(
        'Custom message',
        'user-id',
      );
      const response = exception.getResponse() as any;

      expect(response).toHaveProperty('statusCode');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('userId');

      expect(typeof response.statusCode).toBe('number');
      expect(typeof response.message).toBe('string');
      expect(typeof response.error).toBe('string');
      expect(response.userId).toEqual(expect.any(String));
    });

    it('should have consistent error field value', () => {
      const exception1 = new AuthenticationFailedException();
      const exception2 = new AuthenticationFailedException('Different message');
      const exception3 = new AuthenticationFailedException(
        'Another message',
        'user-123',
      );

      const response1 = exception1.getResponse() as any;
      const response2 = exception2.getResponse() as any;
      const response3 = exception3.getResponse() as any;

      expect(response1.error).toBe('Unauthorized');
      expect(response2.error).toBe('Unauthorized');
      expect(response3.error).toBe('Unauthorized');
    });

    it('should have consistent statusCode field value', () => {
      const exception1 = new AuthenticationFailedException();
      const exception2 = new AuthenticationFailedException('Different message');
      const exception3 = new AuthenticationFailedException(
        'Another message',
        'user-123',
      );

      const response1 = exception1.getResponse() as any;
      const response2 = exception2.getResponse() as any;
      const response3 = exception3.getResponse() as any;

      expect(response1.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response2.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response3.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null message parameter', () => {
      const exception = new AuthenticationFailedException(null as any);

      const response = exception.getResponse() as any;
      expect(response.message).toBe('Authentication failed');
    });

    it('should handle null userId parameter', () => {
      const exception = new AuthenticationFailedException(
        'Message',
        null as any,
      );

      const response = exception.getResponse() as any;
      expect(response.userId).toBe(null);
    });

    it('should handle undefined parameters explicitly', () => {
      const exception = new AuthenticationFailedException(undefined, undefined);

      const response = exception.getResponse() as any;
      expect(response.message).toBe('Authentication failed');
      expect(response.userId).toBe(null);
    });

    it('should handle very long message strings', () => {
      const longMessage = 'A'.repeat(1000);
      const exception = new AuthenticationFailedException(longMessage);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(longMessage);
      expect(response.message.length).toBe(1000);
    });

    it('should handle special characters in message and userId', () => {
      const specialMessage =
        'Authentication failed: 特殊文字 & symbols!@#$%^&*()';
      const specialUserId = 'user-特殊-123-@#$';
      const exception = new AuthenticationFailedException(
        specialMessage,
        specialUserId,
      );

      const response = exception.getResponse() as any;
      expect(response.message).toBe(specialMessage);
      expect(response.userId).toBe(specialUserId);
    });
  });

  describe('Inheritance and Type Checking', () => {
    it('should be an instance of HttpException', () => {
      const exception = new AuthenticationFailedException();
      expect(exception).toBeInstanceOf(Error);
      expect(exception.name).toBe('AuthenticationFailedException');
    });

    it('should be distinguishable from other HttpExceptions', () => {
      const authException = new AuthenticationFailedException();

      // Type checking
      expect(authException.constructor.name).toBe(
        'AuthenticationFailedException',
      );
    });

    it('should maintain stack trace information', () => {
      const exception = new AuthenticationFailedException('Test error');

      expect(exception.stack).toBeDefined();
      expect(typeof exception.stack).toBe('string');
      expect(exception.stack).toContain('AuthenticationFailedException');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should work in authentication failure scenario', () => {
      const simulateAuthFailure = (email: string, password: string) => {
        if (email !== 'valid@example.com' || password !== 'validpassword') {
          throw new AuthenticationFailedException(
            'Invalid email or password',
            'user-attempt-123',
          );
        }
        return { success: true };
      };

      expect(() => {
        simulateAuthFailure('invalid@example.com', 'wrongpassword');
      }).toThrow(AuthenticationFailedException);

      try {
        simulateAuthFailure('invalid@example.com', 'wrongpassword');
      } catch (error) {
        const authError = error as AuthenticationFailedException;
        const response = authError.getResponse() as any;

        expect(response.message).toBe('Invalid email or password');
        expect(response.userId).toBe('user-attempt-123');
        expect(authError.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });

    it('should work in account lockout scenario', () => {
      const simulateAccountLockout = (userId: string) => {
        throw new AuthenticationFailedException(
          'Account has been locked due to multiple failed login attempts',
          userId,
        );
      };

      expect(() => {
        simulateAccountLockout('locked-user-456');
      }).toThrow(AuthenticationFailedException);
    });

    it('should work in token validation failure scenario', () => {
      const simulateTokenValidation = (token: string) => {
        if (!token || token === 'invalid-token') {
          throw new AuthenticationFailedException(
            'Invalid or malformed authentication token',
          );
        }
        return { valid: true };
      };

      expect(() => {
        simulateTokenValidation('invalid-token');
      }).toThrow(AuthenticationFailedException);
    });
  });
});
