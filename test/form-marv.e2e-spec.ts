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
      expect(response.text).toContain('https://the-link.com/marv-form/');
      expect(response.text).toContain('?jwtToken=');
    });
  });

  describe('GET /public/form-marv/:secretKey', () => {
    it('should redirect when jwtToken is provided in query', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key and JWT token from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /https:\/\/the-link\.com\/marv-form\/([^?]+)\?jwtToken=([^"]+)/,
      );

      if (!linkMatch) {
        throw new Error(
          'Could not extract secret key and JWT token from response',
        );
      }

      const [, secretKey, jwtToken] = linkMatch;

      // Test the redirect with JWT token in query
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}?jwtToken=${jwtToken}`)
        .expect(302); // Redirect status

      expect(response.headers.location).toBe(`/public/form-marv/${secretKey}`);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/non-existent-secret-key')
        .expect(404);

      expect(response.text).toBe('Session not found or expired');
    });

    it('should serve content when accessing with valid session', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key and JWT token from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /https:\/\/the-link\.com\/marv-form\/([^?]+)\?jwtToken=([^"]+)/,
      );

      if (!linkMatch) {
        throw new Error(
          'Could not extract secret key and JWT token from response',
        );
      }

      const [, secretKey, jwtToken] = linkMatch;

      // Access the session directly with the JWT token from the session
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}`)
        .expect(200);

      expect(response.text).toContain('Welcome to Forms Marv!');
      expect(response.text).toContain('Your session is active and ready');
    });

    it('should work with valid session even without JWT token in query', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key from the response
      const html = createResponse.text;
      const linkMatch = html.match(
        /https:\/\/the-link\.com\/marv-form\/([^?]+)\?jwtToken=/,
      );

      if (!linkMatch) {
        throw new Error('Could not extract secret key from response');
      }

      const [, secretKey] = linkMatch;

      // Access the session directly (should work because JWT token is stored in session)
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}`)
        .expect(200);

      expect(response.text).toContain('Welcome to Forms Marv!');
      expect(response.text).toContain('Your session is active and ready');
    });
  });

  describe('GET /public/form-marv/:randomkey/:formId (legacy endpoint)', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/random123/form456')
        .expect(401);

      expect(response.body.message).toBe('No authentication token provided');
    });

    it('should return 401 when bad JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/random123/form456')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);

      expect(response.body.message).toBe(
        'Invalid or expired authentication token',
      );
    });
  });
});
