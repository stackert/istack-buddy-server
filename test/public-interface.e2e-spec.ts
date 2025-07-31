import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { AuthorizationPermissionsService } from '../src/authorization-permissions/authorization-permissions.service';
import * as cookieParser from 'cookie-parser';

// Helper function to create JWT tokens for testing
function createTestJWT(
  userId: string,
  email: string,
  username: string,
  accountType: string,
): string {
  const payload = {
    userId,
    email,
    username,
    accountType,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
  };
  return jwt.sign(payload, 'istack-buddy-secret-key-2024');
}

describe('Public Interface E2E Tests', () => {
  let app: INestApplication;
  let authPermissionsService: AuthorizationPermissionsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    authPermissionsService = moduleFixture.get<AuthorizationPermissionsService>(
      AuthorizationPermissionsService,
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /public/', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/')
        .expect(401);

      expect(response.body.message).toBe('No authentication token provided');
    });

    it('should return 401 when bad JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);

      expect(response.body.message).toBe(
        'Invalid or expired authentication token',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      // Create a test user with no permissions
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(
        testUserId,
        'noperms@example.com',
        'noperms',
        'STUDENT',
      );

      const response = await request(app.getHttpServer())
        .get('/public/')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: cx-agent:form-marv:read',
      );
    });

    it('should return 200 when user has the required permission', async () => {
      // Create a test user with the required permission
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(
        testUserId,
        ['cx-agent:form-marv:read'],
        [],
      );
      const testJWT = createTestJWT(
        testUserId,
        'withperms@example.com',
        'withperms',
        'STUDENT',
      );

      const response = await request(app.getHttpServer())
        .get('/public/')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.text).toContain('Hello World!');
      expect(response.text).toContain('Welcome to the public interface');
    });
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
        'Your form session has been created successfully.',
      );
      expect(response.text).toContain('Form ID:');
      expect(response.text).toMatch(/Form ID: \d{6}/);
      expect(response.text).toContain('http://');
      expect(response.text).toContain('/public/form-marv/');
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
      const secretKeyMatch = createResponse.text.match(
        /\/public\/form-marv\/([^?]+)/,
      );
      expect(secretKeyMatch).toBeDefined();
      const secretKey = secretKeyMatch![1];

      const jwtTokenMatch = createResponse.text.match(/jwtToken=([^"]+)/);
      expect(jwtTokenMatch).toBeDefined();
      const jwtToken = jwtTokenMatch![1];

      // Follow the link with jwtToken in query
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}?jwtToken=${jwtToken}`)
        .expect(302); // Redirect

      expect(response.headers.location).toMatch(/^\/public\/form-marv\/[^?]+$/);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie']![0]).toContain('jwtToken=');
    });

    it('should serve content when session exists and user is authenticated', async () => {
      // First create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      // Extract the secret key from the response
      const secretKeyMatch = createResponse.text.match(
        /\/public\/form-marv\/([^?]+)/,
      );
      expect(secretKeyMatch).toBeDefined();
      const secretKey = secretKeyMatch![1];

      // Access the session directly (without jwtToken in query)
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}`)
        .expect(200);

      expect(response.text).toContain('Welcome to Forms Marv!');
      expect(response.text).toContain(
        'Your session is active and ready for formId:',
      );
      expect(response.text).toMatch(
        /Your session is active and ready for formId: \d{6}/,
      );
    });

    it('should return 401 when no formId is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/public/form-marv/non-existent-secret-key')
        .expect(401);

      expect(response.text).toBe('Form ID is required in the URL path');
    });

    it('should return 401 when session exists but authentication fails', async () => {
      // Create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      const secretKeyMatch = createResponse.text.match(
        /\/public\/form-marv\/([^?]+)/,
      );
      expect(secretKeyMatch).toBeDefined();
      const secretKey = secretKeyMatch![1];

      // Try to access with an invalid JWT token
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}?jwtToken=invalid-token`)
        .expect(302); // Should redirect first

      // Then access the redirected URL with the invalid token in cookie
      const redirectedResponse = await request(app.getHttpServer())
        .get(response.headers.location!)
        .set('Cookie', response.headers['set-cookie']![0])
        .expect(401);

      expect(redirectedResponse.text).toBe(
        'Invalid or expired authentication token',
      );
    });

    it('should return 401 when accessing session with invalid JWT in cookie', async () => {
      // Create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      const secretKeyMatch = createResponse.text.match(
        /\/public\/form-marv\/([^?]+)/,
      );
      expect(secretKeyMatch).toBeDefined();
      const secretKey = secretKeyMatch![1];

      // Try to access directly with an invalid JWT token in cookie
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}`)
        .set('Cookie', 'jwtToken=invalid-token')
        .expect(401);

      expect(response.text).toBe('Invalid or expired authentication token');
    });

    it('should return 401 when accessing session with malformed JWT in cookie', async () => {
      // Create a session
      const createResponse = await request(app.getHttpServer())
        .get('/public/form-marv/debug-create')
        .expect(200);

      const secretKeyMatch = createResponse.text.match(
        /\/public\/form-marv\/([^?]+)/,
      );
      expect(secretKeyMatch).toBeDefined();
      const secretKey = secretKeyMatch![1];

      // Try to access directly with a malformed JWT token in cookie
      const response = await request(app.getHttpServer())
        .get(`/public/form-marv/${secretKey}`)
        .set(
          'Cookie',
          'jwtToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload',
        )
        .expect(401);

      expect(response.text).toBe('Invalid or expired authentication token');
    });
  });
});
