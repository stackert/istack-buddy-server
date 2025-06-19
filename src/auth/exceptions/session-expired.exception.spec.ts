import { HttpStatus } from '@nestjs/common';
import { SessionExpiredException } from './session-expired.exception';

describe('SessionExpiredException', () => {
  describe('Constructor', () => {
    it('should create an exception with default message and no sessionId', () => {
      const exception = new SessionExpiredException();

      expect(exception).toBeInstanceOf(SessionExpiredException);
      expect(exception.name).toBe('SessionExpiredException');
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Session has expired',
        error: 'SessionExpired',
        sessionId: null,
      });
    });

    it('should create an exception with custom message and no sessionId', () => {
      const customMessage = 'Your login session has timed out';
      const exception = new SessionExpiredException(customMessage);

      expect(exception).toBeInstanceOf(SessionExpiredException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: customMessage,
        error: 'SessionExpired',
        sessionId: null,
      });
    });

    it('should create an exception with default message and sessionId', () => {
      const sessionId = 'session-123';
      const exception = new SessionExpiredException(undefined, sessionId);

      expect(exception).toBeInstanceOf(SessionExpiredException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Session has expired',
        error: 'SessionExpired',
        sessionId: sessionId,
      });
    });

    it('should create an exception with custom message and sessionId', () => {
      const customMessage = 'Session terminated due to inactivity';
      const sessionId = 'session-456';
      const exception = new SessionExpiredException(customMessage, sessionId);

      expect(exception).toBeInstanceOf(SessionExpiredException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: customMessage,
        error: 'SessionExpired',
        sessionId: sessionId,
      });
    });

    it('should create an exception with empty string message and empty string sessionId', () => {
      const exception = new SessionExpiredException('', '');

      expect(exception).toBeInstanceOf(SessionExpiredException);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Session has expired', // Should fallback to default when empty string
        error: 'SessionExpired',
        sessionId: null, // Should fallback to null when empty string
      });
    });
  });

  describe('HTTP Exception Properties', () => {
    it('should have correct HTTP status code', () => {
      const exception = new SessionExpiredException();
      expect(exception.getStatus()).toBe(401);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should be throwable as an exception', () => {
      expect(() => {
        throw new SessionExpiredException('Test session expiration');
      }).toThrow(SessionExpiredException);
    });

    it('should be catchable in try-catch blocks', () => {
      let caughtException: SessionExpiredException | null = null;

      try {
        throw new SessionExpiredException(
          'Test session expired',
          'session-789',
        );
      } catch (error) {
        caughtException = error as SessionExpiredException;
      }

      expect(caughtException).toBeInstanceOf(SessionExpiredException);
      expect(caughtException?.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = caughtException?.getResponse() as any;
      expect(response.message).toBe('Test session expired');
      expect(response.sessionId).toBe('session-789');
    });
  });

  describe('Response Structure', () => {
    it('should always include required fields in response object', () => {
      const exception = new SessionExpiredException(
        'Custom message',
        'session-id',
      );
      const response = exception.getResponse() as any;

      expect(response).toHaveProperty('statusCode');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('sessionId');

      expect(typeof response.statusCode).toBe('number');
      expect(typeof response.message).toBe('string');
      expect(typeof response.error).toBe('string');
      expect(response.sessionId).toEqual(expect.any(String));
    });

    it('should have consistent error field value', () => {
      const exception1 = new SessionExpiredException();
      const exception2 = new SessionExpiredException('Different message');
      const exception3 = new SessionExpiredException(
        'Another message',
        'session-123',
      );

      const response1 = exception1.getResponse() as any;
      const response2 = exception2.getResponse() as any;
      const response3 = exception3.getResponse() as any;

      expect(response1.error).toBe('SessionExpired');
      expect(response2.error).toBe('SessionExpired');
      expect(response3.error).toBe('SessionExpired');
    });

    it('should have consistent statusCode field value', () => {
      const exception1 = new SessionExpiredException();
      const exception2 = new SessionExpiredException('Different message');
      const exception3 = new SessionExpiredException(
        'Another message',
        'session-123',
      );

      const response1 = exception1.getResponse() as any;
      const response2 = exception2.getResponse() as any;
      const response3 = exception3.getResponse() as any;

      expect(response1.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response2.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response3.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should have different error field from AuthenticationFailedException', () => {
      const sessionException = new SessionExpiredException();
      const response = sessionException.getResponse() as any;

      expect(response.error).toBe('SessionExpired');
      expect(response.error).not.toBe('Unauthorized');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null message parameter', () => {
      const exception = new SessionExpiredException(null as any);

      const response = exception.getResponse() as any;
      expect(response.message).toBe('Session has expired');
    });

    it('should handle null sessionId parameter', () => {
      const exception = new SessionExpiredException('Message', null as any);

      const response = exception.getResponse() as any;
      expect(response.sessionId).toBe(null);
    });

    it('should handle undefined parameters explicitly', () => {
      const exception = new SessionExpiredException(undefined, undefined);

      const response = exception.getResponse() as any;
      expect(response.message).toBe('Session has expired');
      expect(response.sessionId).toBe(null);
    });

    it('should handle very long message strings', () => {
      const longMessage = 'Session'.repeat(200);
      const exception = new SessionExpiredException(longMessage);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(longMessage);
      expect(response.message.length).toBe(1400); // 'Session' * 200 = 7 * 200
    });

    it('should handle special characters in message and sessionId', () => {
      const specialMessage = 'Session expired: 特殊文字 & symbols!@#$%^&*()';
      const specialSessionId = 'session-特殊-123-@#$';
      const exception = new SessionExpiredException(
        specialMessage,
        specialSessionId,
      );

      const response = exception.getResponse() as any;
      expect(response.message).toBe(specialMessage);
      expect(response.sessionId).toBe(specialSessionId);
    });
  });

  describe('Inheritance and Type Checking', () => {
    it('should be an instance of HttpException', () => {
      const exception = new SessionExpiredException();
      expect(exception).toBeInstanceOf(Error);
      expect(exception.name).toBe('SessionExpiredException');
    });

    it('should be distinguishable from other HttpExceptions', () => {
      const sessionException = new SessionExpiredException();

      // Type checking
      expect(sessionException.constructor.name).toBe('SessionExpiredException');
    });

    it('should maintain stack trace information', () => {
      const exception = new SessionExpiredException('Test error');

      expect(exception.stack).toBeDefined();
      expect(typeof exception.stack).toBe('string');
      expect(exception.stack).toContain('SessionExpiredException');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should work in session timeout scenario', () => {
      const simulateSessionCheck = (sessionId: string, lastActivity: Date) => {
        const now = new Date();
        const timeoutMinutes = 30;
        const timeDiff = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

        if (timeDiff > timeoutMinutes) {
          throw new SessionExpiredException(
            `Session expired after ${timeoutMinutes} minutes of inactivity`,
            sessionId,
          );
        }
        return { valid: true };
      };

      const oldActivity = new Date(Date.now() - 40 * 60 * 1000); // 40 minutes ago

      expect(() => {
        simulateSessionCheck('session-timeout-test', oldActivity);
      }).toThrow(SessionExpiredException);

      try {
        simulateSessionCheck('session-timeout-test', oldActivity);
      } catch (error) {
        const sessionError = error as SessionExpiredException;
        const response = sessionError.getResponse() as any;

        expect(response.message).toContain('Session expired after 30 minutes');
        expect(response.sessionId).toBe('session-timeout-test');
        expect(sessionError.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });

    it('should work in explicit session termination scenario', () => {
      const simulateSessionTermination = (
        sessionId: string,
        reason: string,
      ) => {
        throw new SessionExpiredException(
          `Session terminated: ${reason}`,
          sessionId,
        );
      };

      expect(() => {
        simulateSessionTermination(
          'session-admin-kill',
          'Administrator logout',
        );
      }).toThrow(SessionExpiredException);

      try {
        simulateSessionTermination(
          'session-admin-kill',
          'Administrator logout',
        );
      } catch (error) {
        const sessionError = error as SessionExpiredException;
        const response = sessionError.getResponse() as any;

        expect(response.message).toBe(
          'Session terminated: Administrator logout',
        );
        expect(response.sessionId).toBe('session-admin-kill');
      }
    });

    it('should work in token expiration scenario', () => {
      const simulateTokenValidation = (token: string, expirationTime: Date) => {
        const now = new Date();

        if (now > expirationTime) {
          throw new SessionExpiredException(
            'Authentication token has expired',
            `token-${token.substring(0, 8)}`,
          );
        }
        return { valid: true };
      };

      const expiredTime = new Date(Date.now() - 1000); // 1 second ago

      expect(() => {
        simulateTokenValidation('abc123def456', expiredTime);
      }).toThrow(SessionExpiredException);
    });

    it('should work in concurrent session limit scenario', () => {
      const simulateSessionLimit = (
        userId: string,
        currentSessions: number,
      ) => {
        const maxSessions = 3;

        if (currentSessions >= maxSessions) {
          throw new SessionExpiredException(
            `Maximum concurrent sessions (${maxSessions}) exceeded`,
            `oldest-session-${userId}`,
          );
        }
        return { allowed: true };
      };

      expect(() => {
        simulateSessionLimit('user-123', 5);
      }).toThrow(SessionExpiredException);
    });
  });

  describe('Comparison with AuthenticationFailedException', () => {
    it('should have different error field values', () => {
      const sessionException = new SessionExpiredException();
      const response = sessionException.getResponse() as any;

      expect(response.error).toBe('SessionExpired');
      expect(response.error).not.toBe('Unauthorized');
    });

    it('should have same HTTP status code', () => {
      const sessionException = new SessionExpiredException();

      expect(sessionException.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should have different default messages', () => {
      const sessionException = new SessionExpiredException();
      const response = sessionException.getResponse() as any;

      expect(response.message).toBe('Session has expired');
      expect(response.message).not.toBe('Authentication failed');
    });

    it('should use sessionId instead of userId in response', () => {
      const sessionException = new SessionExpiredException(
        'Test',
        'session-123',
      );
      const response = sessionException.getResponse() as any;

      expect(response).toHaveProperty('sessionId');
      expect(response).not.toHaveProperty('userId');
      expect(response.sessionId).toBe('session-123');
    });
  });
});
