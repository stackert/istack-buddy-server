# Escalation System Plan

## Overview

Support escalation system with T1→T2→T3 progression, room management, and conversation conclusion tracking to ensure proper issue resolution.

## Implementation Order

**Priority: 8 (Final Core Feature)**
**Dependencies: 11001-authentication, 11015-room-management, 11020-message-processing**
**Required Before: System deployment**

## Features Included

### 1. Escalation Management

- T1 → T2 → T3 support level progression
- Escalation criteria and triggers
- Automatic and manual escalation
- Escalation history and tracking

### 2. Room Transition Handling

- Create new rooms during escalation
- Transfer conversation context
- Maintain participant continuity
- Access control updates

### 3. Support Level Management

- Support tier definitions and capabilities
- Staff assignment and availability
- Workload balancing
- Performance tracking

### 4. Conversation Conclusion

- Issue resolution tracking
- Conclusion states (escalated, resolved, unresolved, guest-disengaged)
- Satisfaction surveys
- Post-resolution follow-up

## Escalation Architecture

### Support Level Definitions

```typescript
enum SupportLevel {
  T1 = 'T1', // First-line support (basic issues)
  T2 = 'T2', // Advanced support (technical issues)
  T3 = 'T3', // Expert support (complex/critical issues)
  MANAGER = 'manager', // Management escalation
}

interface SupportTier {
  level: SupportLevel;
  name: string;
  description: string;
  capabilities: string[];
  maxConcurrentCases: number;
  averageResolutionTimeHours: number;
  escalationThresholds: EscalationThresholds;
}

interface EscalationThresholds {
  timeBasedEscalationMinutes: number;
  complexityScore: number;
  customerFrustrationIndicators: string[];
  technicalComplexityMarkers: string[];
}

const SUPPORT_TIERS: Record<SupportLevel, SupportTier> = {
  [SupportLevel.T1]: {
    level: SupportLevel.T1,
    name: 'First Line Support',
    description: 'Basic troubleshooting and common issues',
    capabilities: [
      'basic_troubleshooting',
      'account_issues',
      'password_reset',
      'general_inquiries',
    ],
    maxConcurrentCases: 8,
    averageResolutionTimeHours: 2,
    escalationThresholds: {
      timeBasedEscalationMinutes: 30,
      complexityScore: 3,
      customerFrustrationIndicators: ['frustrated', 'angry', 'urgent'],
      technicalComplexityMarkers: ['api', 'integration', 'custom_code'],
    },
  },
  [SupportLevel.T2]: {
    level: SupportLevel.T2,
    name: 'Technical Support',
    description: 'Advanced technical troubleshooting and system issues',
    capabilities: [
      'advanced_troubleshooting',
      'system_configuration',
      'api_support',
      'integration_help',
    ],
    maxConcurrentCases: 5,
    averageResolutionTimeHours: 4,
    escalationThresholds: {
      timeBasedEscalationMinutes: 120,
      complexityScore: 7,
      customerFrustrationIndicators: [
        'escalation_requested',
        'manager_contact',
      ],
      technicalComplexityMarkers: [
        'architecture_design',
        'performance_optimization',
        'security_incident',
      ],
    },
  },
  [SupportLevel.T3]: {
    level: SupportLevel.T3,
    name: 'Expert Support',
    description: 'Complex technical issues and architectural guidance',
    capabilities: [
      'expert_troubleshooting',
      'architecture_review',
      'performance_tuning',
      'security_analysis',
    ],
    maxConcurrentCases: 3,
    averageResolutionTimeHours: 8,
    escalationThresholds: {
      timeBasedEscalationMinutes: 480,
      complexityScore: 10,
      customerFrustrationIndicators: ['legal_threat', 'contract_cancellation'],
      technicalComplexityMarkers: [
        'core_system_bug',
        'data_loss',
        'security_breach',
      ],
    },
  },
};
```

### Escalation Service Implementation

