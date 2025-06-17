# Robot Integration & AI Services Plan

## Overview

AI robot integration system supporting diagnostic tools and development robots, with employee-mediated guest interactions and observation-based context.

## Implementation Order

**Priority: 7**
**Dependencies: 11001-authentication, 11015-room-management, 11020-message-processing**
**Required Before: Escalation system**

## Features Included

### 1. Robot Framework

- Pluggable robot architecture
- Robot registration and discovery
- Request/response handling
- Error handling and timeouts
- Performance monitoring

### 2. Required Robots

- **iStackBuddy.forms.diagnostics** (Production)
- **iStackBuddy.docs.jokes** (Development)
- **iStackBuddy.fsid.jokes** (Development)
- **iStackBuddy.stream.jokes** (Development)
- **iStackBuddy.sign.jokes** (Development)

### 3. Guest Interaction Control

- Employee-only robot access
- Guest interaction mediation
- Selective response sharing
- Privacy and security controls

### 4. Observation System

- ObservationMakers integration
- Context-aware robot responses
- Diagnostic data collection
- System state monitoring

## Robot Architecture

### Core Robot Interface

```typescript
interface ChatRobot {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: RobotCapability[];
  isProductionReady: boolean;
  requiresObservations: boolean;
  supportedMessageTypes: MessageType[];
}

interface RobotCapability {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  estimatedProcessingTimeMs: number;
  requiresEmployeePermission: boolean;
}

interface RobotRequest {
  robotId: string;
  capability: string;
  requestData: any;
  observations?: ObservationResult;
  context: RobotContext;
  requestId: string;
  priority: 'low' | 'normal' | 'high';
}

interface RobotContext {
  userId: string;
  roomId: string;
  messageId: string;
  userRole: ParticipantRole;
  roomSettings: any;
  previousInteractions?: RobotInteraction[];
}
```

### Robot Service Implementation

```typescript
@Injectable()
export class RobotService {
  @RequirePermissions('chat:robot:interact')
  async invokeRobot(
    userId: string,
    robotRequest: RobotRequestDto,
  ): Promise<RobotResponse> {
    // Validate robot access
    await this.validateRobotAccess(userId, robotRequest);

    // Check user role and apply restrictions
    const userRole = await this.roomService.getUserRole(
      userId,
      robotRequest.roomId,
    );
    if (userRole === ParticipantRole.GUEST) {
      throw new ForbiddenException(
        'Guests cannot directly interact with robots',
      );
    }

    // Gather observations if required
    const observations = await this.gatherObservations(robotRequest);

    // Create robot interaction record
    const interaction = await this.createInteraction(
      userId,
      robotRequest,
      observations,
    );

    // Process robot request
    const response = await this.processRobotRequest(interaction);

    // Handle response based on context
    await this.handleRobotResponse(interaction, response);

    return response;
  }

  private async validateRobotAccess(
    userId: string,
    request: RobotRequestDto,
  ): Promise<void> {
    // Check room access
    const canAccess = await this.roomService.canUserAccessRoom(
      userId,
      request.roomId,
    );
    if (!canAccess) {
      throw new ForbiddenException('Cannot access room for robot interaction');
    }

    // Check robot availability
    const robot = await this.robotRegistry.getRobot(request.robotId);
    if (!robot) {
      throw new NotFoundException('Robot not found');
    }

    // Check capability exists
    const capability = robot.capabilities.find(
      (c) => c.name === request.capability,
    );
    if (!capability) {
      throw new BadRequestException('Robot capability not found');
    }

    // Validate request against schema
    await this.validateRequestSchema(
      request.requestData,
      capability.inputSchema,
    );
  }
}
```

## Robot Implementations

### Production Robot: Forms Diagnostics

