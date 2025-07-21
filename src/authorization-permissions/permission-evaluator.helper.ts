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
function createEffectivePermissionChain(
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
 * Check if current date is between two dates (expiration date, valid period, etc.)
 * Accepts ISO date strings
 */
function isNowBetweenTwoDates(start: string, end: string): boolean {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);
  return now >= startDate && now <= endDate;
}

/**
 * Condition evaluator functions
 */
const conditionEvaluators = {
  timeWindow: (
    condition: any,
    context: EvaluateAllowConditions,
  ): { isConditionSatisfied: boolean; reason?: string } => {
    const { start, end } = condition;
    if (!isNowBetweenTwoTimes(start, end)) {
      return {
        isConditionSatisfied: false,
        reason: `Permission not valid outside time window ${start} - ${end}`,
      };
    }
    return { isConditionSatisfied: true };
  },

  dateRange: (
    condition: any,
    context: EvaluateAllowConditions,
  ): { isConditionSatisfied: boolean; reason?: string } => {
    const { start, end } = condition;
    if (!isNowBetweenTwoDates(start, end)) {
      return {
        isConditionSatisfied: false,
        reason: `Permission not valid outside date range ${start} - ${end}`,
      };
    }
    return { isConditionSatisfied: true };
  },
};

/**
 * Evaluate a single permission's conditions
 */
function evaluateCondition(
  permission: PermissionWithConditions,
  conditions: EvaluateAllowConditions,
): { isConditionSatisfied: boolean; reason?: string } {
  // If no conditions, permission is always valid
  if (
    !permission.conditions ||
    Object.keys(permission.conditions).length === 0
  ) {
    return { isConditionSatisfied: true };
  }

  // Evaluate each condition type using the appropriate evaluator
  for (const [conditionType, conditionValue] of Object.entries(
    permission.conditions,
  )) {
    const evaluator =
      conditionEvaluators[conditionType as keyof typeof conditionEvaluators];
    if (evaluator) {
      const result = evaluator(conditionValue, conditions);
      if (!result.isConditionSatisfied) {
        return result;
      }
    }
  }

  return { isConditionSatisfied: true };
}

/**
 * Main permission evaluation function
 * This is the core function that evaluates if a user has permission to perform an action
 */
function evaluatePermission(
  userId: string,
  permissionId: string,
  userPermissions: PermissionWithConditions[],
  groupPermissions: PermissionWithConditions[] = [],
  conditions: EvaluateAllowConditions = {},
): EvaluationResult {
  // Create effective permission chain
  let chain = createEffectivePermissionChain(userPermissions, groupPermissions);

  // Check if the required permission exists in the original chain (before condition filtering)
  const originalChain = createEffectivePermissionChain(
    userPermissions,
    groupPermissions,
  );
  const permissionExistsInOriginalChain = originalChain.some(
    (p) => p.permissionId === permissionId,
  );

  // Evaluate conditions for each permission
  const failedPermissions: { permissionId: string; reason: string }[] = [];
  const validChain: PermissionWithConditions[] = [];

  chain.forEach((permission) => {
    const conditionResult = evaluateCondition(permission, conditions);
    if (conditionResult.isConditionSatisfied) {
      validChain.push(permission);
    } else {
      failedPermissions.push({
        permissionId: permission.permissionId,
        reason: conditionResult.reason || 'Unknown condition failure',
      });
    }
  });

  chain = validChain;

  // Check if the required permission exists in the final chain
  const hasPermission = chain.some((p) => p.permissionId === permissionId);

  let reason: string;
  if (hasPermission) {
    reason = 'Allowed - Permission found in chain';
  } else if (permissionExistsInOriginalChain) {
    // Permission existed but was removed due to failed conditions
    const failedPermission = failedPermissions.find(
      (f) => f.permissionId === permissionId,
    );
    reason = `Permission is not allowed - Permission removed due to failed conditions: ${failedPermission?.reason || 'Unknown condition failure'}`;
  } else {
    // Permission was never in the chain
    reason = 'Permission is not allowed - Permission not found in chain';
  }

  const evaluatedChain = chain.map((p) => p.permissionId);

  return {
    actor: userId,
    subjectPermission: permissionId,
    isAllowed: hasPermission,
    reason,
    evaluatedChain,
  };
}

// Single export statement at the bottom
export { evaluatePermission, createEffectivePermissionChain };
