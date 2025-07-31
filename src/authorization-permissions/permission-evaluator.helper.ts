/**
 * Permission Evaluator Helper Functions
 *
 * Simple helper functions for the authorization-permissions service.
 * Focused on creating effective permission chains and evaluating permissions.
 */

export interface PermissionWithConditions {
  permissionId: string;
  conditions: IPermissionConditions | null; // Always present, sometimes null
  byVirtueOf: 'user' | 'group';
  groupId?: string;
}

export interface IPermissionConditions {
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

export interface EvaluationResult {
  actor: string; // userId
  subjectPermission: string; // permissionId - resource requires this permission
  isAllowed: boolean;
  reason: string;
  evaluatedChain: string[];
}

export interface EvaluateAllowConditions {
  target?: {
    userId?: string;
    resourceId?: string;
  };
  context?: {
    currentTime?: string; // ISO string for testing
    currentDate?: string; // ISO date string for testing
  };
}

/**
 * Create effective permission chain by combining user and group permissions
 * This is the equivalent of getPermissionChains from the external project
 *
 * LIMITATION: If two permissions with the same ID both have conditions,
 * we keep the first one encountered and ignore the second one completely.
 * This means if a user has 'chat:read' permission from both their user
 * permissions and group permissions, and both have different conditions,
 * only the first one's conditions will be evaluated. The second permission
 * with its conditions will be silently ignored. This limitation should be
 * addressed in future implementations by either merging conditions or
 * providing a conflict resolution strategy.
 */
export function createEffectivePermissionChain(
  userPermissions: PermissionWithConditions[],
  groupPermissions: PermissionWithConditions[] = [],
): PermissionWithConditions[] {
  // Combine chains and remove duplicates
  const combinedChain = [...userPermissions, ...groupPermissions];
  const uniquePermissions: Record<string, PermissionWithConditions> = {};

  combinedChain.forEach((permission) => {
    if (uniquePermissions[permission.permissionId]) {
      const existing = uniquePermissions[permission.permissionId];
      // If existing has no conditions but new one does, replace it
      if (!existing.conditions && permission.conditions) {
        uniquePermissions[permission.permissionId] = permission;
      }
      // If both have conditions, keep the first one (LIMITATION)
      // This limitation should be addressed in future implementations
    } else {
      uniquePermissions[permission.permissionId] = permission;
    }
  });

  return Object.values(uniquePermissions);
}

/**
 * Get effective permission chain for a user (own permissions + group memberships)
 * This function should be used by the authorization service to get the user's
 * complete permission set with conditions evaluated.
 */
export function getUserEffectivePermissionChain(
  userId: string,
  userOwnPermissions: PermissionWithConditions[],
  userGroupMemberships: PermissionWithConditions[] = [],
  evaluationContext: EvaluateAllowConditions = {},
): PermissionWithConditions[] {
  // Create the effective chain combining user and group permissions
  const effectiveChain = createEffectivePermissionChain(
    userOwnPermissions,
    userGroupMemberships,
  );

  // Filter out permissions that fail conditions
  const validPermissions: PermissionWithConditions[] = [];
  const failedPermissions: PermissionWithConditions[] = [];

  effectiveChain.forEach((permission) => {
    if (permission.conditions) {
      const conditionResult = evaluateCondition(permission, evaluationContext);
      if (conditionResult.isConditionSatisfied) {
        validPermissions.push(permission);
      } else {
        failedPermissions.push(permission);
      }
    } else {
      // No conditions, so permission is valid
      validPermissions.push(permission);
    }
  });

  return validPermissions;
}

/**
 * Check if current time is between two times of day (working hours, after hours, etc.)
 * Accepts time strings like "09:00" or "17:00"
 */
function isNowBetweenTwoTimes(start: string, end: string): boolean {
  const now = new Date();
  const startTime = new Date(`2000-01-01T${start}:00`);
  const endTime = new Date(`2000-01-01T${end}:00`);
  const currentTime = new Date(
    `2000-01-01T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`,
  );

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Check if current date is between two dates (expiration, valid period, etc.)
 * Accepts ISO date strings like "2024-01-01" or "2024-12-31"
 */
function isNowBetweenTwoDates(start: string, end: string): boolean {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);

  return now >= startDate && now <= endDate;
}

/**
 * Evaluate a permission's conditions against the provided context
 */
function evaluateCondition(
  permission: PermissionWithConditions,
  conditions: EvaluateAllowConditions,
): { isConditionSatisfied: boolean; reason?: string } {
  if (!permission.conditions) {
    return { isConditionSatisfied: true };
  }

  const { timeWindow, dateRange } = permission.conditions;

  // Evaluate time window conditions
  if (timeWindow) {
    const isInTimeWindow = isNowBetweenTwoTimes(
      timeWindow.start,
      timeWindow.end,
    );
    if (!isInTimeWindow) {
      return {
        isConditionSatisfied: false,
        reason: `Permission not valid outside time window ${timeWindow.start} - ${timeWindow.end}`,
      };
    }
  }

  // Evaluate date range conditions
  if (dateRange) {
    const isInDateRange = isNowBetweenTwoDates(dateRange.start, dateRange.end);
    if (!isInDateRange) {
      return {
        isConditionSatisfied: false,
        reason: `Permission not valid outside date range ${dateRange.start} - ${dateRange.end}`,
      };
    }
  }

  return { isConditionSatisfied: true };
}

/**
 * Evaluate if a user has a specific permission
 * This is the main function that should be used by the authorization service
 */
export function evaluatePermission(
  userId: string,
  permissionId: string,
  userOwnPermissions: PermissionWithConditions[],
  userGroupMemberships: PermissionWithConditions[] = [],
  evaluationContext: EvaluateAllowConditions = {},
): EvaluationResult {
  // Get the effective permission chain (no duplicates, no failed conditions)
  const effectiveChain = getUserEffectivePermissionChain(
    userId,
    userOwnPermissions,
    userGroupMemberships,
    evaluationContext,
  );

  // Check if the required permission exists in the effective chain
  const hasPermission = effectiveChain.some(
    (p) => p.permissionId === permissionId,
  );

  // Create the original chain for comparison (before condition filtering)
  const originalChain = createEffectivePermissionChain(
    userOwnPermissions,
    userGroupMemberships,
  );
  const permissionExistsInOriginalChain = originalChain.some(
    (p) => p.permissionId === permissionId,
  );

  // Determine the reason for the result
  let reason: string;
  if (hasPermission) {
    reason = 'Allowed - Permission found in chain';
  } else if (permissionExistsInOriginalChain) {
    reason = `Permission is not allowed - Permission removed due to failed conditions`;
  } else {
    reason = 'Permission is not allowed - Permission not found in chain';
  }

  return {
    actor: userId,
    subjectPermission: permissionId,
    isAllowed: hasPermission,
    reason,
    evaluatedChain: effectiveChain.map((p) => p.permissionId),
  };
}
