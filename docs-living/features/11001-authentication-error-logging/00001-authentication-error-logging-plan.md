# Authentication, Error Handling & Logging Implementation Plan

`docs-living/external-project-links` is only meant to be examples

IT WILL BE DELETED - IT WILL NEVER BE A PART OF THIS CODE BASE

WE MAY BORROW CODE, LOOK FOR PATTERNS, LOOK FOR ANTI-PATTERNS - but we will never use it directly.

## Executive Summary

This document provides a detailed implementation plan for the foundational authentication, error handling, and logging systems that must be completed before any chat features can be developed. This is a **greenfield implementation** building the entire chat system from scratch using NestJS best practices and proven patterns from the `how-do-you-know-src` codebase.

## Implementation Priority & Timeline

**Priority: 1 (CRITICAL - Foundation)**
**Dependencies: None**
**Required Before: All chat features (11005+ documents)**
**Estimated Duration: 2-3 weeks**
**Risk Level: MEDIUM (Greenfield with proven patterns)**

## Implementation Strategy & Advantages

### ✅ **Greenfield Benefits: Clean Architecture from Day One**

**Approach**: Building the entire authentication system from scratch using modern NestJS patterns
**Advantages**:

- No legacy security vulnerabilities to inherit or fix
- Clean, testable architecture throughout
- Modern TypeScript and NestJS best practices
- Proper separation of concerns from the start

**Proven Component Reuse Strategy**:

- **`how-do-you-know-src`**: Adapt production-ready permission system, file storage, and database patterns
- **`conversations-server-src`**: Reference examples for WebSocket concepts and room management ideas

### 🎯 **Key Implementation Focuses**

### 1. **Robust WebSocket Authentication**

**Goal**: Implement comprehensive JWT-based WebSocket authentication from scratch
**Approach**: Build proper authentication guard with multiple token source support
**Benefit**: Secure by design, no security gaps to fix

### 2. **Comprehensive Permission System**

**Goal**: Adapt the proven `domain:function:action` pattern from `how-do-you-know-src`
**Approach**: Direct pattern reuse with chat-specific domains
**Benefit**: Battle-tested authorization framework

### 3. **Production-Ready Error Handling**

**Goal**: Centralized error handling for both HTTP and WebSocket contexts
**Approach**: Custom exception classes with proper client error responses
**Benefit**: Consistent error experience across all communication channels

## Detailed Technical Architecture

### 1. Authentication System Implementation

#### 1.1 HTTP Authentication Endpoint

```typescript
// auth.controller.ts - Adapt from how-do-you-know patterns
@Controller('auth')
@UseGuards(RateLimitingGuard) // Prevent brute force
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    // Validate credentials
    // Generate JWT with chat-specific claims
    // Log authentication event
    // Return token + user profile
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(
    @Req() req: AuthenticatedRequest,
  ): Promise<AuthResponseDto> {
    // Validate existing token
    // Issue new token
    // Log refresh event
  }
}
```

#### 1.2 JWT Token Structure (Chat-Specific Claims)

```typescript
interface ChatJwtPayload {
  sub: string; // user ID
  username: string;
  email: string;
  accountType: 'guest' | 'employee' | 'supervisor';
  permissions: string[]; // chat:room:join, etc.
  sessionId: string; // For session management
  iat: number;
  exp: number;
  iss: 'istack-buddy-chat';
}
```

#### 1.3 WebSocket Authentication Guard (Production-Ready Implementation)

