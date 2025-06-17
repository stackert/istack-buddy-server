# WebSocket Server Plan

## Overview

Real-time communication infrastructure for the chat system using WebSocket connections with proper authentication, room management, and message broadcasting.

## Implementation Order

**Priority: 2**
**Dependencies: 11001-authentication-error-logging-plan.md**
**Required Before: Room management, message persistence**

## Features Included

### 1. WebSocket Gateway Architecture

- Socket.IO-based WebSocket server
- JWT authentication integration
- Connection lifecycle management
- Proper separation of concerns (no business logic in gateway)

### 2. Connection Management

- Client connection tracking
- Authentication validation on connection
- Graceful disconnect handling
- Connection health monitoring
- Reconnection strategy support

### 3. Message Protocol

- Structured message format
- Event-based communication
- Message type definitions
- Protocol versioning support

### 4. Real-time Broadcasting

- Room-specific message broadcasting
- Targeted client messaging
- Efficient client lookup
- Message delivery confirmation

## Technical Requirements

### WebSocket Architecture

```typescript
// Learn from conversations-server but avoid anti-patterns
@WebSocketGateway(WS_SERVER_PORT, {
  cors: { origin: configService.get('ALLOWED_ORIGINS') },
  transports: ['websocket'],
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  // NO public methods (avoid anti-pattern)
  // NO business logic (delegate to services)
  // Proper error handling throughout
}
```

### Message Protocol

```typescript
interface ChatMessage {
  id: string;
  type: 'chat' | 'robot' | 'system' | 'file' | 'image' | 'graph';
  roomId: string;
  senderId: string;
  content: string | object;
  timestamp: Date;
  deliveryStatus: 'streaming' | 'batch-delay' | 'delivered';
  metadata?: object;
}

interface WebSocketEvent {
  event: string;
  data: any;
  requestId?: string; // For request/response correlation
  version: string;
}
```

### Connection Management

```typescript
interface ConnectedClient {
  id: string;
  socketId: string;
  userId: string;
  userType: 'employee' | 'guest' | 'supervisor';
  permissions: string[];
  roomSubscriptions: string[];
  connectionTime: Date;
  lastActivity: Date;
}
```

## Implementation Strategy

### Phase 1: Basic WebSocket Infrastructure (Week 1)

1. Set up Socket.IO server with NestJS integration
2. Implement JWT authentication for WebSocket connections
3. Create connection lifecycle management
4. Build client registry and tracking
5. Add proper error handling and logging

### Phase 2: Message Protocol (Week 1-2)

1. Define message structures and types
2. Implement event-based message handling
3. Add message validation and sanitization
4. Create protocol versioning support
5. Build message delivery confirmation system

### Phase 3: Broadcasting & Room Management (Week 2)

1. Implement room-based client grouping
2. Create targeted message broadcasting
3. Add efficient client lookup mechanisms
4. Build room subscription management
5. Implement message routing logic

### Phase 4: Production Hardening (Week 2-3)

1. Add connection monitoring and health checks
2. Implement rate limiting and abuse prevention
3. Add comprehensive error handling
4. Build reconnection strategy support
5. Performance optimization and load testing

## Message Types & Events

### Client → Server Events

```typescript
'chat:room:join' |
  'chat:room:leave' |
  'chat:message:send' |
  'chat:typing:start' |
  'chat:typing:stop';
'chat:file:upload' |
  'chat:robot:interact' |
  'chat:room:create' |
  'chat:escalation:create';
```

### Server → Client Events

```typescript
'chat:message:received' |
  'chat:room:joined' |
  'chat:room:left' |
  'chat:user:typing';
'chat:file:uploaded' |
  'chat:robot:response' |
  'chat:room:created' |
  'chat:escalation:created';
'chat:error' | 'chat:system:notification';
```

### Message Processing

- **Streaming**: Real-time chat messages, typing indicators
- **Batch-delay**: File uploads, robot processing, system operations

## Security Requirements

### Connection Security

- JWT validation on connection establishment
- Permission verification for all events
- Rate limiting per connection
- Guest user restrictions enforcement

### Message Security

- Message content validation and sanitization
- Room access permission checks
- Robot interaction permission verification
- File upload security scanning integration

## Performance Requirements

### Connection Limits

- Support for 1000+ concurrent connections
- Efficient memory usage for client tracking
- Optimized message broadcasting algorithms
- Connection pooling and resource management

### Message Throughput

- Handle 100+ messages per second per room
- Sub-second message delivery latency
- Efficient room-based message routing
- Message queuing for offline users

## Error Handling

### Connection Errors

```typescript
interface WebSocketError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

// Error categories:
'AUTH_FAILED' | 'PERMISSION_DENIED' | 'ROOM_ACCESS_DENIED' | 'RATE_LIMITED';
'CONNECTION_LOST' | 'PROTOCOL_ERROR' | 'SERVER_ERROR' | 'CLIENT_ERROR';
```

### Graceful Degradation

- Handle authentication service outages
- Manage database connection failures
- Deal with robot service unavailability
- Provide offline message queuing

## Testing Strategy

### Unit Tests (>90% coverage)

- Connection management logic
- Message protocol validation
- Authentication integration
- Broadcasting algorithms

### Integration Tests

- Full WebSocket connection flow
- Room joining/leaving scenarios
- Message delivery end-to-end
- Error handling scenarios

### Load Tests

- 1000+ concurrent connections
- High-frequency message sending
- Room scalability testing
- Memory usage under load

## Monitoring & Observability

### Metrics

- Active connection count
- Message throughput rates
- Connection duration statistics
- Error rates by category
- Room participation metrics

### Alerts

- Connection limit approaching
- High error rates
- Authentication failures spike
- Performance degradation

## Anti-patterns to Avoid (from conversations-server)

1. ❌ Public methods on gateway class
2. ❌ Business logic in WebSocket gateway
3. ❌ Weak authentication guards
4. ❌ Missing error handling
5. ❌ Hard-coded configuration values
6. ❌ No proper type safety

## Success Criteria

- [ ] Secure WebSocket connections with JWT authentication
- [ ] Real-time message delivery < 100ms latency
- [ ] Support for 1000+ concurrent connections
- [ ] Proper error handling and graceful degradation
- [ ] Room-based message broadcasting working
- [ ] Guest user restrictions properly enforced
- [ ] Comprehensive monitoring and alerting
- [ ] > 90% test coverage with load testing completed