```typescript
@Robot({
  id: 'iStackBuddy.forms.diagnostics',
  name: 'Forms Diagnostic Tool',
  description:
    'Analyzes form configurations and provides diagnostic information',
  version: '1.0.0',
  isProductionReady: true,
  requiresObservations: true,
})
export class FormsDiagnosticsRobot implements ChatRobot {
  @RobotCapability({
    name: 'analyzeForms',
    description: 'Analyze form configuration for issues and recommendations',
    requiresEmployeePermission: true,
  })
  async analyzeForms(
    request: FormsAnalysisRequest,
  ): Promise<FormsAnalysisResponse> {
    // Extract form data from observations
    const formData = this.extractFormData(request.observations);

    // Perform diagnostic analysis
    const diagnostics = await this.performFormAnalysis(formData);

    // Generate recommendations
    const recommendations = this.generateRecommendations(diagnostics);

    return {
      diagnostics,
      recommendations,
      severity: this.calculateSeverity(diagnostics),
      processingTime: Date.now() - request.startTime,
    };
  }

  private extractFormData(observations: ObservationResult): FormConfiguration {
    // Process observation data to extract form configurations
    const formObservations = observations.filter(
      (obs) => obs.type === 'form_configuration',
    );

    return {
      formFields: this.parseFormFields(formObservations),
      validationRules: this.parseValidationRules(formObservations),
      submissionHandlers: this.parseSubmissionHandlers(formObservations),
      securitySettings: this.parseSecuritySettings(formObservations),
    };
  }

  private async performFormAnalysis(
    formData: FormConfiguration,
  ): Promise<DiagnosticResult[]> {
    const diagnostics: DiagnosticResult[] = [];

    // Check for common issues
    diagnostics.push(...(await this.checkValidationIssues(formData)));
    diagnostics.push(...(await this.checkSecurityIssues(formData)));
    diagnostics.push(...(await this.checkPerformanceIssues(formData)));
    diagnostics.push(...(await this.checkAccessibilityIssues(formData)));

    return diagnostics;
  }
}
```

### Development Robot: Joke Generators

```typescript
@Robot({
  id: 'iStackBuddy.stream.jokes',
  name: 'Stream Jokes Generator',
  description: 'Generates context-aware dad jokes for development and testing',
  version: '1.0.0',
  isProductionReady: false,
  requiresObservations: true,
})
export class StreamJokesRobot implements ChatRobot {
  @RobotCapability({
    name: 'getOneDadJoke',
    description: 'Generate a dad joke with customer context and observations',
    requiresEmployeePermission: false,
  })
  async getOneDadJoke(request: JokeRequest): Promise<JokeResponse> {
    const { customerName, observations } = request;

    // Extract context from observations
    const context = this.extractJokeContext(observations);

    // Generate contextual joke
    const joke = await this.generateContextualJoke(customerName, context);

    return {
      joke,
      context: context.summary,
      customerName,
      timestamp: new Date(),
      robotId: this.id,
    };
  }

  private extractJokeContext(observations: ObservationResult): JokeContext {
    // Extract relevant context for joke generation
    const techStack = observations
      .filter((obs) => obs.type === 'technology')
      .map((obs) => obs.value);

    const userActivity = observations
      .filter((obs) => obs.type === 'user_activity')
      .map((obs) => obs.value);

    const systemState = observations
      .filter((obs) => obs.type === 'system_state')
      .map((obs) => obs.value);

    return {
      technologies: techStack,
      activities: userActivity,
      systemStates: systemState,
      summary: this.generateContextSummary(
        techStack,
        userActivity,
        systemState,
      ),
    };
  }

  private async generateContextualJoke(
    customerName: string,
    context: JokeContext,
  ): Promise<string> {
    // Use AI service to generate contextual joke
    const prompt = this.buildJokePrompt(customerName, context);
    const joke = await this.aiService.generateText(prompt, {
      maxTokens: 150,
      temperature: 0.8,
      model: 'gpt-4',
    });

    return this.cleanupJoke(joke);
  }

  private buildJokePrompt(customerName: string, context: JokeContext): string {
    return `
      Generate a clean, family-friendly dad joke for ${customerName}.
      
      Context to include:
      - Technologies: ${context.technologies.join(', ')}
      - Recent activities: ${context.activities.join(', ')}
      - System state: ${context.systemStates.join(', ')}
      
      Make it relevant to their situation but keep it light and appropriate for a professional support environment.
      The joke should be a classic "dad joke" style - cheesy and groan-worthy.
    `;
  }
}
```

## Observation System Integration

### ObservationMakers Framework

