# Permission Evaluator Helper

This module provides simple helper functions for the authorization-permissions service.

## Overview

The permission evaluator helper provides focused permission evaluation including:

- **Effective permission chain creation** - Combines user and group permissions with duplicate handling
- **Permission evaluation** - Determines if a user has permission to perform an action
- **Condition-based evaluation** - Context-aware permission checking with time-based conditions
- **Detailed evaluation results** - Comprehensive feedback on why permissions were granted or not allowed

## Files

- `permission-evaluator.helper.ts` - Core permission evaluation functions
- `permission-evaluator.helper.spec.ts` - Unit tests for the helper functions
- `permission-evaluator.example.ts` - Integration examples and usage patterns

## Core Functions

### `evaluatePermission()`

The main function for evaluating permissions with full context:

```typescript
import { evaluatePermission } from './permission-evaluator.helper';

const result = evaluatePermission(
  userId,
  requiredPermission,
  userPermissions,
  groupPermissions,
  conditions,
);

// Returns:
// {
//   actor: string;
//   subjectPermission: string;
//   isAllowed: boolean;
//   reason: string;
//   evaluatedChain: string[];
// }
```

### `createEffectivePermissionChain()`

Creates an effective permission chain by combining user and group permissions:

```typescript
import { createEffectivePermissionChain } from './permission-evaluator.helper';

const chain = createEffectivePermissionChain(userPermissions, groupPermissions);
```

**Note:** This function handles duplicate permissions by keeping the first encountered instance. If two permissions with the same ID both have conditions, the first one is kept (this is a known limitation).

## Permission Types

### Permission with Conditions

```typescript
interface PermissionWithConditions {
  permissionId: string;
  conditions: IPermissionConditions | null; // Always present, sometimes null
  byVirtueOf: 'user' | 'group';
  groupId?: string;
}

interface IPermissionConditions {
  // Time-based conditions
  timeWindow?: {
    start: string; // Time string like "09:00" (working hours, after hours, etc.)
    end: string; // Time string like "17:00"
  };
  dateRange?: {
    start: string; // ISO date string (expiration date, valid period, etc.)
    end: string; // ISO date string
  };

  // Extensible for future conditions
  [key: string]: any;
}
```

## Evaluation Logic

The permission evaluator follows this evaluation chain:

1. **Create Effective Permission Chain** - Combines user and group permissions, removing duplicates
2. **Condition Evaluation** - Filters permissions based on contextual conditions (time windows, date ranges)
3. **Final Permission Check** - Determines if the required permission exists in the final chain

## Usage Examples

### Basic Permission Evaluation

```typescript
const userPermissions = [
  {
    permissionId: 'chat:conversations:read',
    conditions: null,
    byVirtueOf: 'user',
  },
  {
    permissionId: 'chat:conversations:create',
    conditions: null,
    byVirtueOf: 'user',
  },
];
const groupPermissions = [
  {
    permissionId: 'chat:dashboard:stats',
    conditions: null,
    byVirtueOf: 'group',
  },
];

const result = evaluatePermission(
  'user123',
  'chat:conversations:read',
  userPermissions,
  groupPermissions,
);

console.log(result.isAllowed); // true
```

### Detailed Evaluation

```typescript
const result = evaluatePermission(
  'user123',
  'chat:conversations:write',
  [
    {
      permissionId: 'chat:conversations:read',
      conditions: null,
      byVirtueOf: 'user',
    },
    {
      permissionId: 'chat:conversations:create',
      conditions: null,
      byVirtueOf: 'user',
    },
  ],
  [
    {
      permissionId: 'chat:dashboard:stats',
      conditions: null,
      byVirtueOf: 'group',
    },
  ],
);

console.log(result);
// {
//   actor: 'user123',
//   subjectPermission: 'chat:conversations:write',
//   isAllowed: false,
//   reason: 'Permission is not allowed - Permission not found in chain',
//   evaluatedChain: ['chat:conversations:read', 'chat:conversations:create', 'chat:dashboard:stats']
// }
```

### Create Effective Permission Chain

