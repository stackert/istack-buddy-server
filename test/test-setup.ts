import * as fs from 'fs';
import * as path from 'path';

// Mock user profiles for testing
const mockUserProfiles = {
  users: {
    'user-1': {
      id: 'user-1',
      email: 'admin@istack.com',
      username: 'admin',
      first_name: 'Admin',
      last_name: 'User',
      account_type_informal: 'ADMIN',
      current_account_status: 'ACTIVE',
      is_email_verified: true,
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-15T10:30:00Z',
    },
    'user-2': {
      id: 'user-2',
      email: 'student@istack.com',
      username: 'student',
      first_name: 'Student',
      last_name: 'User',
      account_type_informal: 'STUDENT',
      current_account_status: 'ACTIVE',
      is_email_verified: true,
      created_at: '2024-01-02T00:00:00Z',
      last_login: '2024-01-15T09:15:00Z',
    },
    'user-3': {
      id: 'user-3',
      email: 'instructor@istack.com',
      username: 'instructor',
      first_name: 'Instructor',
      last_name: 'User',
      account_type_informal: 'INSTRUCTOR',
      current_account_status: 'ACTIVE',
      is_email_verified: true,
      created_at: '2024-01-03T00:00:00Z',
      last_login: '2024-01-15T08:45:00Z',
    },
    'user-4': {
      id: 'user-4',
      email: 'developer@istack.com',
      username: 'developer',
      first_name: 'Developer',
      last_name: 'User',
      account_type_informal: 'DEVELOPER',
      current_account_status: 'ACTIVE',
      is_email_verified: true,
      created_at: '2024-01-04T00:00:00Z',
      last_login: '2024-01-15T11:20:00Z',
    },
  },
};

// Mock user permissions for testing
const mockUserPermissions = {
  user_permissions: {
    'user-1': {
      permissions: [
        'admin:debug',
        'auth:user',
        'auth:user:{self}',
        'chat:conversations:create',
        'chat:conversations:read',
        'chat:conversations:update',
        'chat:conversations:delete',
        'chat:dashboard:stats',
        'external-service:slacky:events',
        'user-profile:read',
        'user-profile:update',
      ],
      jwtToken: 'mock-jwt-token-user-1',
    },
    'user-2': {
      permissions: [
        'auth:user',
        'auth:user:{self}',
        'chat:conversations:create',
        'chat:conversations:read',
        'user-profile:read',
        'user-profile:update',
      ],
      jwtToken: 'mock-jwt-token-user-2',
    },
    'user-3': {
      permissions: [
        'auth:user',
        'auth:user:{self}',
        'chat:conversations:create',
        'chat:conversations:read',
        'chat:conversations:update',
        'chat:conversations:delete',
        'chat:dashboard:stats',
        'user-profile:read',
        'user-profile:update',
      ],
      jwtToken: 'mock-jwt-token-user-3',
    },
    'user-4': {
      permissions: [
        'auth:user',
        'auth:user:{self}',
        'chat:conversations:create',
        'chat:conversations:read',
        'external-service:slacky:events',
        'user-profile:read',
        'user-profile:update',
      ],
      jwtToken: 'mock-jwt-token-user-4',
    },
  },
};

// Create test files if they don't exist
export function setupTestFiles() {
  const testDir = path.join(process.cwd(), 'test');
  const srcDir = path.join(process.cwd(), 'src');

  // Create test user profiles
  const userProfilesPath = path.join(
    srcDir,
    'user-profile',
    'user-profiles.json',
  );
  if (!fs.existsSync(userProfilesPath)) {
    fs.writeFileSync(
      userProfilesPath,
      JSON.stringify(mockUserProfiles, null, 2),
    );
  }

  // Create test user permissions
  const userPermissionsPath = path.join(
    srcDir,
    'authorization-permissions',
    'user-permissions.json',
  );
  if (!fs.existsSync(userPermissionsPath)) {
    fs.writeFileSync(
      userPermissionsPath,
      JSON.stringify(mockUserPermissions, null, 2),
    );
  }
}

// Clean up test files
export function cleanupTestFiles() {
  // Optionally clean up test files after tests
  // This is optional as the files are needed for the application to work
}