```typescript
@Injectable()
export class EscalationService {
  @RequirePermissions('chat:escalation:create')
  async createEscalation(
    requestedBy: string,
    escalationData: CreateEscalationDto,
  ): Promise<Escalation> {
    // Validate escalation request
    await this.validateEscalationRequest(requestedBy, escalationData);

    // Determine target support level
    const targetLevel = this.determineTargetLevel(escalationData);

    // Find available agent at target level
    const assignedAgent = await this.findAvailableAgent(targetLevel);

    // Create escalation record
    const escalation = await this.createEscalationRecord(
      requestedBy,
      escalationData,
      targetLevel,
      assignedAgent,
    );

    // Handle room transition
    const targetRoom = await this.handleRoomTransition(escalation);

    // Transfer context and participants
    await this.transferConversationContext(escalation, targetRoom);

    // Notify stakeholders
    await this.notifyEscalationStakeholders(escalation);

    return escalation;
  }

  private async validateEscalationRequest(
    requestedBy: string,
    escalationData: CreateEscalationDto,
  ): Promise<void> {
    // Check user can escalate from source room
    const canEscalate = await this.roomService.canUserEscalate(
      requestedBy,
      escalationData.sourceRoomId,
    );

    if (!canEscalate) {
      throw new ForbiddenException('Cannot escalate from this room');
    }

    // Validate escalation reason
    if (!escalationData.reason || escalationData.reason.trim().length < 10) {
      throw new BadRequestException(
        'Escalation reason required (minimum 10 characters)',
      );
    }

    // Check if room can be escalated (not already at highest level)
    const sourceRoom = await this.roomService.findById(
      escalationData.sourceRoomId,
    );
    if (sourceRoom.escalationLevel >= 3) {
      throw new BadRequestException('Room already at highest escalation level');
    }
  }

  private determineTargetLevel(
    escalationData: CreateEscalationDto,
  ): SupportLevel {
    const sourceRoom = escalationData.sourceRoom;

    // Basic escalation: T1 → T2 → T3
    switch (sourceRoom.escalationLevel) {
      case 1:
        return SupportLevel.T2;
      case 2:
        return SupportLevel.T3;
      case 3:
        return SupportLevel.MANAGER;
      default:
        return SupportLevel.T2; // Default to T2 if unclear
    }
  }

  private async findAvailableAgent(
    targetLevel: SupportLevel,
  ): Promise<User | null> {
    // Get agents at target support level
    const availableAgents =
      await this.staffService.getAvailableAgents(targetLevel);

    if (availableAgents.length === 0) {
      // No agents available, will queue escalation
      return null;
    }

    // Select agent with lowest current workload
    return this.selectOptimalAgent(availableAgents);
  }

  private async handleRoomTransition(
    escalation: Escalation,
  ): Promise<ChatRoom> {
    // Option 1: Create new room for escalation
    if (escalation.createNewRoom) {
      return await this.createEscalationRoom(escalation);
    }

    // Option 2: Upgrade existing room
    return await this.upgradeExistingRoom(escalation);
  }

  private async createEscalationRoom(
    escalation: Escalation,
  ): Promise<ChatRoom> {
    const sourceRoom = await this.roomService.findById(escalation.sourceRoomId);

    const newRoom = await this.roomService.createRoom(
      escalation.assignedToUserId,
      {
        name: `${sourceRoom.name} - Escalated to ${escalation.toLevel}`,
        description: `Escalated from ${escalation.fromLevel}: ${escalation.escalationReason}`,
        type: RoomType.ESCALATED,
        settings: {
          allowGuestAccess: sourceRoom.settings.allowGuestAccess,
          requireModeration: true,
          allowRobotInteractions: true,
          escalationSettings: {
            allowEscalation: escalation.toLevel !== SupportLevel.T3,
            currentLevel: escalation.toLevel,
            maxEscalationLevel: SupportLevel.T3,
            escalationTimeoutMinutes:
              SUPPORT_TIERS[escalation.toLevel].escalationThresholds
                .timeBasedEscalationMinutes,
          },
        },
        parentRoomId: sourceRoom.id,
        escalationLevel: this.getLevelNumber(escalation.toLevel),
      },
    );

    // Update escalation with target room
    await this.escalationRepository.update(escalation.id, {
      targetRoomId: newRoom.id,
    });

    return newRoom;
  }

  private async transferConversationContext(
    escalation: Escalation,
    targetRoom: ChatRoom,
  ): Promise<void> {
    // Transfer key participants (customer + assigned agent)
    await this.transferParticipants(escalation, targetRoom);

    // Create context summary message
    await this.createContextSummaryMessage(escalation, targetRoom);

    // Transfer relevant files
    await this.transferRelevantFiles(escalation, targetRoom);

    // Update issue tracking
    await this.updateIssueTracking(escalation, targetRoom);
  }

  private async createContextSummaryMessage(
    escalation: Escalation,
    targetRoom: ChatRoom,
  ): Promise<void> {
    // Generate escalation summary
    const summary = await this.generateEscalationSummary(escalation);

    // Create system message with context
    await this.messageService.sendMessage('system', {
      roomId: targetRoom.id,
      type: MessageType.SYSTEM,
      content: summary,
      metadata: {
        systemEventType: 'escalation_created',
        relatedEntityId: escalation.id,
        escalationContext: {
          fromLevel: escalation.fromLevel,
          toLevel: escalation.toLevel,
          reason: escalation.escalationReason,
          sourceRoomId: escalation.sourceRoomId,
        },
      },
    });
  }
}
```

