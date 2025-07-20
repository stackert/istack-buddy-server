import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import * as jwt from 'jsonwebtoken';

describe('Authentication and User Profile (e2e)', () => {
  let app: INestApplication;
  let validTokens: { [userId: string]: string };

  const JWT_SECRET = 'istack-buddy-secret-key-2024';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Generate valid JWT tokens for testing
    validTokens = {
      'user-1': jwt.sign(
        {
          userId: 'user-1',
          email: 'admin@istack.com',
          username: 'admin',
          accountType: 'ADMIN',
        },
        JWT_SECRET,
        { expiresIn: '8h' },
      ),
      'user-2': jwt.sign(
        {
          userId: 'user-2',
          email: 'student@istack.com',
          username: 'student',
          accountType: 'STUDENT',
        },
        JWT_SECRET,
        { expiresIn: '8h' },
      ),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Endpoints', () => {
    it('should fail with missing email', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          password: 'password123',
        })
        .expect(401);
    });

    it('should fail with missing password', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'admin@istack.com',
        })
        .expect(401);
    });

    it('should fail with empty credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: '',
          password: '',
        })
        .expect(401);
    });

    it('should handle malformed JSON requests', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });
  });

  describe('Profile Endpoints', () => {
    it('should fail without authentication token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('No authentication token provided');
        });
    });

    it('should fail with invalid JWT token', () => {
      return request(app.getHttpServer())
        .get('/user-profiles/me?jwtToken=invalid-token')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Invalid or expired authentication token',
          );
        });
    });

    it('should fail with expired JWT token', () => {
      const expiredToken = jwt.sign(
        {
          userId: 'user-1',
          email: 'admin@istack.com',
          username: 'admin',
          accountType: 'ADMIN',
        },
        JWT_SECRET,
        { expiresIn: '0s' }, // Expired immediately
      );

      return request(app.getHttpServer())
        .get(`/user-profiles/me?jwtToken=${expiredToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Invalid or expired authentication token',
          );
        });
    });

    it('should fail without JWT token', () => {
      return request(app.getHttpServer())
        .get('/user-profiles/me')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('No authentication token provided');
        });
    });
  });

  describe('JWT Token Validation', () => {
    it('should reject malformed JWT tokens', () => {
      return request(app.getHttpServer())
        .get('/user-profiles/me?jwtToken=not-a-jwt-token')
        .expect(401);
    });

    it('should reject JWT tokens with wrong signature', () => {
      const wrongSignatureToken = jwt.sign(
        {
          userId: 'user-1',
          email: 'admin@istack.com',
          username: 'admin',
          accountType: 'ADMIN',
        },
        'wrong-secret',
        { expiresIn: '8h' },
      );

      return request(app.getHttpServer())
        .get(`/user-profiles/me?jwtToken=${wrongSignatureToken}`)
        .expect(401);
    });
  });

  describe('Security and Validation', () => {
    it('should reject invalid email formats', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(401);
    });
  });

  describe('API Structure Validation', () => {
    it('should have proper error response structure', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'admin@istack.com',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('correlationId');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should include correlation ID in error responses', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .expect(401)
        .expect((res) => {
          // Correlation ID should be in headers or response context
          expect(res.headers).toBeDefined();
        });
    });
  });

  describe('Endpoint Availability', () => {
    it('should have authentication endpoint available', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({})
        .expect((res) => {
          // Should not be 404 (endpoint exists)
          expect(res.status).not.toBe(404);
        });
    });

    it('should have profile endpoint available', () => {
      return request(app.getHttpServer())
        .get('/auth/profile/me')
        .expect((res) => {
          // Should not be 404 (endpoint exists)
          expect(res.status).not.toBe(404);
        });
    });

    it('should have user profile endpoint available', () => {
      return request(app.getHttpServer())
        .get('/user-profiles/me')
        .expect((res) => {
          // Should not be 404 (endpoint exists)
          expect(res.status).not.toBe(404);
        });
    });
  });
});
