import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('Authentication User Endpoint (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser()); // Add cookie parser middleware
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/user', () => {
    it('should authenticate user with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'all-permissions@example.com',
          password: 'any-password',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('jwtToken');
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty(
            'email',
            'all-permissions@example.com',
          );
          expect(res.body).toHaveProperty('permissions');
          expect(Array.isArray(res.body.permissions)).toBe(true);
          expect(res.headers['set-cookie']).toBeDefined();
          expect(res.headers['set-cookie'][0]).toContain('auth-token=');
          expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'invalid@example.com',
          password: 'wrong-password',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/auth/user');
          expect(res.body).toHaveProperty('method', 'POST');
          expect(res.body).toHaveProperty('correlationId');
        });
    });

    it('should return 401 for missing email', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          password: 'any-password',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Missing email or password');
        });
    });

    it('should return 401 for missing password', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'test@example.com',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Missing email or password');
        });
    });

    it('should return 401 for invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'invalid-email',
          password: 'any-password',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Authentication failed');
        });
    });

    it('should return 401 for empty request body', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({})
        .expect(401);
    });

    it('should handle malformed JSON gracefully', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should not include correlation ID in successful response body', () => {
      return request(app.getHttpServer())
        .post('/auth/user')
        .send({
          email: 'all-permissions@example.com',
          password: 'any-password',
        })
        .expect(200)
        .expect((res) => {
          // Successful responses don't include correlationId in body
          expect(res.body).not.toHaveProperty('correlationId');
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('jwtToken');
        });
    });
  });
});
