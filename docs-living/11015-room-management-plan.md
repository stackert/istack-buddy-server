# Room Management & Business Logic Plan

## Overview

Core business logic for chat room lifecycle, participant management, guest protection, and issue-centric conversations with proper access controls.

## Implementation Order

**Priority: 4**
**Dependencies: 11001-authentication, 11005-websocket, 11010-database-schema**
**Required Before: Message processing, escalation system**

## Features Included

### 1. Room Lifecycle Management

- Room creation (group, direct, support)
- Room configuration and settings
- Room archival and deletion
- Issue-centric room organization

### 2. Participant Management

- User invitation and joining
- Guest protection rules
- Role-based permissions within rooms
- Participant removal and moderation

### 3. Access Control & Security

- Guest isolation (never alone)
- Employee vs guest permissions
- Supervisor monitoring capabilities
- Room privacy and visibility controls

### 4. Business Rules Enforcement

- Guest protection (never unattended)
- Employee-only robot interactions
- Issue tracking and resolution
- Room capacity and limits

## Core Business Rules

### Guest Protection Rules

1. **Never Alone**: Guests cannot be in rooms without employees
2. **Invitation Only**: Guests can only join rooms they're invited to
3. **Limited Access**: Guests cannot create rooms or invite others
4. **Supervised Interactions**: Guest-robot interactions must be mediated by employees

### Room Access Rules

1. **Private Rooms**: Invitation-only access
2. **Public Rooms**: Open to all employees, guests by invitation
3. **Support Rooms**: Issue-specific with proper escalation paths
4. **Supervisor Override**: Supervisors can access any room for monitoring

## Technical Implementation

### Room Service

```typescript
@Injectable()
export class RoomService {
  @RequirePermissions('chat:room:create')
  async createRoom(creatorId: string, roomData: CreateRoomDto): Promise<Room> {
    // Validate creator permissions
    // Create room with proper settings
    // Set creator as moderator
    // Apply business rules based on room type
  }

  @RequirePermissions('chat:room:join')
  async joinRoom(userId: string, roomId: string): Promise<void> {
    // Check user permissions
    // Validate room access rules
    // Enforce guest protection rules
    // Add user as participant
  }

  async enforceGuestProtection(roomId: string): Promise<void> {
    // Check if any guests are alone
    // Remove guests if no employees present
    // Notify supervisors of violations
  }
}
```

### Room Types & Configuration

```typescript
enum RoomType {
  GROUP = 'group', // General group conversations
  DIRECT = 'direct', // 1:1 conversations (still in rooms)
  SUPPORT = 'support', // Customer support rooms
  ESCALATED = 'escalated', // Escalated support rooms
}

interface RoomSettings {
  allowGuestAccess: boolean;
  maxParticipants: number;
  requireModeration: boolean;
  allowFileUploads: boolean;
  allowRobotInteractions: boolean;
  autoArchiveAfterDays?: number;
  escalationSettings?: EscalationSettings;
}

interface EscalationSettings {
  allowEscalation: boolean;
  currentLevel: 'T1' | 'T2' | 'T3';
  maxEscalationLevel: 'T1' | 'T2' | 'T3';
  escalationTimeoutMinutes?: number;
}
```

### Participant Roles & Permissions

```typescript
enum ParticipantRole {
  GUEST = 'guest', // Limited access, needs supervision
  MEMBER = 'member', // Standard employee access
  MODERATOR = 'moderator', // Can manage room and participants
  OBSERVER = 'observer', // Read-only access (for supervisors)
}

interface ParticipantPermissions {
  canSendMessages: boolean;
  canInviteOthers: boolean;
  canRemoveParticipants: boolean;
  canModifyRoomSettings: boolean;
  canInteractWithRobots: boolean;
  canUploadFiles: boolean;
  canSeeMessageHistory: boolean;
  canEscalateIssues: boolean;
}

// Default permissions by role
const DEFAULT_PERMISSIONS: Record<ParticipantRole, ParticipantPermissions> = {
  [ParticipantRole.GUEST]: {
    canSendMessages: true,
    canInviteOthers: false,
    canRemoveParticipants: false,
    canModifyRoomSettings: false,
    canInteractWithRobots: false, // Employees must mediate
    canUploadFiles: true,
    canSeeMessageHistory: true,
    canEscalateIssues: false,
  },
  [ParticipantRole.MEMBER]: {
    canSendMessages: true,
    canInviteOthers: true,
    canRemoveParticipants: false,
    canModifyRoomSettings: false,
    canInteractWithRobots: true,
    canUploadFiles: true,
    canSeeMessageHistory: true,
    canEscalateIssues: true,
  },
  // ... other roles
};
```

