/**
 * Permission Evaluator Integration Example
 *
 * This file shows how to integrate the permission evaluator helper
 * with our existing AuthorizationPermissionsService.
 *
 * This is for demonstration purposes - you can adapt this pattern
 * to integrate with your actual service.
 */

import {
  evaluatePermission,
  createEffectivePermissionChain,
  PermissionWithConditions,
} from './permission-evaluator.helper';

/**
 * Example of how to enhance the existing AuthorizationPermissionsService
 * with the new permission evaluator functionality
 */
export class EnhancedPermissionService {
  /**
   * Example method showing how to use the permission evaluator
   * with our existing in-memory test user system
   */
  public async evaluateUserPermission(
    userId: string,
    requiredPermission: string,
    conditions?: any,
  ): Promise<{
    isAllowed: boolean;
    reason: string;
    evaluatedChain: string[];
  }> {
    // Get user permissions from your existing system
    const userPermissions = await this.getUserPermissions(userId);
    const groupPermissions = await this.getGroupPermissions(userId);

    // Use the permission evaluator helper
    const result = evaluatePermission(
      userId,
      requiredPermission,
      userPermissions,
      groupPermissions,
      conditions,
    );

    return {
      isAllowed: result.isAllowed,
      reason: result.reason,
      evaluatedChain: result.evaluatedChain,
    };
  }

  /**
   * Example method showing how to create effective permission chain
   */
  public createEffectivePermissionChain(
    userPermissions: PermissionWithConditions[],
    groupPermissions: PermissionWithConditions[] = [],
  ) {
    return createEffectivePermissionChain(userPermissions, groupPermissions);
  }

  /**
   * Example of advanced permission evaluation with conditions
   */
  public async evaluateChatPermission(
    userId: string,
    action: 'read' | 'write' | 'create',
  ): Promise<boolean> {
    const result = await this.evaluateUserPermission(
      userId,
      `chat:conversations:${action}`,
      {},
    );

    return result.isAllowed;
  }

  // Mock methods - replace with your actual implementation
  private async getUserPermissions(
    userId: string,
  ): Promise<PermissionWithConditions[]> {
    // Replace with your actual user permission retrieval logic
    return [
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
  }

  private async getGroupPermissions(
    userId: string,
  ): Promise<PermissionWithConditions[]> {
    // Replace with your actual group permission retrieval logic
    return [
      {
        permissionId: 'chat:dashboard:stats',
        conditions: null,
        byVirtueOf: 'group',
      },
    ];
  }
}

/**
 * Example usage scenarios
 */
export function demonstratePermissionEvaluation() {
  const service = new EnhancedPermissionService();

  // Example 1: Basic permission evaluation
  console.log('=== Basic Permission Evaluation ===');
  const basicResult = evaluatePermission(
    'user123',
    'chat:conversations:read',
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
  console.log('Basic permission result:', basicResult.isAllowed); // true

  // Example 2: Detailed permission evaluation
  console.log('\n=== Detailed Permission Evaluation ===');
  const detailedResult = evaluatePermission(
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
  console.log('Detailed evaluation:', {
    isAllowed: detailedResult.isAllowed,
    reason: detailedResult.reason,
    evaluatedChain: detailedResult.evaluatedChain,
  });
  // Output: reason: "Permission is not allowed - Permission not found in chain"

  // Example 3: Create effective permission chain with duplicates
  console.log('\n=== Create Effective Permission Chain ===');
  const effectiveChain = createEffectivePermissionChain(
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
  console.log('Effective permission chain:', effectiveChain);
  console.log(
    'Note: Duplicate permissions are removed, keeping the one with conditions',
  );

  // Example 4: Time-based conditions (proof of concept)
  console.log('\n=== Time-Based Conditions (Proof of Concept) ===');
  const timeConditionResult = evaluatePermission(
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
  console.log('Time condition evaluation:', {
    isAllowed: timeConditionResult.isAllowed,
    reason: timeConditionResult.reason,
  });

  // Example 5: Date range conditions (proof of concept)
  console.log('\n=== Date Range Conditions (Proof of Concept) ===');
  const dateConditionResult = evaluatePermission(
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
  console.log('Date condition evaluation:', {
    isAllowed: dateConditionResult.isAllowed,
    reason: dateConditionResult.reason,
  });

  // Example 6: Permission exists but conditions fail
  console.log('\n=== Permission Exists But Conditions Fail ===');
  const expiredPermissionResult = evaluatePermission(
    'user123',
    'chat:conversations:read',
    [
      {
        permissionId: 'chat:conversations:read',
        conditions: { dateRange: { start: '2020-01-01', end: '2020-12-31' } }, // Expired
        byVirtueOf: 'user',
      },
    ],
    [],
    {},
  );
  console.log('Expired permission evaluation:', {
    isAllowed: expiredPermissionResult.isAllowed,
    reason: expiredPermissionResult.reason,
  });
  // Output: reason: "Permission is not allowed - Permission removed due to failed conditions: Permission not valid outside date range 2020-01-01 - 2020-12-31"

  // Example 7: Empty permissions
  console.log('\n=== Empty Permissions ===');
  const emptyResult = evaluatePermission(
    'user123',
    'chat:conversations:read',
    [],
    [],
  );
  console.log('Empty permissions result:', {
    isAllowed: emptyResult.isAllowed,
    reason: emptyResult.reason,
  });
  // Output: reason: "Permission is not allowed - Permission not found in chain"

  // Example 8: Duplicate permission handling
  console.log('\n=== Duplicate Permission Handling ===');
  const duplicateResult = evaluatePermission(
    'user123',
    'chat:conversations:read',
    [
      {
        permissionId: 'chat:conversations:read',
        conditions: null,
        byVirtueOf: 'user',
      },
    ],
    [
      {
        permissionId: 'chat:conversations:read',
        conditions: null,
        byVirtueOf: 'group',
      },
    ],
  );
  console.log('Duplicate permission result:', {
    isAllowed: duplicateResult.isAllowed,
    evaluatedChain: duplicateResult.evaluatedChain,
    note: 'Only one instance of the permission in the chain',
  });
}

// Uncomment to run the demonstration
// demonstratePermissionEvaluation();