```typescript
interface ObservationMaker {
  id: string;
  name: string;
  description: string;
  observationTypes: string[];
  collectObservations(context: ObservationContext): Promise<Observation[]>;
}

interface ObservationContext {
  userId: string;
  roomId: string;
  requestType: string;
  timeRange?: { start: Date; end: Date };
  includePersonalData?: boolean;
}

interface Observation {
  id: string;
  type: string;
  value: any;
  confidence: number;
  timestamp: Date;
  source: string;
  metadata?: any;
}

interface ObservationResult {
  observations: Observation[];
  collectedAt: Date;
  context: ObservationContext;
  summary: string;
}

@Injectable()
export class ObservationService {
  async gatherObservations(
    context: ObservationContext,
  ): Promise<ObservationResult> {
    const makers = await this.getRelevantObservationMakers(context);

    const observations: Observation[] = [];

    for (const maker of makers) {
      try {
        const makerObservations = await maker.collectObservations(context);
        observations.push(...makerObservations);
      } catch (error) {
        this.logger.warn(
          `Observation maker ${maker.id} failed: ${error.message}`,
        );
      }
    }

    return {
      observations,
      collectedAt: new Date(),
      context,
      summary: this.generateObservationSummary(observations),
    };
  }

  private async getRelevantObservationMakers(
    context: ObservationContext,
  ): Promise<ObservationMaker[]> {
    // Return appropriate observation makers based on context
    const makers: ObservationMaker[] = [];

    // Always include basic system observers
    makers.push(new SystemStateObservationMaker());
    makers.push(new UserActivityObservationMaker());

    // Add request-specific observers
    if (context.requestType === 'forms_diagnostics') {
      makers.push(new FormConfigurationObservationMaker());
      makers.push(new FormDataObservationMaker());
    }

    if (context.requestType.includes('jokes')) {
      makers.push(new TechnologyStackObservationMaker());
      makers.push(new UserPreferencesObservationMaker());
    }

    return makers;
  }
}

// Example ObservationMaker implementation
@ObservationMaker({
  id: 'system_state',
  name: 'System State Observer',
  description: 'Collects current system performance and status information',
})
export class SystemStateObservationMaker implements ObservationMaker {
  async collectObservations(
    context: ObservationContext,
  ): Promise<Observation[]> {
    const observations: Observation[] = [];

    // Collect system metrics
    const metrics = await this.metricsService.getCurrentMetrics();

    observations.push({
      id: uuidv4(),
      type: 'system_performance',
      value: {
        cpuUsage: metrics.cpu,
        memoryUsage: metrics.memory,
        responseTime: metrics.avgResponseTime,
      },
      confidence: 1.0,
      timestamp: new Date(),
      source: 'system_monitor',
      metadata: { collectionMethod: 'real_time' },
    });

    // Collect active connections
    const connectionCount =
      await this.connectionService.getActiveConnectionCount();

    observations.push({
      id: uuidv4(),
      type: 'system_load',
      value: { activeConnections: connectionCount },
      confidence: 1.0,
      timestamp: new Date(),
      source: 'connection_monitor',
    });

    return observations;
  }
}
```

## Guest Interaction Mediation

### Employee-Mediated Robot Access

```typescript
@Injectable()
export class RobotMediationService {
  async requestRobotInteractionForGuest(
    employeeId: string,
    guestId: string,
    roomId: string,
    robotRequest: RobotRequestDto,
  ): Promise<MediatedRobotInteraction> {
    // Validate employee can mediate for guest
    await this.validateMediationPermissions(employeeId, guestId, roomId);

    // Execute robot request on behalf of guest
    const robotResponse = await this.robotService.invokeRobot(employeeId, {
      ...robotRequest,
      context: {
        ...robotRequest.context,
        originalRequesterId: guestId,
        mediatedBy: employeeId,
      },
    });

    // Create mediated interaction record
    const mediatedInteraction = await this.createMediatedInteraction(
      employeeId,
      guestId,
      robotRequest,
      robotResponse,
    );

    // Employee can choose what to share with guest
    return mediatedInteraction;
  }

  async shareRobotResponseWithGuest(
    employeeId: string,
    interactionId: string,
    shareOptions: ShareOptions,
  ): Promise<void> {
    const interaction = await this.findMediatedInteraction(interactionId);

    // Validate employee owns this interaction
    if (interaction.mediatedBy !== employeeId) {
      throw new ForbiddenException(
        'Cannot share interaction you did not mediate',
      );
    }

    // Filter response based on share options
    const filteredResponse = this.filterResponseForGuest(
      interaction.robotResponse,
      shareOptions,
    );

    // Create message visible to guest
    await this.messageService.sendMessage(employeeId, {
      roomId: interaction.roomId,
      type: MessageType.ROBOT,
      content: filteredResponse,
      metadata: {
        robotInteraction: {
          originalInteractionId: interactionId,
          sharedWithGuest: true,
          shareOptions,
        },
      },
    });
  }

  private filterResponseForGuest(
    response: RobotResponse,
    shareOptions: ShareOptions,
  ): any {
    // Remove sensitive information based on share options
    const filtered = { ...response };

    if (!shareOptions.includeTechnicalDetails) {
      delete filtered.diagnostics;
      delete filtered.systemInformation;
    }

    if (!shareOptions.includeRecommendations) {
      delete filtered.recommendations;
    }

    // Always remove internal processing information
    delete filtered.processingMetadata;
    delete filtered.observationData;

    return filtered;
  }
}
```

### Guest Interaction UI Flow

```typescript
// Example WebSocket events for guest interaction mediation

// Guest requests robot assistance (indirectly)
'guest:request:robot_help' → Employee gets notification
// Employee decides to invoke robot
'employee:robot:invoke_for_guest' → Robot processes request
// Employee reviews response
'employee:robot:response_received' → Employee can share selectively
// Employee shares filtered response
'employee:share:robot_response' → Guest receives filtered information
```

