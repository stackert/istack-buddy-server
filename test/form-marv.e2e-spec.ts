import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Form Marv E2E Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /public/form-marv', () => {
    it('should return 404 for root form-marv endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv')
        .expect(404);

      expect(response.text).toBe('Not Found');
    });
  });

  describe('GET /public/form-marv/debug-create', () => {
    it('should create a session and return HTML with link', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      expect(response.text).toContain('Thank you!');
      expect(response.text).toContain(
        'Your form session has been created successfully',
      );
      expect(response.text).toContain('/public/form-marv/');
      expect(response.text).toContain('?jwtToken=');
    });
  });

  describe('GET /public/form-marv/:secretKey', () => {
    it('should return 401 when formId is not provided', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /\/public\/form-marv\/([^\/]+)\/([^?]+)\?jwtToken=/,
      );

      if (!linkMatch) {
        throw new Error('Could not extract secret key from response');
      }

      const [, secretKey] = linkMatch;

      // Test accessing without formId should return 401
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}`)
        .expect(401);

      expect(response.text).toBe('Form ID is required in the URL path');
    });

    it('should return 401 for any path without formId', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/non-existent-secret-key')
        .expect(401);

      expect(response.text).toBe('Form ID is required in the URL path');
    });
  });

  describe('GET /public/form-marv/:secretKey/:formId', () => {
    it('should redirect when jwtToken is provided in query', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key, formId, and JWT token from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /\/public\/form-marv\/([^\/]+)\/([^?]+)\?jwtToken=([^"]+)/,
      );

      if (!linkMatch) {
        throw new Error(
          'Could not extract secret key, formId, and JWT token from response',
        );
      }

      const [, secretKey, formId, jwtToken] = linkMatch;

      // Test the redirect with JWT token in query
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/${formId}?jwtToken=${jwtToken}`)
        .expect(302); // Redirect status

      expect(response.headers.location).toBe(
        `/public/form-marv/${secretKey}/${formId}`,
      );
    });

    it('should serve content when accessing with valid session', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key, formId, and JWT token from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /\/public\/form-marv\/([^\/]+)\/([^?]+)\?jwtToken=([^"]+)/,
      );

      if (!linkMatch) {
        throw new Error(
          'Could not extract secret key, formId, and JWT token from response',
        );
      }

      const [, secretKey, formId, jwtToken] = linkMatch;

      // First visit with JWT token to set the cookie
      await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/${formId}?jwtToken=${jwtToken}`)
        .expect(302);

      // Then access the session directly (should work because JWT token is stored in cookie)
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/${formId}`)
        .expect(200);

      expect(response.text).toContain('Welcome to Forms Marv!');
      expect(response.text).toContain('Your session is active and ready');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/non-existent-secret-key/non-existent-form-id')
        .expect(404);

      expect(response.text).toBe('Session not found or expired');
    });

    it('should return 401 for wrong formId', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /\/public\/form-marv\/([^\/]+)\/([^?]+)\?jwtToken=/,
      );

      if (!linkMatch) {
        throw new Error('Could not extract secret key from response');
      }

      const [, secretKey] = linkMatch;

      // Access with wrong formId
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/wrong-form-id`)
        .expect(401);

      expect(response.text).toBe('Invalid form ID for this session');
    });
  });
});