```typescript
const chain = createEffectivePermissionChain(
  [
    {
      permissionId: 'chat:conversations:read',
      conditions: null,
      byVirtueOf: 'user',
    },
    {
      permissionId: 'chat:conversations:create',
      conditions: null,
      byVirtueOf: 'user',
    },
  ],
  [
    {
      permissionId: 'chat:dashboard:stats',
      conditions: null,
      byVirtueOf: 'group',
    },
    {
      permissionId: 'chat:conversations:read',
      conditions: { timeWindow: { start: '09:00', end: '17:00' } },
      byVirtueOf: 'group',
    }, // Duplicate with conditions
  ],
);

console.log(chain);
// [
//   { permissionId: 'chat:conversations:read', conditions: { timeWindow: { start: '09:00', end: '17:00' } }, byVirtueOf: 'group' },
//   { permissionId: 'chat:conversations:create', conditions: null, byVirtueOf: 'user' },
//   { permissionId: 'chat:dashboard:stats', conditions: null, byVirtueOf: 'group' }
// ]
// Note: Duplicate 'chat:conversations:read' is removed, keeping the one with conditions
```

### Time-Based Conditions (Proof of Concept)

```typescript
const result = evaluatePermission(
  'user123',
  'chat:conversations:read',
  [
    {
      permissionId: 'chat:conversations:read',
      conditions: { timeWindow: { start: '09:00', end: '17:00' } },
      byVirtueOf: 'user',
    },
  ],
  [],
  {},
);
```

### Date Range Conditions (Proof of Concept)

```typescript
const result = evaluatePermission(
  'user123',
  'admin:access',
  [
    {
      permissionId: 'admin:access',
      conditions: { dateRange: { start: '2024-01-01', end: '2024-12-31' } },
      byVirtueOf: 'user',
    },
  ],
  [],
  {},
);
```

## Integration with Existing Services

The permission evaluator is designed to be easily integrated with your existing authorization services. See `permission-evaluator.example.ts` for integration patterns.

### Example Integration

```typescript
import {
  evaluatePermission,
  PermissionWithConditions,
} from './permission-evaluator.helper';

export class EnhancedAuthorizationService {
  public async evaluatePermission(
    userId: string,
    permission: string,
    conditions?: any,
  ) {
    const userPermissions = await this.getUserPermissions(userId);
    const groupPermissions = await this.getGroupPermissions(userId);

    return evaluatePermission(
      userId,
      permission,
      userPermissions,
      groupPermissions,
      conditions,
    );
  }

  public async isAllowed(userId: string, permission: string): Promise<boolean> {
    const result = await this.evaluatePermission(userId, permission);
    return result.isAllowed;
  }

  private async getUserPermissions(
    userId: string,
  ): Promise<PermissionWithConditions[]> {
    // Return permission objects with conditions
    return [
      { permissionId: 'chat:read', conditions: null, byVirtueOf: 'user' },
      {
        permissionId: 'admin:access',
        conditions: { dateRange: { start: '2024-01-01', end: '2024-12-31' } },
        byVirtueOf: 'user',
      },
    ];
  }
}
```

## Testing

Run the tests with:

```bash
npm test -- src/authorization-permissions/permission-evaluator.helper.spec.ts
```

The tests cover:

- Effective permission chain creation with duplicate handling
- Time-based condition evaluation
- Date range condition evaluation
- Basic and detailed permission checking
- Edge cases with empty permissions

## Limitations

- **Duplicate Permissions with Conditions**: If two permissions with the same ID both have conditions, the first one encountered is kept and the second one is completely ignored. This means if a user has 'chat:read' permission from both their user permissions and group permissions, and both have different conditions, only the first one's conditions will be evaluated. The second permission with its conditions will be silently ignored. This limitation should be addressed in future implementations by either merging conditions or providing a conflict resolution strategy.
- **Condition Types**: Currently supports time windows and date ranges as proof of concept. Additional condition types can be added as needed.

## Notes

- This is a standalone helper that can be integrated into your existing services
- All functions are pure and don't depend on external state
- The helper focuses on permission evaluation logic, not domain validation
- Domain validation should be handled by the authorization service
- The helper supports both simple boolean checks and detailed evaluation results
- Conditions are always part of the permission assignment and evaluated in context
- Time-based and date range conditions are included as proof of concept for future extensibility
- The evaluation system is generic and extensible through lambda functions
