# User Authentication Implementation Plan

## Overview

This document outlines the implementation plan for the User Authentication system in the iStack Buddy application. The authentication system is designed as a service-only module (no controller) that provides session management, user verification, and permission resolution capabilities. It will use restrictive writes, the ONLY update allowed is last_access_time. The ONLY insert is when creating/authenticating the user. The ONLY delete is when a session times out. This is no way "user management". We need to keep this as LITE AS POSSIBLE.

## Core Requirements

### Authentication Service Interface

The authentication service will provide the following primary methods:

- **`authenticateUser(userId: string, jwtToken: string)`**: Validates credentials and creates an active session
- **`isUserAuthenticated(userId: string, jwtToken: string)`**: Verifies if a user session is valid and active
- **`getUserPermissionSet(userId: string)`**: Retrieves user's effective permissions (combined group and individual permissions)

### Design Constraints

**Read-Only User Operations**: The authentication service will NOT provide:

- Create user functionality
- Update user functionality
- Remove user functionality

All user data operations remain external to the authentication system. The service operates in a read-only mode for user data, with internal session management updates only.

## Database Schema

### Authentication Sessions Table

A new table `user_authentication_sessions` will store active authentication sessions:

```sql
CREATE TABLE user_authentication_sessions (
    -- Primary identification
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session data
    jwt_token character varying NOT NULL,

    -- Permission caching (for performance)
    group_permission_chain jsonb NOT NULL DEFAULT '[]',
    user_permission_chain jsonb NOT NULL DEFAULT '[]',
    group_memberships jsonb NOT NULL DEFAULT '[]',

    -- Session timing
    initial_access_time timestamptz NOT NULL DEFAULT now(),
    last_access_time timestamptz NOT NULL DEFAULT now(),

    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    PRIMARY KEY (id),
    UNIQUE (user_id, jwt_token)
);

-- Indexes for performance
CREATE INDEX idx_user_auth_sessions_user_id ON user_authentication_sessions(user_id);
CREATE INDEX idx_user_auth_sessions_last_access ON user_authentication_sessions(last_access_time);
CREATE INDEX idx_user_auth_sessions_jwt_token ON user_authentication_sessions(jwt_token);
```

### Session Cleanup

Sessions will be automatically cleaned up based on:

- **SESSION_TIMEOUT_SECONDS**: Configurable timeout period (default: 8 hours)
- **Cleanup Logic**: Sessions where `(now() - last_access_time) > SESSION_TIMEOUT_SECONDS` are considered expired

## Implementation Plan

### Phase 1: Core Authentication Service

#### 1.1 Create Authentication Module Structure

```
src/auth/
├── auth.module.ts
├── auth.service.ts
├── auth.service.spec.ts
├── interfaces/
│   ├── auth-session.interface.ts
│   └── auth-result.interface.ts
├── dto/
│   ├── authenticate-user.dto.ts
│   └── user-permissions.dto.ts
└── exceptions/
    ├── authentication-failed.exception.ts
    └── session-expired.exception.ts
```

#### 1.2 Service Implementation

**authenticateUser Method**:

```typescript
async authenticateUser(userId: string, jwtToken: string): Promise<AuthenticationResult> {
  // TODO: Implement proper JWT validation
  // Current implementation: Accept any token with length > 10 characters

  // 1. Validate JWT token (placeholder validation)
  // 2. Verify user exists in database
  // 3. Create/update authentication session record
  // 4. Cache user permissions
  // 5. Log SESSION_ACTIVATED event
  // 6. Return success result
}
```

**isUserAuthenticated Method**:

```typescript
async isUserAuthenticated(userId: string, jwtToken: string): Promise<boolean> {
  // 1. Find active session for user/token combination
  // 2. Check if session is within timeout period
  // 3. Update last_access_time if valid
  // 4. Remove expired sessions and log SESSION_DEACTIVATED
  // 5. Return authentication status
}
```

**getUserPermissionSet Method**:

```typescript
async getUserPermissionSet(userId: string): Promise<string[]> {
  // 1. Retrieve cached permissions from active session
  // 2. If no active session, fetch from database
  // 3. Combine group permissions and individual permissions
  // 4. Return deduplicated permission array
}
```

### Phase 2: Session Management

#### 2.1 Session Lifecycle Management

- **Session Creation**: On successful authentication
- **Session Updates**: Update `last_access_time` on each validation
- **Session Cleanup**: Automatic removal of expired sessions
- **Session Termination**: Explicit logout functionality (future enhancement)

#### 2.2 Permission Caching Strategy

- **Cache Population**: Populate permission chains during authentication
- **Cache Invalidation**: Regenerate on permission changes (future enhancement)
- **Performance Optimization**: Avoid repeated database queries for permission resolution

### Phase 3: Security Implementation

#### 3.1 Token Validation (Placeholder)

**Current Implementation** (Development Phase):

```typescript
// TODO: Replace with proper JWT validation
private isValidToken(token: string): boolean {
  return token && token.length > 10;
}
```

**Future Implementation** (Production Phase):

- JWT signature verification
- Token expiration validation
- Issuer verification
- Audience validation

#### 3.2 Session Security

- **Unique Constraints**: Prevent duplicate sessions for same user. THERE WILL NEVER BE DUPLICATE USER RECORDS.
- **Automatic Cleanup**: Remove expired sessions to prevent accumulation
- **Audit Logging**: All authentication events logged for security monitoring