## Implementation Strategy

### Phase 1: Basic Room Operations (Week 1)

1. Create room service with CRUD operations
2. Implement participant management
3. Add role-based permission system
4. Create room invitation system
5. Build basic access control

### Phase 2: Business Rules Enforcement (Week 1-2)

1. Implement guest protection rules
2. Add room access validation
3. Create supervisor monitoring capabilities
4. Build room capacity enforcement
5. Add permission validation middleware

### Phase 3: Advanced Features (Week 2)

1. Implement issue tracking integration
2. Add room archival and cleanup
3. Create room discovery and search
4. Build room analytics and reporting
5. Add room template system

### Phase 4: Integration & Testing (Week 2-3)

1. Integrate with WebSocket events
2. Add real-time participant updates
3. Implement comprehensive testing
4. Performance optimization
5. Security audit and validation

## Room Lifecycle Events

### WebSocket Events

```typescript
// Server → Client events
'room:created' | 'room:updated' | 'room:archived';
'room:participant:joined' |
  'room:participant:left' |
  'room:participant:role_changed';
'room:settings:updated' | 'room:access:granted' | 'room:access:denied';
'room:violation:guest_alone' | 'room:escalation:created';

// Client → Server events
'room:create' | 'room:join' | 'room:leave' | 'room:invite';
'room:settings:update' | 'room:participant:remove' | 'room:archive';
```

### Event Handlers

```typescript
@SubscribeMessage('room:join')
@UseGuards(WsGuard)
async handleRoomJoin(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { roomId: string }
): Promise<void> {

  // Validate permissions
  const canJoin = await this.roomService.canUserJoinRoom(client.userId, data.roomId);
  if (!canJoin) {
    throw new WsException('Access denied to room');
  }

  // Join room
  await this.roomService.joinRoom(client.userId, data.roomId);

  // Add to WebSocket room
  client.join(data.roomId);

  // Notify other participants
  client.to(data.roomId).emit('room:participant:joined', {
    userId: client.userId,
    roomId: data.roomId,
    timestamp: new Date()
  });

  // Check guest protection after join
  await this.roomService.enforceGuestProtection(data.roomId);
}
```

## Guest Protection Implementation

### Monitoring System

```typescript
@Injectable()
export class GuestProtectionService {
  async monitorRoomForGuestViolations(roomId: string): Promise<void> {
    const participants = await this.roomService.getActiveParticipants(roomId);

    const guests = participants.filter((p) => p.role === ParticipantRole.GUEST);
    const employees = participants.filter(
      (p) => p.role !== ParticipantRole.GUEST,
    );

    if (guests.length > 0 && employees.length === 0) {
      await this.handleGuestViolation(roomId, guests);
    }
  }

  private async handleGuestViolation(
    roomId: string,
    guests: Participant[],
  ): Promise<void> {
    // Log violation
    this.logger.warn(`Guest protection violation in room ${roomId}`, {
      guests,
    });

    // Notify supervisors
    await this.notificationService.notifySupervisors({
      type: 'GUEST_PROTECTION_VIOLATION',
      roomId,
      guestUserIds: guests.map((g) => g.userId),
      timestamp: new Date(),
    });

    // Remove guests or add employee moderator
    for (const guest of guests) {
      await this.roomService.removeParticipant(
        roomId,
        guest.userId,
        'GUEST_PROTECTION_VIOLATION',
      );
    }
  }
}
```

