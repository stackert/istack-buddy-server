# Authentication Module - Action Plan

> **Reference**: See full implementation details in `docs-living/features/11001-authentication-error-logging/00002-authentication.md`

# _VERY_IMPORTANT_

- For the authentication module we will NOT user typeORM. We do our own sql, no models

## Database Setup

- [ ] Create `user_authentication_sessions` table with proper schema
- [ ] Add required indexes for performance
- [ ] Create session management configuration file `config/session-management.json`
- [ ] Create seed users: `all-permissions@example.com` and `no-permissions@example.com`
- [ ] Update database creation script to include authentication table
- [ ] Update database seed script to include users: `all-permissions@example.com` and `no-permissions@example.com`. Assign all permissions to `all-permissions@example.com` through user permissions (not group/membership). This requires `SELECT * FROM ...` and not hard coded permissions.

## Core Authentication Service

- [ ] Create auth module structure (`src/auth/`)
- [ ] Implement `AuthService` with three core methods:
  - [ ] `authenticateUser(userId, jwtToken)` - validates and creates session
  - [ ] `isUserAuthenticated(userId, jwtToken)` - checks session validity
  - [ ] `getUserPermissionSet(userId)` - retrieves cached permissions
- [ ] Add placeholder JWT validation (length > 10 characters with TODO comments)
- [ ] Create authentication interfaces and DTOs
- [ ] Create custom authentication exceptions

## Session Management

- [ ] Implement session creation logic
- [ ] Implement session timeout checking (`SESSION_TIMEOUT_SECONDS`)
- [ ] Add automatic session cleanup for expired sessions
- [ ] Cache permission chains in session records
- [ ] Update `last_access_time` on each validation
- [ ] Update `initial_access_time` on authentication

## Logging Integration

- [ ] Add SESSION_ACTIVATED audit logging
- [ ] Add SESSION_DEACTIVATED audit logging (for timeouts)
- [ ] Integrate with existing CustomLoggerService
- [ ] Log all authentication events with correlation IDs

## Permission System Integration

- [ ] Query existing permission tables for user permissions
- [ ] Query user permission group assignments
- [ ] Combine group and individual permissions
- [ ] Cache permission data in session records
- [ ] Implement permission deduplication logic

## Configuration & Testing

- [ ] Create session management configuration interface
- [ ] Write unit tests for AuthService methods
- [ ] Write integration tests for database operations
- [ ] Write end-to-end tests for authentication flow
- [ ] Test session timeout and cleanup functionality

## Integration & Validation

- [ ] Integrate with existing dev-debug endpoints
- [ ] Test with seed users (`all-permissions@example.com`, `no-permissions@example.com`)
- [ ] Validate audit logging output
- [ ] Verify session cleanup automation
- [ ] Performance test session validation (target: <50ms)

## Documentation Updates

All documentation should be written to `docs-living/features/11001-authentication-error-logging/90100-authentication-concluding-remarks.md`

- [x] Complete implementation plan documentation
- [ ] Document configuration options
- [ ] Create API documentation for AuthService methods