## Robot Registry & Discovery

### Robot Registration System

```typescript
@Injectable()
export class RobotRegistry {
  async registerRobot(robot: ChatRobot): Promise<void> {
    // Validate robot implementation
    await this.validateRobotImplementation(robot);

    // Store robot metadata
    await this.robotRepository.save({
      id: robot.id,
      name: robot.name,
      description: robot.description,
      version: robot.version,
      capabilities: robot.capabilities,
      isProductionReady: robot.isProductionReady,
      requiresObservations: robot.requiresObservations,
      registeredAt: new Date(),
      status: 'active',
    });

    // Register capabilities
    for (const capability of robot.capabilities) {
      await this.capabilityRepository.save({
        robotId: robot.id,
        name: capability.name,
        description: capability.description,
        inputSchema: capability.inputSchema,
        outputSchema: capability.outputSchema,
        estimatedProcessingTimeMs: capability.estimatedProcessingTimeMs,
        requiresEmployeePermission: capability.requiresEmployeePermission,
      });
    }

    this.logger.log(`Robot ${robot.id} registered successfully`);
  }

  async discoverAvailableRobots(
    userId: string,
    roomId: string,
  ): Promise<RobotInfo[]> {
    const userRole = await this.roomService.getUserRole(userId, roomId);

    const robots = await this.robotRepository.find({
      where: { status: 'active' },
    });

    // Filter based on user permissions
    return robots.filter((robot) => {
      if (userRole === ParticipantRole.GUEST) {
        // Guests cannot directly access robots
        return false;
      }

      if (!robot.isProductionReady && userRole !== ParticipantRole.MODERATOR) {
        // Non-production robots only for moderators
        return false;
      }

      return true;
    });
  }
}
```

## Error Handling & Monitoring

### Robot Performance Monitoring

```typescript
@Injectable()
export class RobotMonitoringService {
  async trackRobotInteraction(interaction: RobotInteraction): Promise<void> {
    // Track performance metrics
    await this.metricsService.record(
      'robot.interaction.duration',
      interaction.processingTimeMs,
      {
        robotId: interaction.robotId,
        capability: interaction.capability,
        success: interaction.status === 'completed',
      },
    );

    // Track error rates
    if (interaction.status === 'failed') {
      await this.metricsService.increment('robot.interaction.errors', {
        robotId: interaction.robotId,
        errorType: interaction.errorMessage ? 'processing' : 'timeout',
      });
    }

    // Track usage patterns
    await this.analyticsService.track('robot_usage', {
      robotId: interaction.robotId,
      userId: interaction.requestedBy,
      roomId: interaction.roomId,
      timestamp: interaction.createdAt,
    });
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async checkRobotHealth(): Promise<void> {
    const robots = await this.robotRegistry.getActiveRobots();

    for (const robot of robots) {
      try {
        // Perform health check
        const healthResult = await this.performHealthCheck(robot);

        if (!healthResult.healthy) {
          await this.handleUnhealthyRobot(robot, healthResult);
        }
      } catch (error) {
        this.logger.error(
          `Health check failed for robot ${robot.id}: ${error.message}`,
        );
      }
    }
  }

  private async performHealthCheck(
    robot: ChatRobot,
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple ping-style health check
      const response = await this.robotService.invokeRobot('system', {
        robotId: robot.id,
        capability: 'health_check',
        requestData: { timestamp: startTime },
        context: { isHealthCheck: true },
      });

      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        responseTimeMs: responseTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastChecked: new Date(),
      };
    }
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('RobotService', () => {
  describe('Robot Invocation', () => {
    it('should prevent guest direct access to robots', async () => {
      // Test guest restriction
    });

    it('should gather observations when required', async () => {
      // Test observation collection
    });

    it('should handle robot timeouts gracefully', async () => {
      // Test timeout handling
    });
  });

  describe('Response Mediation', () => {
    it('should allow employees to share filtered responses', async () => {
      // Test response filtering
    });

    it('should track mediated interactions', async () => {
      // Test audit trail
    });
  });
});
```

### Integration Tests

- End-to-end robot interaction flow
- Observation system integration
- Guest mediation workflows
- Performance under load
- Error handling scenarios

## Success Criteria

- [ ] All required robots implemented and functional
- [ ] Guest access properly mediated by employees
- [ ] Observation system providing contextual data
- [ ] Robot responses filtered appropriately for guests
- [ ] Performance monitoring and health checks active
- [ ] Error handling graceful and informative
- [ ] Robot registry and discovery working
- [ ] > 90% test coverage with integration testing