## Automatic Escalation Triggers

### Time-Based Escalation

```typescript
@Injectable()
export class AutoEscalationService {
  @Cron('*/5 * * * *') // Check every 5 minutes
  async checkForAutoEscalations(): Promise<void> {
    const activeRooms = await this.roomService.getActiveIssueRooms();

    for (const room of activeRooms) {
      await this.evaluateRoomForEscalation(room);
    }
  }

  private async evaluateRoomForEscalation(room: ChatRoom): Promise<void> {
    const currentLevel = this.getSupportLevelFromRoom(room);
    const thresholds = SUPPORT_TIERS[currentLevel].escalationThresholds;

    // Check time-based escalation
    const timeBasedEscalation = await this.checkTimeBasedEscalation(
      room,
      thresholds,
    );

    // Check complexity-based escalation
    const complexityEscalation = await this.checkComplexityEscalation(
      room,
      thresholds,
    );

    // Check sentiment-based escalation
    const sentimentEscalation = await this.checkSentimentEscalation(
      room,
      thresholds,
    );

    if (timeBasedEscalation || complexityEscalation || sentimentEscalation) {
      await this.triggerAutoEscalation(room, {
        timeBasedEscalation,
        complexityEscalation,
        sentimentEscalation,
      });
    }
  }

  private async checkTimeBasedEscalation(
    room: ChatRoom,
    thresholds: EscalationThresholds,
  ): Promise<boolean> {
    const roomAge = Date.now() - room.createdAt.getTime();
    const thresholdMs = thresholds.timeBasedEscalationMinutes * 60 * 1000;

    // Check if room has been active beyond threshold without resolution
    if (roomAge > thresholdMs) {
      // Verify there's been recent activity (not abandoned)
      const recentActivity = await this.messageService.hasRecentActivity(
        room.id,
        10, // minutes
      );

      return recentActivity;
    }

    return false;
  }

  private async checkComplexityEscalation(
    room: ChatRoom,
    thresholds: EscalationThresholds,
  ): Promise<boolean> {
    // Analyze conversation for complexity indicators
    const messages = await this.messageService.getRoomMessages(room.id);
    const complexityScore = await this.calculateComplexityScore(messages);

    return complexityScore >= thresholds.complexityScore;
  }

  private async calculateComplexityScore(messages: Message[]): Promise<number> {
    let score = 0;

    for (const message of messages) {
      // Technical keywords increase complexity
      const technicalKeywords = this.countTechnicalKeywords(message.content);
      score += technicalKeywords * 0.5;

      // Multiple robot interactions indicate complexity
      if (message.type === MessageType.ROBOT) {
        score += 1;
      }

      // File attachments may indicate complex issues
      if (message.metadata?.fileAttachments?.length > 0) {
        score += 0.5;
      }

      // Long messages may indicate complex explanations
      if (message.content.length > 500) {
        score += 0.3;
      }
    }

    return Math.min(score, 10); // Cap at 10
  }

  private async checkSentimentEscalation(
    room: ChatRoom,
    thresholds: EscalationThresholds,
  ): Promise<boolean> {
    const recentMessages = await this.messageService.getRecentMessages(
      room.id,
      10,
    );

    for (const message of recentMessages) {
      const sentiment = await this.sentimentAnalysisService.analyze(
        message.content,
      );

      // Check for frustration indicators
      for (const indicator of thresholds.customerFrustrationIndicators) {
        if (
          sentiment.keywords.includes(indicator) ||
          message.content.toLowerCase().includes(indicator)
        ) {
          return true;
        }
      }

      // Check sentiment score
      if (sentiment.score < -0.7) {
        // Very negative sentiment
        return true;
      }
    }

    return false;
  }

  private async triggerAutoEscalation(
    room: ChatRoom,
    triggers: EscalationTriggers,
  ): Promise<void> {
    // Find current agent in room
    const currentAgent = await this.roomService.getCurrentAgent(room.id);

    if (!currentAgent) {
      this.logger.warn(`No agent found for auto-escalation in room ${room.id}`);
      return;
    }

    // Create automatic escalation
    const escalationReason = this.generateAutoEscalationReason(triggers);

    await this.escalationService.createEscalation(currentAgent.id, {
      sourceRoomId: room.id,
      reason: escalationReason,
      isAutomatic: true,
      triggers,
    });
  }
}
```

