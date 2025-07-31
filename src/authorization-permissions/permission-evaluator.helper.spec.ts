import {
  PermissionWithConditions,
  evaluatePermission,
  createEffectivePermissionChain,
} from './permission-evaluator.helper';

describe('PermissionEvaluatorHelper', () => {
  describe('createEffectivePermissionChain', () => {
    it('should combine user and group permissions', () => {
      const userPermissions: PermissionWithConditions[] = [
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
      const groupPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:dashboard:stats',
          conditions: null,
          byVirtueOf: 'group',
        },
      ];

      const result = createEffectivePermissionChain(
        userPermissions,
        groupPermissions,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        permissionId: 'chat:conversations:read',
        conditions: null,
        byVirtueOf: 'user',
      });
      expect(result[1]).toEqual({
        permissionId: 'chat:conversations:create',
        conditions: null,
        byVirtueOf: 'user',
      });
      expect(result[2]).toEqual({
        permissionId: 'chat:dashboard:stats',
        conditions: null,
        byVirtueOf: 'group',
      });
    });

    it('should handle empty group permissions', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [];

      const result = createEffectivePermissionChain(
        userPermissions,
        groupPermissions,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        permissionId: 'chat:conversations:read',
        conditions: null,
        byVirtueOf: 'user',
      });
    });

    it('should remove duplicate permissions and keep conditions when available', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: { timeWindow: { start: '09:00', end: '17:00' } },
          byVirtueOf: 'group',
        },
      ];

      const result = createEffectivePermissionChain(
        userPermissions,
        groupPermissions,
      );

      expect(result).toHaveLength(1);
      // Should keep the group permission since it has conditions
      expect(result[0]).toEqual({
        permissionId: 'chat:conversations:read',
        conditions: { timeWindow: { start: '09:00', end: '17:00' } },
        byVirtueOf: 'group',
      });
    });

    it('should handle duplicate permissions with conditions', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: { timeWindow: { start: '09:00', end: '17:00' } },
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: { timeWindow: { start: '10:00', end: '18:00' } },
          byVirtueOf: 'group',
        },
      ];

      const result = createEffectivePermissionChain(
        userPermissions,
        groupPermissions,
      );

      expect(result).toHaveLength(1);
      // Should keep the first one (user permission) as per limitation
      expect(result[0].byVirtueOf).toBe('user');
      expect(result[0].conditions?.timeWindow?.start).toBe('09:00');
    });
  });

  describe('evaluatePermission', () => {
    it('should return detailed evaluation result when permission is found', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [
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

      expect(result.actor).toBe('user123');
      expect(result.subjectPermission).toBe('chat:conversations:read');
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('Allowed');
      expect(result.evaluatedChain).toContain('chat:conversations:read');
    });

    it('should return permission not allowed result when permission not found', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [];

      const result = evaluatePermission(
        'user123',
        'chat:conversations:write',
        userPermissions,
        groupPermissions,
      );

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe(
        'Permission is not allowed - Permission not found in chain',
      );
    });

    it('should handle time window conditions', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: { timeWindow: { start: '00:00', end: '23:59' } }, // All day window
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [];

      const result = evaluatePermission(
        'user123',
        'chat:conversations:read',
        userPermissions,
        groupPermissions,
        {},
      );

      expect(result.actor).toBe('user123');
      expect(result.subjectPermission).toBe('chat:conversations:read');
      // Should be allowed if current time is within the window
      expect(result.isAllowed).toBe(true);
    });

    it('should handle date range conditions', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'admin:access',
          conditions: { dateRange: { start: '2020-01-01', end: '2030-12-31' } }, // Wide date range
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [];

      const result = evaluatePermission(
        'user123',
        'admin:access',
        userPermissions,
        groupPermissions,
        {},
      );

      expect(result.actor).toBe('user123');
      expect(result.subjectPermission).toBe('admin:access');
      // Should be allowed if current date is within the range
      expect(result.isAllowed).toBe(true);
    });

    it('should provide accurate reason when permission exists but conditions fail', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: { dateRange: { start: '2020-01-01', end: '2020-12-31' } }, // Expired
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [];

      const result = evaluatePermission(
        'user123',
        'chat:conversations:read',
        userPermissions,
        groupPermissions,
        {},
      );

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe(
        'Permission is not allowed - Permission removed due to failed conditions',
      );
    });

    it('should work with empty permission arrays', () => {
      const userPermissions: PermissionWithConditions[] = [];
      const groupPermissions: PermissionWithConditions[] = [];

      const result = evaluatePermission(
        'user123',
        'chat:conversations:read',
        userPermissions,
        groupPermissions,
      );

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe(
        'Permission is not allowed - Permission not found in chain',
      );
      expect(result.evaluatedChain).toHaveLength(0);
    });

    it('should handle duplicate permissions in effective chain', () => {
      const userPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
          conditions: null,
          byVirtueOf: 'user',
        },
      ];
      const groupPermissions: PermissionWithConditions[] = [
        {
          permissionId: 'chat:conversations:read',
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

      expect(result.isAllowed).toBe(true);
      expect(result.evaluatedChain).toHaveLength(1); // Should have only one instance
      expect(result.evaluatedChain[0]).toBe('chat:conversations:read');
    });
  });
});
