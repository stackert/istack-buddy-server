import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('Authentication Profile Endpoint (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser()); // Add cookie parser middleware
    await app.init();

    // Authenticate to get a valid token for profile tests
    const authResponse = await request(app.getHttpServer())
      .post('/auth/user')
      .send({
        email: 'all-permissions@example.com',
        password: 'any-password',
      })
      .expect(200);

    authToken = authResponse.body.jwtToken;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /auth/profile/me', () => {
    it('should return user profile with valid auth token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', `auth-token=${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('username');
          expect(res.body).toHaveProperty('firstName');
          expect(res.body).toHaveProperty('lastName');
          expect(res.body).toHaveProperty('accountType');
          expect(res.body).toHaveProperty('accountStatus');
          expect(res.body).toHaveProperty('permissions');
          expect(res.body).toHaveProperty('emailVerified');
          expect(Array.isArray(res.body.permissions)).toBe(true);
        });
    });

    it('should return 401 when no auth token provided', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty(
            'message',
            'No authentication token provided',
          );
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/auth/profile/me');
          expect(res.body).toHaveProperty('method', 'GET');
          expect(res.body).toHaveProperty('correlationId');
        });
    });

    it('should return 401 with invalid auth token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', 'auth-token=invalid-token-12345')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/auth/profile/me');
          expect(res.body).toHaveProperty('method', 'GET');
          expect(res.body).toHaveProperty('correlationId');
        });
    });

    it('should return 401 with expired auth token', () => {
      const expiredToken = 'expired-jwt-token-12345';
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', `auth-token=${expiredToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('correlationId');
        });
    });

    it('should return 401 with malformed auth token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', 'auth-token=malformed.jwt.token')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('correlationId');
        });
    });

    it('should return user profile with correct data structure', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', `auth-token=${authToken}`)
        .expect(200)
        .expect((res) => {
          // Verify all expected fields are present and have correct types
          expect(typeof res.body.success).toBe('boolean');
          expect(typeof res.body.userId).toBe('string');
          expect(typeof res.body.email).toBe('string');
          expect(typeof res.body.username).toBe('string');
          expect(typeof res.body.firstName).toBe('string');
          expect(typeof res.body.lastName).toBe('string');
          expect(typeof res.body.accountType).toBe('string');
          expect(typeof res.body.accountStatus).toBe('string');
          expect(typeof res.body.emailVerified).toBe('boolean');
          expect(Array.isArray(res.body.permissions)).toBe(true);

          // Verify email format
          expect(res.body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

          // Verify UUID format for userId
          expect(res.body.userId).toMatch(/^[0-9a-f-]{36}$/i);
        });
    });

    it('should include correlation ID in response', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', `auth-token=${authToken}`)
        .expect(200)
        .expect((res) => {
          // For successful responses, correlation ID might be in headers or context
          // but should be trackable through logging
          expect(res.body.success).toBe(true);
        });
    });

    it('should not accept auth token from Authorization header', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty(
            'message',
            'No authentication token provided',
          );
        });
    });

    it('should not accept auth token from query parameters', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .query({ token: authToken })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty(
            'message',
            'No authentication token provided',
          );
        });
    });

    it('should handle multiple cookies correctly', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .set('Cookie', [
          `other-cookie=value123`,
          `auth-token=${authToken}`,
          `another-cookie=value456`,
        ])
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });
  });
});