## Conversation Conclusion System

### Conclusion States Management

```typescript
enum ConversationConclusion {
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved',
  GUEST_DISENGAGED = 'guest-disengaged',
}

interface ConversationConclusionData {
  conclusion: ConversationConclusion;
  resolutionSummary?: string;
  customerSatisfactionScore?: number;
  followUpRequired?: boolean;
  followUpDate?: Date;
  internalNotes?: string;
  resolvedBy?: string;
  timeToResolution?: number;
}

@Injectable()
export class ConversationConclusionService {
  @RequirePermissions('chat:conversation:conclude')
  async concludeConversation(
    userId: string,
    roomId: string,
    conclusionData: ConversationConclusionData,
  ): Promise<void> {
    // Validate user can conclude conversation
    await this.validateConclusionPermissions(userId, roomId);

    // Update room status
    const room = await this.roomService.findById(roomId);
    await this.roomService.updateRoomStatus(roomId, RoomStatus.CLOSED);

    // Record conclusion data
    await this.recordConclusion(room, conclusionData);

    // Handle post-conclusion activities
    await this.handlePostConclusion(room, conclusionData);

    // Send conclusion notifications
    await this.sendConclusionNotifications(room, conclusionData);
  }

  private async recordConclusion(
    room: ChatRoom,
    conclusionData: ConversationConclusionData,
  ): Promise<void> {
    // Calculate metrics
    const timeToResolution = Date.now() - room.createdAt.getTime();

    // Create conclusion record
    await this.conversationConclusionRepository.save({
      roomId: room.id,
      conclusion: conclusionData.conclusion,
      resolutionSummary: conclusionData.resolutionSummary,
      customerSatisfactionScore: conclusionData.customerSatisfactionScore,
      followUpRequired: conclusionData.followUpRequired,
      followUpDate: conclusionData.followUpDate,
      internalNotes: conclusionData.internalNotes,
      resolvedBy: conclusionData.resolvedBy,
      timeToResolutionMs: timeToResolution,
      concludedAt: new Date(),
    });

    // Update analytics
    await this.analyticsService.recordConclusion({
      conclusion: conclusionData.conclusion,
      supportLevel: room.escalationLevel,
      timeToResolution,
      customerSatisfaction: conclusionData.customerSatisfactionScore,
    });
  }

  private async handlePostConclusion(
    room: ChatRoom,
    conclusionData: ConversationConclusionData,
  ): Promise<void> {
    switch (conclusionData.conclusion) {
      case ConversationConclusion.RESOLVED:
        await this.handleResolvedConversation(room, conclusionData);
        break;

      case ConversationConclusion.ESCALATED:
        // Escalation already handled by EscalationService
        break;

      case ConversationConclusion.UNRESOLVED:
        await this.handleUnresolvedConversation(room, conclusionData);
        break;

      case ConversationConclusion.GUEST_DISENGAGED:
        await this.handleGuestDisengagement(room, conclusionData);
        break;
    }
  }

  private async handleResolvedConversation(
    room: ChatRoom,
    conclusionData: ConversationConclusionData,
  ): Promise<void> {
    // Send satisfaction survey to customer
    const guests = await this.roomService.getGuestParticipants(room.id);
    for (const guest of guests) {
      await this.surveyService.sendSatisfactionSurvey(guest.userId, room.id);
    }

    // Schedule follow-up if required
    if (conclusionData.followUpRequired && conclusionData.followUpDate) {
      await this.scheduleFollowUp(room, conclusionData);
    }

    // Update knowledge base if resolution is reusable
    await this.knowledgeBaseService.suggestKnowledgeEntry(room, conclusionData);
  }

  private async handleUnresolvedConversation(
    room: ChatRoom,
    conclusionData: ConversationConclusionData,
  ): Promise<void> {
    // Notify supervisor
    await this.notificationService.notifySupervisors({
      type: 'UNRESOLVED_CONVERSATION',
      roomId: room.id,
      reason: conclusionData.internalNotes,
      supportLevel: room.escalationLevel,
    });

    // Schedule follow-up review
    await this.scheduleFollowUpReview(room, conclusionData);
  }
}
```

