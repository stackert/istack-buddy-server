// ========================================
// SECURITY: Load ONLY .env.jest (contains FAKE keys)
// NEVER load .env.live (contains real keys)
// ========================================

// Load .env.jest which contains FAKE keys for testing
require('dotenv').config({ path: '.env.jest' });

// Global Jest setup for performance optimizations

// Set longer timeout for slow tests
jest.setTimeout(10000);

// Console setup - let individual tests mock console if needed
// Don't globally mock console to avoid interfering with tests that expect console.log calls

// Global mocks for common modules that slow down tests (AFTER environment loading)
jest.mock('fs', () => ({
  readFileSync: jest.fn((filePath) => {
    // Provide default mock responses for common config files
    if (filePath.includes('session-management.json')) {
      return JSON.stringify({
        sessionTimeoutSeconds: 28800,
        sessionCleanupIntervalMinutes: 30,
      });
    }
    if (filePath.includes('database.json')) {
      return JSON.stringify({
        development: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      });
    }
    if (filePath.includes('user-permissions.json')) {
      return JSON.stringify({
        user_permissions: {
          'user-1': {
            permissions: [
              'user:profile:me:view',
              'auth:user',
              'auth:user:{self}',
            ],
            jwtToken:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJlbWFpbCI6ImFkbWluQGlzdGFjay5jb20iLCJ1c2VybmFtZSI6ImFkbWluIiwiYWNjb3VudFR5cGUiOiJBRE1JTiIsImlhdCI6MTc1MzAxMTQ0NCwiZXhwIjoxNzUzMDQwMjQ0fQ.kdr-ymMRdEQIniGwR915TTpsqD_wSdX2mutNYk87fyY',
          },
          'user-2': {
            permissions: [],
            jwtToken:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTIiLCJlbWFpbCI6InN0dWRlbnRAaXN0YWNrLmNvbSIsInVzZXJuYW1lIjoic3R1ZGVudCIsImFjY291bnRUeXBlIjoiU1RVREVOVCIsImlhdCI6MTc1MzAxMTQ0NCwiZXhwIjoxNzUzMDQwMjQ0fQ._3FpdkUV3GQn1qrEclxRDxy4oY0zYXHoNPnggk58Oss',
          },
        },
      });
    }
    if (filePath.includes('user-profiles.json')) {
      return JSON.stringify({
        users: {
          'user-1': {
            id: 'user-1',
            email: 'all-permissions@example.com',
            username: 'admin',
            account_type_informal: 'ADMIN',
            first_name: 'Admin',
            last_name: 'User',
          },
          'user-2': {
            id: 'user-2',
            email: 'no-permissions@example.com',
            username: 'student',
            account_type_informal: 'STUDENT',
            first_name: 'Student',
            last_name: 'User',
          },
        },
      });
    }
    // Mock responses for public content files
    if (filePath.includes('hello-world.html')) {
      return '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n    <p>Welcome to the public interface.</p>\n</body>\n</html>';
    }
    if (filePath.includes('hello-from-marv.html')) {
      return '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Hello from Marv</title>\n</head>\n<body>\n    <h1>Hello from Marv!</h1>\n    <p>This is the form-marv interface.</p>\n</body>\n</html>';
    }
    // For other files, throw an error (which individual tests can override)
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  }),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
}));

// Mock pg module globally - but preserve DatabaseError
jest.mock('pg', () => {
  const originalPg = jest.requireActual('pg');
  return {
    ...originalPg,
    Client: jest.fn(() => ({
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    })),
    Pool: jest.fn(() => ({
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    })),
  };
});

// Performance optimization: Clear all mocks before each test
// But don't restore mocks since individual tests may need to override global mocks
beforeEach(() => {
  jest.clearAllMocks();
});