```typescript
// websocket-auth.guard.ts - Greenfield Implementation
@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient<AuthenticatedSocket>();

      // Extract token from handshake auth or headers
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn('WebSocket connection attempted without token', {
          clientId: client.id,
          remoteAddress: client.handshake.address,
        });
        return false;
      }

      // Validate JWT token
      const payload = await this.jwtService.verifyAsync<ChatJwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Attach user info to socket
      client.user = {
        id: payload.sub,
        username: payload.username,
        accountType: payload.accountType,
        permissions: payload.permissions,
        sessionId: payload.sessionId,
      };

      this.logger.debug('WebSocket authenticated', {
        userId: payload.sub,
        username: payload.username,
        accountType: payload.accountType,
      });

      return true;
    } catch (error) {
      this.logger.error('WebSocket authentication failed', {
        error: error.message,
        clientId: context.switchToWs().getClient().id,
      });
      return false;
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Try multiple token sources
    const authHeader = client.handshake.auth?.token;
    const queryToken = client.handshake.query?.token;
    const headerToken = client.handshake.headers?.authorization;

    return (
      authHeader ||
      queryToken ||
      (headerToken?.startsWith('Bearer ') ? headerToken.slice(7) : null)
    );
  }
}

// Custom socket interface
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    accountType: 'guest' | 'employee' | 'supervisor';
    permissions: string[];
    sessionId: string;
  };
}
```

#### 1.4 Permission System (Reuse from how-do-you-know)

```typescript
// Direct adaptation from how-do-you-know-src permission system
export const CHAT_PERMISSIONS = {
  // Room management
  ROOM_CREATE: 'chat:room:create',
  ROOM_JOIN: 'chat:room:join',
  ROOM_INVITE: 'chat:room:invite',
  ROOM_LEAVE: 'chat:room:leave',

  // Messaging
  MESSAGE_SEND: 'chat:message:send',
  MESSAGE_VIEW: 'chat:message:view',
  MESSAGE_EDIT: 'chat:message:edit',
  MESSAGE_DELETE: 'chat:message:delete',

  // Robot interaction (EMPLOYEE ONLY)
  ROBOT_INTERACT: 'chat:robot:interact',
  ROBOT_SHARE_RESPONSE: 'chat:robot:share',

  // File operations
  FILE_UPLOAD: 'chat:file:upload',
  FILE_DOWNLOAD: 'chat:file:download',

  // Escalation
  ESCALATION_CREATE: 'chat:escalation:create',
  ESCALATION_ASSIGN: 'chat:escalation:assign',

  // Supervisor functions
  SUPERVISOR_MONITOR: 'supervisor:chat:monitor',
  SUPERVISOR_INTERVENE: 'supervisor:chat:intervene'
} as const;

// Usage in WebSocket handlers
@SubscribeMessage('sendMessage')
@RequirePermissions(CHAT_PERMISSIONS.MESSAGE_SEND)
async handleMessage(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: SendMessageDto
): Promise<void> {
  // Implementation
}
```

### 2. Error Handling Framework