## Agent Workload Management

### Workload Balancing

```typescript
@Injectable()
export class WorkloadManagementService {
  async assignEscalationToAgent(
    targetLevel: SupportLevel,
    escalation: Escalation,
  ): Promise<User | null> {
    // Get agents at target level
    const agents = await this.staffService.getAgentsByLevel(targetLevel);

    if (agents.length === 0) {
      return null; // No agents available
    }

    // Calculate current workload for each agent
    const agentWorkloads = await Promise.all(
      agents.map((agent) => this.calculateAgentWorkload(agent)),
    );

    // Find agent with capacity
    const availableAgent = this.selectOptimalAgent(agentWorkloads);

    if (!availableAgent) {
      // Queue escalation if no agent has capacity
      await this.queueEscalation(escalation);
      return null;
    }

    return availableAgent.agent;
  }

  private async calculateAgentWorkload(agent: User): Promise<AgentWorkload> {
    const activeRooms = await this.roomService.getAgentActiveRooms(agent.id);
    const currentLevel = await this.staffService.getAgentSupportLevel(agent.id);
    const maxCapacity = SUPPORT_TIERS[currentLevel].maxConcurrentCases;

    return {
      agent,
      activeRooms: activeRooms.length,
      maxCapacity,
      utilizationPercent: (activeRooms.length / maxCapacity) * 100,
      averageResponseTime: await this.calculateAverageResponseTime(agent.id),
      lastAssignment: await this.getLastAssignmentTime(agent.id),
    };
  }

  private selectOptimalAgent(workloads: AgentWorkload[]): AgentWorkload | null {
    // Filter agents with capacity
    const availableAgents = workloads.filter(
      (w) => w.activeRooms < w.maxCapacity,
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // Sort by utilization (lowest first), then by last assignment (longest ago first)
    return availableAgents.sort((a, b) => {
      if (a.utilizationPercent !== b.utilizationPercent) {
        return a.utilizationPercent - b.utilizationPercent;
      }
      return a.lastAssignment.getTime() - b.lastAssignment.getTime();
    })[0];
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('EscalationService', () => {
  describe('Escalation Creation', () => {
    it('should validate escalation permissions', async () => {
      // Test permission validation
    });

    it('should determine correct target level', async () => {
      // Test level determination logic
    });

    it('should create new rooms for escalations', async () => {
      // Test room creation
    });
  });

  describe('Auto Escalation', () => {
    it('should detect time-based escalation triggers', async () => {
      // Test time-based triggers
    });

    it('should calculate complexity scores correctly', async () => {
      // Test complexity analysis
    });
  });
});
```

### Integration Tests

- Full escalation workflow testing
- Room transition scenarios
- Agent assignment logic
- Conclusion state management
- Workload balancing validation

## Monitoring & Analytics

### Escalation Metrics

- Escalation rates by support level
- Average resolution times
- Customer satisfaction scores
- Agent workload distribution
- Auto-escalation accuracy

### Performance Dashboards

- Real-time escalation queue
- Agent availability and workload
- Conclusion state distribution
- Time-to-resolution trends
- Customer satisfaction trends

## Success Criteria

- [ ] T1→T2→T3 escalation flow operational
- [ ] Automatic escalation triggers working
- [ ] Room transitions preserving context
- [ ] Agent workload balancing functional
- [ ] Conversation conclusions tracked properly
- [ ] Customer satisfaction surveys deployed
- [ ] Performance monitoring active
- [ ] > 90% test coverage with workflow testing
