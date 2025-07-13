// Load environment variables from .env files for tests
const path = require('path');
const fs = require('fs');

// Try multiple dotenv loading strategies BEFORE mocking fs
console.log('🔧 Jest setup: Loading environment variables...');

// First, try loading .env.jest
const envJestPath = path.resolve(__dirname, '.env.jest');
if (fs.existsSync(envJestPath)) {
  console.log('📁 Loading .env.jest file...');
  require('dotenv').config({ path: envJestPath });
}

// Then try the main .env file
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('📁 Loading .env file...');
  require('dotenv').config({ path: envPath });
}

// Fallback: Set environment variables directly if dotenv failed
if (!process.env.ANTHROPIC_API_KEY) {
  console.log('🔧 Setting ANTHROPIC_API_KEY directly...');
  process.env.ANTHROPIC_API_KEY =
    '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';
}

// Debug: Show what we have
console.log('🔍 Environment check:');
console.log(
  `  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`,
);
console.log(
  `  CORE_FORMS_API_V2_KEY: ${process.env.CORE_FORMS_API_V2_KEY ? 'SET' : 'NOT SET'}`,
);

// Ensure critical environment variables are set for tests
if (
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY === '_FAKE_KEY_'
) {
  console.warn('⚠️  ANTHROPIC_API_KEY not properly set for tests');
}

if (!process.env.CORE_FORMS_API_V2_KEY) {
  console.warn('⚠️  CORE_FORMS_API_V2_KEY not set for tests');
}

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
