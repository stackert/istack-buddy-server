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

  describe('GET /public/form-marv/:secretKey/debug-session', () => {
    it('should return session data for existing session', async () => {
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

      const [, secretKey, formId] = linkMatch;

      // Test the debug endpoint
      const debugResponse = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/debug-session`)
        .expect(200);

      expect(debugResponse.body).toHaveProperty('secretKey', secretKey);
      expect(debugResponse.body).toHaveProperty('sessionData');
      expect(debugResponse.body).toHaveProperty('timestamp');
      expect(debugResponse.body).toHaveProperty('note');

      const sessionData = debugResponse.body.sessionData;
      expect(sessionData).toHaveProperty('secretKey', secretKey);
      expect(sessionData).toHaveProperty('formId', formId);
      expect(sessionData).toHaveProperty('userId');
      expect(sessionData).toHaveProperty('jwtToken');
      expect(sessionData).toHaveProperty('createdAt');
      expect(sessionData).toHaveProperty('lastActivityAt');
      expect(sessionData).toHaveProperty('expiresInMs');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/non-existent-key/debug-session')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Session not found');
      expect(response.body).toHaveProperty('secretKey', 'non-existent-key');
      expect(response.body).toHaveProperty('message');
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

      // First visit with JWT token to set the cookie (should redirect)
      const redirectResponse = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/${formId}?jwtToken=${jwtToken}`)
        .expect(302);

      // Extract the cookie from the Set-Cookie header
      const setCookieHeader = redirectResponse.headers['set-cookie'];
      if (!setCookieHeader || !setCookieHeader[0]) {
        throw new Error('No cookie was set in the redirect response');
      }

      // Extract just the cookie value for jwtToken
      const cookieValue = setCookieHeader[0].split(';')[0]; // e.g., "jwtToken=..."

      // Then access the session directly with the cookie
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/${formId}`)
        .set('Cookie', cookieValue)
        .expect(200);

      expect(response.text).toContain('Welcome to Forms Marv!');
      expect(response.text).toContain('Your session is active and ready');
    });

    it('should return 401 for non-existent session (guard blocks unauthenticated access)', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/non-existent-secret-key/non-existent-form-id')
        .expect(401);

      expect(response.body.message).toBe('No authentication token provided');
    });

    it('should return 401 for wrong formId (guard blocks unauthenticated access)', async () => {
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

      // Access with wrong formId (should be blocked by guard due to no authentication)
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}/wrong-form-id`)
        .expect(401);

      expect(response.body.message).toBe('No authentication token provided');
    });
  });
});
