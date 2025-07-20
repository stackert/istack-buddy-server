import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthorizationPermissionsService } from '../src/authorization-permissions/authorization-permissions.service';

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

  afterEach(() => {
    // Clear test users after each test
    authPermissionsService.clearTestUsers();
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
      const testUser = authPermissionsService.createTestUserWithPermissions([]);

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testUser.jwt}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: user:profile:me:view',
      );
    });

    it('should return 403 when user has insufficient permissions', async () => {
      // User has some permissions but not the required one
      const testUser = authPermissionsService.createTestUserWithPermissions([
        'user:profile:edit',
        'user:profile:delete',
      ]);

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testUser.jwt}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: user:profile:me:view',
      );
    });

    it('should return 403 when user has unknown permission', async () => {
      // User has a permission that doesn't exist in the system
      const testUser = authPermissionsService.createTestUserWithPermissions([
        'unknown:permission:that:does:not:exist',
      ]);

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testUser.jwt}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: user:profile:me:view',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      // User has the required permission
      const testUser = authPermissionsService.createTestUserWithPermissions([
        'user:profile:me:view',
      ]);

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testUser.jwt}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId', testUser.userId);
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('email');
    });

    it('should return 200 when user has multiple permissions including the required one', async () => {
      // User has multiple permissions including the required one
      const testUser = authPermissionsService.createTestUserWithPermissions([
        'user:profile:me:view',
        'user:profile:edit',
        'user:profile:delete',
      ]);

      const response = await request(app.getHttpServer())
        .get('/user-profiles/me')
        .set('Authorization', `Bearer ${testUser.jwt}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId', testUser.userId);
    });
  });
});