### Phase 4: Integration with Existing System

#### 4.1 Database Integration

- **Migration Script**: Create authentication sessions table
- **Seed Data**: The only seed data is for user creation. Need to create a user with email address of `all-permissions@example.com` and `no-permissions@exaample.com`. Those are the only two users we will support at this time. No seed data required the authentication tables (sessions are runtime-only).
- **Relationship Integrity**: Foreign key constraints to users table

#### 4.2 Logging Integration

Utilize existing logging infrastructure for authentication events:

```typescript
// Session activation logging
this.logger.auditLog(
  'SESSION_ACTIVATED',
  'success',
  'AuthService.authenticateUser',
  logContext,
  { userId, sessionId, tokenLength: jwtToken.length },
);

// Session deactivation logging
this.logger.auditLog(
  'SESSION_DEACTIVATED',
  'success',
  'AuthService.isUserAuthenticated',
  logContext,
  { userId, reason: 'timeout', sessionDuration },
);
```

#### 4.3 Permission System Integration

- **Permission Resolution**: Integrate with existing permission tables
- **Group Membership**: Utilize existing user permission group assignments
- **Domain Filtering**: Respect permission domain constraints

## Configuration

### Environment Variables

Add these to config/session-management.json
_tmc_ fix this please

```env
# Session timeout in seconds (default: 28800 = 8 hours)
SESSION_TIMEOUT_SECONDS=28800

# Session cleanup interval in minutes (default: 30 minutes)
SESSION_CLEANUP_INTERVAL_MINUTES=30

# JWT validation settings (future implementation)
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=8h
JWT_ISSUER=istack-buddy
```

### Configuration Interface

```typescript
interface AuthConfig {
  sessionTimeoutSeconds: number;
  sessionCleanupIntervalMinutes: number;
  jwtSecret?: string;
  jwtExpiration?: string;
  jwtIssuer?: string;
}
```

## Testing Strategy

### Unit Tests

- **Authentication Service**: Test all public methods
- **Session Management**: Test session creation, validation, and cleanup
- **Permission Resolution**: Test permission aggregation logic
- **Error Handling**: Test exception scenarios

### Integration Tests

- **Database Operations**: Test session CRUD operations
- **Logging Integration**: Verify audit logging functionality
- **Permission Integration**: Test permission system integration

### End-to-End Tests

- **Authentication Flow**: Complete user authentication process
- **Session Lifecycle**: From creation to expiration
- **Permission Access**: Verify permission-based access control

## Future Enhancements

### Redis Integration

- **Session Storage**: Migrate from PostgreSQL to Redis for better performance
- **Distributed Sessions**: Support for multi-instance deployments
- **Session Scalability**: Handle high-volume authentication scenarios

### Enhanced Security

- **JWT Implementation**: Replace placeholder with proper JWT validation
- **Multi-Factor Authentication**: Add MFA support
- **Session Invalidation**: Implement explicit logout functionality
- **Brute Force Protection**: Add rate limiting for authentication attempts

### Advanced Features

- **Single Sign-On (SSO)**: Integration with external identity providers
- **Role-Based Access Control**: Enhanced permission management
- **Session Analytics**: Authentication metrics and monitoring
- **API Key Authentication**: Alternative authentication method for service-to-service communication

## Implementation Timeline

### Phase 1: Core Service (Week 1-2)

- ✅ Database schema and migration
- ✅ Basic service structure and interfaces
- ✅ Authentication and session validation methods
- ✅ Integration with existing logging system

### Phase 2: Session Management (Week 3)

- ✅ Session cleanup and timeout handling
- ✅ Permission caching and resolution
- ✅ Comprehensive error handling

### Phase 3: Testing and Integration (Week 4)

- ✅ Unit and integration tests
- ✅ Integration with existing dev-debug endpoints
- ✅ Documentation and code review

### Phase 4: Security Hardening (Future)

- ⏳ Proper JWT validation implementation
- ⏳ Redis migration planning
- ⏳ Advanced security features

## Success Criteria

- **Functional Requirements**: All core authentication methods implemented and tested
- **Performance Requirements**: Session validation under 50ms
- **Security Requirements**: All authentication events logged and audited
- **Integration Requirements**: Seamless integration with existing permission system
- **Code Quality**: 90%+ test coverage and code review approval

## Risk Mitigation

### Technical Risks

- **Database Performance**: Implement proper indexing and session cleanup
- **Session Management**: Automated cleanup prevents session accumulation
- **Permission Complexity**: Leverage existing permission system architecture

### Security Risks

- **Token Validation**: Placeholder implementation clearly marked with TODOs
- **Session Security**: Unique constraints and automated cleanup
- **Audit Requirements**: Comprehensive logging for security monitoring

### Operational Risks

- **Migration Impact**: Non-destructive database changes
- **Backward Compatibility**: Read-only approach maintains system integrity
- **Performance Impact**: Caching strategy minimizes database load

---

## Conclusion

This authentication system provides a robust foundation for user session management while maintaining clean separation of concerns. The implementation follows established patterns in the codebase and integrates seamlessly with existing logging and permission systems. The placeholder JWT validation allows for immediate development progress while clearly marking areas requiring future security enhancements.
