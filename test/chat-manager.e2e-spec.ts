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

describe('Chat Manager E2E Tests', () => {
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

  describe('POST /chat/messages', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .send({ content: 'test message', userId: 'test-user' })
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 401 when bad JWT token is provided', async () => {
      const badJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bad-token';

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${badJwt}`)
        .send({ content: 'test message', userId: 'test-user' })
        .expect(401);

      expect(response.body.message).toContain(
        'Invalid or expired authentication token',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ content: 'test message', userId: 'test-user' })
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:message:create',
      );
    });

    it('should return 403 when user has insufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:read', 'chat:conversations:message:read'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ content: 'test message', userId: 'test-user' })
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:message:create',
      );
    });

    it('should return 201 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:message:create'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ content: 'test message', userId: 'test-user' })
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /chat/conversations', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/conversations')
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:read',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:read'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /chat/conversations/:conversationId/messages', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages')
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:message:read',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:message:read'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /chat/conversations/:conversationId/messages/last/:count', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages/last/5')
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages/last/5')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:message:read',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:message:read'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages/last/5')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /chat/conversations/:conversationId/join', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/join')
        .send({ userId: 'test-user' })
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/join')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ userId: 'test-user' })
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:update',
      );
    });

    it('should return 500 when conversation does not exist (but authorization passes)', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:update'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/join')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ userId: 'test-user' })
        .expect(500);

      // The 500 error indicates that authorization passed but the conversation doesn't exist
      // This is expected behavior in a test environment
      expect(response.body.message).toBe('Internal server error');
    });
  });

  describe('GET /chat/conversations/:conversationId/participants', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/participants')
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/participants')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:read',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:read'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/participants')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /chat/dashboard/stats', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/dashboard/stats')
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/dashboard/stats')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:dashboard:stats',
      );
    });

    it('should return 200 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:dashboard:stats'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/dashboard/stats')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /chat/conversations/start', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/conversations/start')
        .send({ participants: ['user1', 'user2'] })
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/conversations/start')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ participants: ['user1', 'user2'] })
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:create',
      );
    });

    it('should return 201 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:create'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/conversations/start')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ participants: ['user1', 'user2'] })
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /chat/conversations/:conversationId/leave', () => {
    it('should return 401 when no JWT token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/leave')
        .send({ userId: 'test-user' })
        .expect(401);

      expect(response.body.message).toContain(
        'No authentication token provided',
      );
    });

    it('should return 403 when user has no permissions', async () => {
      const testUserId = 'test-user-no-perms';
      authPermissionsService.addUser(testUserId, [], []);
      const testJWT = createTestJWT(testUserId, 'noperms@example.com', 'noperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/leave')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ userId: 'test-user' })
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:conversations:update',
      );
    });

    it('should return 201 when user has good JWT and sufficient permissions', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:update'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/leave')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ userId: 'test-user' })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();
      expect(response.body.conversationId).toBe('test-conversation');
      expect(response.body.userId).toBe('test-user');
    });
  });

  describe('Multiple Permission Scenarios', () => {
    it('should allow user with multiple chat permissions to access multiple endpoints', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:read', 'chat:conversations:message:read', 'chat:conversations:message:create', 'chat:conversations:update'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      // Test conversations read
      const conversationsResponse = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(conversationsResponse.body).toBeDefined();

      // Test messages read
      const messagesResponse = await request(app.getHttpServer())
        .get('/chat/conversations/test-conversation/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(messagesResponse.body).toBeDefined();

      // Test message creation
      const createMessageResponse = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ content: 'test message', userId: 'test-user' })
        .expect(201);

      expect(createMessageResponse.body).toBeDefined();

      // Test conversation update (join) - will fail with 500 because conversation doesn't exist
      // but authorization passes, which is what we're testing
      const joinResponse = await request(app.getHttpServer())
        .post('/chat/conversations/test-conversation/join')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ userId: 'test-user' })
        .expect(500);

      expect(joinResponse.body.message).toBe('Internal server error');
    });

    it('should deny access to dashboard stats when user lacks specific permission', async () => {
      const testUserId = 'test-user-with-perms';
      authPermissionsService.addUser(testUserId, ['chat:conversations:read', 'chat:conversations:message:read', 'chat:conversations:message:create'], []);
      const testJWT = createTestJWT(testUserId, 'withperms@example.com', 'withperms', 'STUDENT');

      const response = await request(app.getHttpServer())
        .get('/chat/dashboard/stats')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.message).toContain(
        'Access denied. Required permissions: chat:dashboard:stats',
      );
    });
  });
});
