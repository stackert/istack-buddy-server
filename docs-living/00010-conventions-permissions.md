# Permission System Conventions

## Overview

This document establishes the conventions and terminology for our permission system, based on the proven patterns from the how-do-you-know project. **We MUST maintain consistent terminology and NEVER mix terms.**

## Core Terminology

### Primary Terms (Use These)

- **Permission**: A string identifier that represents a capability (e.g., `chat:conversation:read`)
- **Permission Grant**: An assignment of a permission to a user or group
- **Permission Requirement**: What a resource (endpoint) needs to allow access
- **Group**: A collection of users for permission management convenience

### Forbidden Terms (Never Use)

- ❌ **Role** - Use "permission" instead
- ❌ **Grant** - Use "permission" instead
- ❌ **Permission Set** - Use "group" instead
- ❌ **Access Control** - Use "permission" instead

## Permission Format

### Pattern

```
domain:resource:action:role
```

### Examples

- `chat:conversation:read`
- `auth:user:profile:me`
- `admin:debug:system`
- `system:slack:events`

### Rules

- Use lowercase with colons as separators
- No spaces or special characters
- Domain must be a known functional domain
- Action should be a verb (read, write, create, delete)

## Functional Domains

### Defined Domains

```javascript
{
  "chat": "Chat conversation management",
  "auth": "User authentication and profiles",
  "admin": "Administrative debugging tools",
  "system": "System-level operations"
}
```

### Adding New Domains

- Must be documented here
- Must follow naming conventions
- Must have clear purpose

## Permission Evaluation Rules

### 1. Pessimistic Security

- **Default**: Deny access
- **Grant**: Only when explicitly permitted
- **Override**: Any deny permission blocks everything

### 2. Atomic Permissions

- Each permission is independent
- No inheritance between permissions
- No permission hierarchies

### 3. Exact Matching

- Permission strings must match exactly
- No wildcards or pattern matching
- Case-sensitive comparison

### 4. Group Convenience

- Groups exist for administrative convenience only
- No structural meaning to groups
- Users can belong to multiple groups
- Group permissions are added to user's permission chain

## Database Conventions

### Table Names

- `access_permission_groups` - Groups for organizing permissions
- `access_permission_assignments_user` - Direct user permission assignments
- `access_permission_assignments_group` - Group permission assignments
- `access_permission_group_memberships` - User membership in groups

### Column Names

- `permission_id` - The permission string identifier
- `user_id` - User being granted the permission
- `permission_group_id` - Group being granted the permission
- `conditions` - JSONB conditions for conditional permissions

## Code Conventions

### Decorators

```typescript
// Use SecuredEndpoint decorator
@SecuredEndpoint('chat:conversation:read')

// Multiple permissions (OR logic)
@SecuredEndpoint(['chat:conversation:write', 'chat:conversation:admin'])

// Public endpoints
@Public()
```

### Service Methods

```typescript
// Permission evaluation method
async evaluateAllow(userId: string, permissionId: string): Promise<boolean>

// Get user permissions
async getUserPermissions(userId: string): Promise<string[]>
```

### Variable Names

```typescript
// Use these patterns
const requiredPermission = 'chat:conversation:read';
const userPermissions = await this.getUserPermissions(userId);
const hasPermission = await this.evaluateAllow(userId, requiredPermission);
```

## Documentation Conventions

### When Writing About Permissions

- ✅ "The endpoint requires the `chat:conversation:read` permission"
- ✅ "Users are granted the `admin:debug` permission"
- ❌ "The endpoint requires the chat:conversation:read role"
- ❌ "Users are given the admin:debug grant"

### When Describing Access Control

- ✅ "Permission-based access control"
- ✅ "Permission evaluation"
- ❌ "Role-based access control"
- ❌ "Access control evaluation"

## Migration Guidelines

### From Old Terminology

- Replace "role" with "permission"
- Replace "grant" with "permission"
- Replace "permission set" with "group"
- Update all documentation and comments

### Code Updates

- Update decorator names
- Update service method names
- Update variable names
- Update database column names

## Enforcement

### Code Review Checklist

- [ ] No use of forbidden terms
- [ ] Permission format follows conventions
- [ ] Database names follow conventions
- [ ] Documentation uses correct terminology

### Linting Rules

- Add ESLint rules to catch forbidden terms
- Add TypeScript rules for permission format validation
- Add database migration checks for naming conventions

## References

- **How-Do-You-Know Documentation**: `docs-living/external-project-links/how-do-you-know-docs-living/features/auth/0001-auth-prereq-align-permission-terminology.md`
- **Database Schema**: `docs-living/external-project-links/how-do-you-know-docs-living/database_002_build_schema.sql`
- **Implementation**: `docs-living/external-project-links/how-do-you-know-src/modules/access-control/`

This document should be referenced whenever working with permissions to ensure consistent terminology and implementation.
