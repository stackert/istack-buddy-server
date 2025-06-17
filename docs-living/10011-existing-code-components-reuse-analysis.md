# Existing Code Components Reuse Analysis

## How-Do-You-Know Server (Authentication & File Management)

### RECOMMENDED FOR REUSE

#### 1. Permission System Architecture

**Location**: `how-do-you-know-src/modules/auth/`
**Quality**: Production-ready with comprehensive coverage
**Reuse Value**: HIGH

- **Domain:Function:Action Convention**: The permission format `domain:resource:action` is exactly what we need
- **Permission Decorators**: `@RequirePermissions('course:resources:practice-exam:common:read')` pattern is well-established
- **Database Schema**: Comprehensive permission/group/user assignment structure
- **Audit Trail**: Built-in history tracking for permission changes

**Specific Components to Borrow**:

```typescript
// Permission decorator pattern
@RequirePermissions('permission:id:here')

// Database schema patterns (from SQL file)
- access_permissions table
- access_permission_domains table
- access_permission_assignments_user table
- access_permission_assignments_group table
- access_permission_group_memberships table
```

#### 2. File Storage System

**Location**: `how-do-you-know-src/modules/file-manager/`
**Quality**: Production-ready with comprehensive features
**Reuse Value**: HIGH

**Key Features to Borrow**:

- Storage class abstraction
- File hashing and integrity verification
- Queue-based file processing
- Multi-protocol support (HTTP, file://, etc.)
- Soft delete functionality
- Owner-based access control
- File metadata management

**Specific Patterns**:

```typescript
// Storage class enum patterns
enum StorageClassEnum {
  TEMPORARY_LESS_THAN_24_HOURS = 'temporary-less-than-24-hours',
  // ... other classes
}

// File status tracking
enum FileStatusEnum {
  RECEIVED_UPLOAD_PENDING_ACCEPTANCE = 'received-upload-pending-acceptance',
  QUEUED_FOR_PROCESSING = 'queued-for-processing',
  READY = 'ready',
  // ... other statuses
}
```

#### 3. Database Conventions & Patterns

**Location**: `how-do-you-know-docs-living/database_002_build_schema.sql`
**Quality**: Well-structured with clear conventions
**Reuse Value**: HIGH

**Conventions to Adopt**:

- UUID primary keys with `uuid_generate_v4()`
- Consistent timestamp fields (`created_at`, `updated_at`, `deleted_at`)
- Soft delete patterns with `is_soft_deleted` boolean
- Audit table patterns with `_history` suffix
- Trigger-based timestamp updates
- Enum types for constrained values
- Proper foreign key relationships and indexing

### PATTERNS TO ADAPT (NOT DIRECT REUSE)

#### 1. JWT Authentication Flow

**Location**: `how-do-you-know-src/modules/auth/guards/`
**Reuse Value**: MEDIUM (Adapt pattern)

The HTTP-based JWT authentication can inform our chat system's authentication flow, but we need WebSocket-specific adaptations.

#### 2. User Management Structure

**Location**: `how-do-you-know-src/modules/users/`
**Reuse Value**: MEDIUM (Adapt schema)

User table structure and profile management can inform our user system, but we need chat-specific fields.

## Conversations Server (WebSocket & Chat)

### RECOMMENDED FOR REUSE

#### 1. WebSocket Gateway Structure

**Location**: `conversations-server-src/conversations-gateway/conversations.gateway.ts`
**Quality**: Good foundation but needs production hardening
**Reuse Value**: MEDIUM

**Patterns to Borrow**:

```typescript
@WebSocketGateway(WS_SERVER_PORT, {
  // cors: { origin: '*' },
})
export class ConversationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
```

**Room Management Patterns**:

- Group/room creation with UUID
- Participant tracking with client ID mapping
- Subscription-based room membership
- Targeted message broadcasting

#### 2. Message Broadcasting Architecture

**Reuse Value**: MEDIUM

The targeted broadcasting system using client ID lookup is a solid pattern:

```typescript
private wsClientsById: TSimpleDictionary<Socket> = {};
private conversationsSubscriptions: TSimpleDictionary<Socket[]> = {};
```

### ANTI-PATTERNS TO AVOID

#### 1. Public Gateway Methods

**Location**: `conversations.gateway.ts:75`

```typescript
// ANTI-PATTERN: Public methods on gateway
public broadcastEmit(event, message: any) {
  // ... should be private
}
```

#### 2. Mixed Responsibilities

**Anti-Pattern**: Gateway handling both WebSocket management AND business logic
**Better**: Separate service layer for business logic

#### 3. Weak Authentication Guards

The WebSocket authentication guard implementation appears incomplete and should be strengthened.

#### 4. No Error Handling

Missing comprehensive error handling for WebSocket operations.

## Technical Debt Identified

### From How-Do-You-Know

1. **File Manager**: Some TODO comments around file hashing implementation
2. **Permission System**: Complex condition validation may need simplification
3. **Database**: Some performance optimization opportunities in query patterns

### From Conversations Server

1. **Authentication**: Incomplete WebSocket auth implementation
2. **Error Handling**: Minimal error handling throughout
3. **Testing**: Limited test coverage
4. **Type Safety**: Some `any` types used instead of proper typing
5. **Configuration**: Hard-coded values instead of config service usage

## Reuse Strategy Recommendations

### HIGH PRIORITY REUSE

1. **Permission System**: Adopt entire domain:function:action architecture
2. **File Storage**: Adapt storage class and file management patterns
3. **Database Conventions**: Apply SQL naming and structure conventions
4. **Authentication Decorators**: Use permission decorator patterns

### MEDIUM PRIORITY ADAPTATION

1. **WebSocket Gateway**: Use as foundation but add production features
2. **Room Management**: Adapt room/group patterns for our chat rooms
3. **Message Broadcasting**: Build upon client tracking patterns

### AVOID/REWRITE

1. **WebSocket Authentication**: Rewrite for production security
2. **Gateway Business Logic**: Separate concerns properly
3. **Error Handling**: Implement comprehensive error handling
4. **Hard-coded Values**: Replace with proper configuration

## Code Quality Assessment

### Production Ready (>90% reusable)

- Permission system database schema
- File storage database design
- Permission decorators and guards
- Database conventions and triggers

### Good Foundation (60-80% reusable)

- WebSocket gateway structure
- Room management concepts
- File upload/download patterns
- User profile management

### Needs Significant Work (<50% reusable)

- WebSocket authentication
- Error handling throughout conversations server
- Configuration management
- Test coverage and documentation