#### 2.1 Centralized Error Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const contextType = host.getType<'http' | 'ws'>();

    if (contextType === 'ws') {
      this.handleWebSocketError(exception, host);
    } else {
      this.handleHttpError(exception, host);
    }
  }

  private handleWebSocketError(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<AuthenticatedSocket>();
    const errorResponse = this.buildErrorResponse(exception);

    // Log error with context
    this.logger.error('WebSocket error', {
      userId: client.user?.id,
      error: errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Send error to client
    client.emit('error', {
      type: 'CHAT_ERROR',
      code: errorResponse.code,
      message: errorResponse.message,
      timestamp: new Date().toISOString(),
    });
  }

  private handleHttpError(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception);

    this.logger.error('HTTP error', {
      path: request.url,
      method: request.method,
      userId: (request as any).user?.id,
      error: errorResponse,
    });

    response.status(errorResponse.statusCode).json({
      success: false,
      error: errorResponse,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

#### 2.2 Custom Exception Classes

```typescript
// Chat-specific exceptions
export class ChatRoomNotFoundError extends BadRequestException {
  constructor(roomId: string) {
    super(`Chat room with ID ${roomId} not found`);
    this.name = 'ChatRoomNotFoundError';
  }
}

export class InsufficientPermissionsError extends ForbiddenException {
  constructor(requiredPermission: string, userType: string) {
    super(
      `Permission '${requiredPermission}' required. User type: ${userType}`,
    );
    this.name = 'InsufficientPermissionsError';
  }
}

export class GuestAccessDeniedError extends ForbiddenException {
  constructor(action: string) {
    super(`Guests are not allowed to ${action}`);
    this.name = 'GuestAccessDeniedError';
  }
}

export class RobotInteractionError extends BadRequestException {
  constructor(robotId: string, reason: string) {
    super(`Robot interaction failed for ${robotId}: ${reason}`);
    this.name = 'RobotInteractionError';
  }
}
```

### 3. Comprehensive Logging System

#### 3.1 Structured Logging Configuration

```typescript
// logging.module.ts
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        level: configService.get('LOG_LEVEL', 'info'),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
          winston.format.metadata(),
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
          }),
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggingModule {}
```

#### 3.2 Security Event Logging

```typescript
@Injectable()
export class SecurityLogger {
  constructor(private readonly logger: Logger) {}

  logAuthenticationAttempt(username: string, success: boolean, ip: string) {
    this.logger.info('Authentication attempt', {
      event: 'AUTH_ATTEMPT',
      username,
      success,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  logPermissionCheck(userId: string, permission: string, granted: boolean) {
    this.logger.info('Permission check', {
      event: 'PERMISSION_CHECK',
      userId,
      permission,
      granted,
      timestamp: new Date().toISOString(),
    });
  }

  logWebSocketConnection(
    userId: string,
    clientId: string,
    event: 'CONNECT' | 'DISCONNECT',
  ) {
    this.logger.info('WebSocket connection event', {
      event: 'WS_CONNECTION',
      userId,
      clientId,
      connectionEvent: event,
      timestamp: new Date().toISOString(),
    });
  }

  logSuspiciousActivity(userId: string, activity: string, details: any) {
    this.logger.warn('Suspicious activity detected', {
      event: 'SECURITY_ALERT',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Implementation Phases

### Phase 1: Core Authentication (Week 1)

**Days 1-2: Database & User Management**

- [ ] Set up PostgreSQL with UUID extension
- [ ] Migrate user schema from how-do-you-know
- [ ] Add chat-specific user fields (display_name, avatar_url, current_status)
- [ ] Create permission domains for chat system
- [ ] Set up guest vs employee user types

**Days 3-4: HTTP Authentication**

- [ ] Implement login/logout endpoints
- [ ] Create JWT service with chat-specific claims
- [ ] Add rate limiting for auth endpoints
- [ ] Implement refresh token mechanism
- [ ] Add authentication middleware

**Days 5-7: WebSocket Authentication**

- [ ] Create WebSocket authentication guard (CRITICAL)
- [ ] Implement token extraction from handshake
- [ ] Add user context to WebSocket connections
- [ ] Test authentication with various client scenarios
- [ ] Add connection/disconnection logging

### Phase 2: Error Handling (Week 1-2)

**Days 6-8: Exception Framework**

- [ ] Create global exception filter
- [ ] Implement chat-specific exception classes
- [ ] Add WebSocket error propagation
- [ ] Create client-friendly error responses
- [ ] Add error categorization system

**Days 9-10: Graceful Degradation**

- [ ] Implement fallback mechanisms for service failures
- [ ] Add circuit breaker patterns for external services
- [ ] Create health check endpoints
- [ ] Add retry logic for transient failures

### Phase 3: Logging & Observability (Week 2)

**Days 11-12: Structured Logging**

- [ ] Set up Winston with JSON formatting
- [ ] Implement security event logging
- [ ] Add request/response correlation IDs
- [ ] Create log aggregation strategy

**Days 13-14: Metrics & Monitoring**

- [ ] Add Prometheus metrics collection
- [ ] Implement performance timing
- [ ] Create dashboard for key metrics
- [ ] Set up alerting for critical errors

## Testing Strategy

### Unit Testing Requirements (>90% Coverage)

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  it('should generate JWT with correct chat claims', async () => {
    const user = { id: 'test-id', accountType: 'employee' };
    const token = await authService.generateToken(user);
    const decoded = jwtService.decode(token) as ChatJwtPayload;

    expect(decoded.sub).toBe(user.id);
    expect(decoded.accountType).toBe('employee');
    expect(decoded.permissions).toContain('chat:room:join');
  });

  it('should reject invalid credentials', async () => {
    await expect(
      authService.validateUser('invalid', 'password'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// websocket-auth.guard.spec.ts
describe('WebSocketAuthGuard', () => {
  it('should authenticate valid JWT token', async () => {
    const mockSocket = createMockSocket({ token: validJwtToken });
    const result = await guard.canActivate(createMockContext(mockSocket));

    expect(result).toBe(true);
    expect(mockSocket.user).toBeDefined();
  });

  it('should reject connection without token', async () => {
    const mockSocket = createMockSocket({});
    const result = await guard.canActivate(createMockContext(mockSocket));

    expect(result).toBe(false);
  });
});
```

### Integration Testing

- WebSocket connection flow with JWT authentication
- Permission enforcement across different user types
- Error handling scenarios
- Security event logging verification

## Security Considerations & Compliance

### JWT Security

- Short token expiration (15 minutes) with refresh mechanism
- Secure signing algorithm (RS256 or HS256 with strong secret)
- Token blacklisting for logout
- Session ID tracking for concurrent session management

### WebSocket Security

- Origin validation in production
- Rate limiting on connection attempts
- Automatic disconnection for invalid users
- Connection monitoring and logging

### Guest User Isolation

```typescript
// Guest restriction middleware
export const GuestRestrictions = {
  CANNOT_CREATE_ROOMS: true,
  CANNOT_INTERACT_WITH_ROBOTS: true,
  CANNOT_BE_ALONE_IN_ROOM: true,
  CANNOT_INVITE_OTHERS: true,
  REQUIRES_EMPLOYEE_SUPERVISION: true,
};
```

## Performance & Monitoring

### Key Metrics to Track

- Authentication success/failure rates
- WebSocket connection counts
- Average response times
- Error rates by category
- Permission check performance
- Security events frequency

### Performance Targets

- Authentication endpoint: < 200ms response time
- WebSocket connection establishment: < 100ms
- Permission check: < 10ms
- Log writing: non-blocking, < 5ms

## Risk Assessment & Mitigation

| Risk                      | Probability | Impact | Mitigation                                       |
| ------------------------- | ----------- | ------ | ------------------------------------------------ |
| Implementation complexity | Low         | Medium | Use proven patterns from how-do-you-know-src     |
| JWT token compromise      | Low         | High   | Short expiration, token rotation, secure storage |
| Permission system bugs    | Low         | High   | Thorough testing, reuse battle-tested patterns   |
| Performance bottlenecks   | Medium      | Medium | Load testing, monitoring, optimized queries      |
| Integration challenges    | Low         | Medium | Modular design, comprehensive testing            |

**Greenfield Advantages Reducing Risk:**

- No legacy security vulnerabilities to inherit
- Clean architecture prevents common security anti-patterns
- Modern NestJS patterns provide built-in security features
- Proven component reuse reduces implementation risk

## Success Criteria & Acceptance Testing

### Must-Pass Tests

- [ ] Guest users cannot access employee-only features
- [ ] WebSocket connections reject invalid JWT tokens
- [ ] All security events are properly logged
- [ ] Error responses don't leak sensitive information
- [ ] Performance targets are met under load
- [ ] Permission system blocks unauthorized actions
- [ ] Audit trail captures all required events

### Security Validation Checklist

- [ ] Penetration testing of authentication endpoints
- [ ] WebSocket security assessment
- [ ] Permission system audit
- [ ] Log injection attack testing
- [ ] Rate limiting effectiveness verification

## Conclusion & Next Steps

This implementation plan establishes a robust, secure foundation for the chat system by building from scratch using proven NestJS patterns and adapting battle-tested components from `how-do-you-know-src`. The greenfield approach allows us to implement modern security practices without legacy constraints.

**Key Implementation Advantages:**

1. **Clean Architecture**: Modern NestJS patterns from day one
2. **Proven Security**: Adapting production-ready permission system
3. **Comprehensive Foundation**: Authentication, error handling, and logging integrated from the start
4. **Scalable Design**: Built for growth with proper separation of concerns

**Critical Success Factors:**

1. WebSocket authentication implemented securely from scratch
2. Permission system properly adapted for chat-specific requirements
3. Comprehensive logging for security compliance and debugging
4. Performance optimized through proper design patterns

**After completion**, this foundation will enable rapid development of chat features (11005-websocket-plan.md and beyond) with confidence in the underlying security and reliability.
