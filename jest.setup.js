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