### Real-time Monitoring

```typescript
// Monitor participant changes
@EventEmitter('room.participant.left')
async onParticipantLeft(event: { roomId: string, userId: string, userRole: ParticipantRole }): void {
  if (event.userRole !== ParticipantRole.GUEST) {
    // An employee left, check for guest protection
    await this.guestProtectionService.monitorRoomForGuestViolations(event.roomId);
  }
}
```

## Issue Management Integration

### Issue-Centric Rooms

```typescript
interface IssueRoom {
  roomId: string;
  issueId: string;
  issueTitle: string;
  issueDescription?: string;
  issueStatus: 'open' | 'in_progress' | 'resolved' | 'escalated';
  priority: 1 | 2 | 3 | 4 | 5; // 1=highest
  assignedTo?: string;
  customerUserId?: string;
  supportLevel: 'T1' | 'T2' | 'T3';
}

@Injectable()
export class IssueRoomService {
  async createIssueRoom(issueData: CreateIssueDto): Promise<IssueRoom> {
    // Create room with issue context
    const room = await this.roomService.createRoom(issueData.createdBy, {
      name: `Issue: ${issueData.title}`,
      type: RoomType.SUPPORT,
      settings: {
        allowGuestAccess: true,
        requireModeration: true,
        allowRobotInteractions: true,
        escalationSettings: {
          allowEscalation: true,
          currentLevel: 'T1',
          maxEscalationLevel: 'T3',
        },
      },
    });

    // Link to issue tracking system
    return this.createIssueRoomMapping(room.id, issueData);
  }
}
```

## Security & Access Control

### Permission Validation

```typescript
@Injectable()
export class RoomAccessService {
  async validateRoomAccess(
    userId: string,
    roomId: string,
    action: string,
  ): Promise<boolean> {
    // Check user permissions
    const userPermissions =
      await this.permissionService.getUserPermissions(userId);

    // Check room-specific rules
    const room = await this.roomService.findById(roomId);
    const participant = await this.roomService.getParticipant(roomId, userId);

    // Apply business rules
    return this.applyAccessRules(userPermissions, room, participant, action);
  }

  private applyAccessRules(
    permissions: string[],
    room: Room,
    participant: Participant | null,
    action: string,
  ): boolean {
    // Room privacy rules
    if (room.isPrivate && !participant) {
      return false; // Must be invited to private rooms
    }

    // Guest-specific rules
    if (participant?.role === ParticipantRole.GUEST) {
      // Guests cannot perform certain actions
      const restrictedActions = [
        'room:invite',
        'room:settings:update',
        'robot:interact',
      ];
      if (restrictedActions.includes(action)) {
        return false;
      }
    }

    // Permission-based validation
    return permissions.includes(`chat:${action}`);
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('RoomService', () => {
  describe('Guest Protection', () => {
    it('should remove guests when no employees present', async () => {
      // Test guest protection enforcement
    });

    it('should prevent guests from joining rooms alone', async () => {
      // Test join prevention
    });
  });

  describe('Access Control', () => {
    it('should enforce private room access', async () => {
      // Test private room restrictions
    });

    it('should validate user permissions', async () => {
      // Test permission checking
    });
  });
});
```

### Integration Tests

- Full room lifecycle testing
- Guest protection scenarios
- Permission enforcement validation
- WebSocket event handling
- Multi-user interaction scenarios

## Monitoring & Analytics

### Room Metrics

- Active rooms count
- Participant distribution
- Guest protection violations
- Room utilization rates
- Average room duration

### Alerts

- Guest protection violations
- Unusual room activity
- Permission violations
- Room capacity issues

## Success Criteria

- [ ] Guests never left alone in rooms
- [ ] Role-based permissions properly enforced
- [ ] Supervisor monitoring capabilities functional
- [ ] Room lifecycle management complete
- [ ] Issue-centric room creation working
- [ ] Real-time participant updates operational
- [ ] Comprehensive access control validation
- [ ] > 90% test coverage with integration tests
