import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { AuthorizationPermissionsService } from '../src/authorization-permissions/authorization-permissions.service';

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

describe('Auth User Profile E2E Tests', () => {
  let app: INestApplication;
  let authPermissionsService: AuthorizationPermissionsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authPermissionsService = moduleFixture.get<AuthorizationPermissionsService>(
      AuthorizationPermissionsService,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /user-profiles/me', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 401 when bad JWT token is provided', async () => {
      const badJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bad-token';

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${badJwt}`)
        .expect(401);

      expect(response.body.message).toContain(
        'Invalid or expired authentication token',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      // Create JWT for a user with no permissions
      const testJWT = createTestJWT(
        'user-no-permissions',
        'noperms@example.com',
        'noperms',
        'STUDENT',
      );

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: user:profile:me:view',
      );
    });

    it('should return 403 when user has insufficient permissions', async () => {
      // Create JWT for a user with some permissions but not the required one
      const testJWT = createTestJWT(
        'user2',
        'student@istack.com',
        'student',
        'STUDENT',
      );

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: user:profile:me:view',
      );
    });

    it('should return 403 when user has unknown permission', async () => {
      // Create JWT for a user with unknown permissions
      const testJWT = createTestJWT(
        'user-unknown',
        'unknown@example.com',
        'unknown',
        'STUDENT',
      );

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: user:profile:me:view',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      // Create JWT for admin user who should have sufficient permissions
      const testJWT = createTestJWT(
        'user-1',
        'admin@istack.com',
        'admin',
        'ADMIN',
      );

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId', 'user-1');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('email');
    });

    it('should return 200 when user has multiple permissions including the required one', async () => {
      // Create JWT for admin user who has multiple permissions
      const testJWT = createTestJWT(
        'user-1',
        'admin@istack.com',
        'admin',
        'ADMIN',
      );

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId', 'user-1');
      expect(response.body).toHaveProperty('username', 'admin');
      expect(response.body).toHaveProperty('email', 'admin@istack.com');
    });
  });
});
