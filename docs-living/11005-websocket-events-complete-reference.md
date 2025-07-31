# WebSocket Events Complete Reference

## Overview

This document provides a complete reference for all WebSocket events in the iStack Buddy Server system, including both conversation-level events and dashboard events.

## Connection

```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3500');
```

## Event Categories

### 1. Conversation Events (Room-specific)

Events that affect specific conversations - broadcasted to participants in that conversation room.

### 2. Dashboard Events (Global)

Events that provide system-wide visibility - broadcasted to all dashboard subscribers.

## Conversation Events

### Client → Server Events

| Event                 | Description                    | Data Structure                                                              |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `join_room`           | Join a specific conversation   | `{ conversationId: string, userId: string, userRole: UserRole }`            |
| `leave_room`          | Leave a specific conversation  | `{ conversationId: string, userId?: string }`                               |
| `send_message`        | Send a message to conversation | `CreateMessageDto`                                                          |
| `typing_start`        | Start typing indicator         | `{ conversationId: string, userId: string, userName: string }`              |
| `typing_stop`         | Stop typing indicator          | `{ conversationId: string, userId: string }`                                |
| `get_messages`        | Get messages from conversation | `{ conversationId: string, limit?: number, offset?: number }`               |
| `share_robot_message` | Share a robot message          | `{ originalMessageId: string, conversationId: string, fromUserId: string }` |

### Server → Client Events

| Event         | Description                 | Data Structure                                                 |
| ------------- | --------------------------- | -------------------------------------------------------------- |
| `new_message` | New message in conversation | `Message`                                                      |
| `user_joined` | User joined conversation    | `{ conversationId: string, participant: Participant }`         |
| `user_left`   | User left conversation      | `{ conversationId: string, userId: string }`                   |
| `user_typing` | User typing indicator       | `{ conversationId: string, userId: string, userName: string }` |

## Dashboard Events

### Client → Server Events

| Event             | Description                       | Data Structure |
| ----------------- | --------------------------------- | -------------- |
| `join_dashboard`  | Subscribe to dashboard events     | None           |
| `leave_dashboard` | Unsubscribe from dashboard events | None           |

### Server → Client Events

| Event                              | Description                     | Data Structure                                                                                                           |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `conversation_created`             | New conversation created        | `{ conversation: Conversation, createdBy: string, initialParticipants: Participant[], timestamp: string }`               |
| `conversation_updated`             | Conversation metadata changed   | `{ conversationId: string, changes: { messageCount: number, lastMessageAt: Date, updatedAt: Date }, timestamp: string }` |
| `conversation_participant_added`   | Participant joined conversation | `{ conversationId: string, participant: Participant, action: 'added', timestamp: string }`                               |
| `conversation_participant_removed` | Participant left conversation   | `{ conversationId: string, participant: Participant, action: 'removed', timestamp: string }`                             |

## Data Types

### UserRole

```typescript
enum UserRole {
  CUSTOMER = 'cx-customer',
  AGENT = 'cx-agent',
  SUPERVISOR = 'cx-supervisor',
  ROBOT = 'robot',
}
```

### MessageType

```typescript
enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  ROBOT = 'robot',
}
```

### Participant

```typescript
interface Participant {
  userId: string;
  userRole: UserRole;
  joinedAt: Date;
}
```

### Message

```typescript
interface Message {
  id: string;
  conversationId: string;
  fromUserId: string;
  fromRole: UserRole;
  content: string;
  type: MessageType;
  timestamp: Date;
  isVisible: boolean;
}
```

### CreateMessageDto

```typescript
interface CreateMessageDto {
  conversationId: string;
  fromUserId: string;
  fromRole: UserRole;
  content: string;
  type?: MessageType;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  participantIds: string[];
  participantRoles: UserRole[];
  messageCount: number;
  lastMessageAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Complete Usage Examples

### Conversation Client Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');
const conversationId = 'my-conversation-id';

// Join conversation
socket.emit('join_room', {
  conversationId: conversationId,
  userId: 'user123',
  userRole: 'cx-customer',
});

// Listen for messages
socket.on('new_message', (message) => {
  console.log('New message:', message.content);
});

// Send a message
socket.emit('send_message', {
  conversationId: conversationId,
  fromUserId: 'user123',
  fromRole: 'cx-customer',
  content: 'Hello, I need help!',
  type: 'text',
});

// Handle typing indicators
socket.on('user_typing', (data) => {
  console.log(`${data.userName} is typing...`);
});
```

### Dashboard Client Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');

// Join dashboard
socket.emit('join_dashboard');

// Monitor all conversation activity
socket.on('conversation_created', (data) => {
  console.log('New conversation:', data.conversation.id);
  console.log('Created by:', data.createdBy);
});

socket.on('conversation_participant_added', (data) => {
  console.log('Participant added to', data.conversationId);
  console.log('User:', data.participant.userId);
  console.log('Role:', data.participant.userRole);
});

socket.on('conversation_updated', (data) => {
  console.log('Conversation updated:', data.conversationId);
  console.log('New message count:', data.changes.messageCount);
});
```

### Dual-Mode Client Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');

// Join both dashboard and specific conversation
socket.emit('join_dashboard');
socket.emit('join_room', {
  conversationId: 'conv123',
  userId: 'agent456',
  userRole: 'cx-agent',
});

// Dashboard events (global visibility)
socket.on('conversation_created', (data) => {
  console.log('🌍 GLOBAL: New conversation created');
});

socket.on('conversation_participant_added', (data) => {
  console.log('🌍 GLOBAL: Participant joined conversation');
});

// Conversation events (specific to joined conversation)
socket.on('new_message', (message) => {
  console.log('💬 LOCAL: New message in my conversation');
});

socket.on('user_joined', (data) => {
  console.log('💬 LOCAL: User joined my conversation');
});
```

## Testing

### Test Scripts Available

```bash
# Test conversation events
npx ts-node docs-living/scripts/basic-websocket-test.ts

# Test dashboard events
npx ts-node docs-living/scripts/dashboard-test.ts

# Simple dashboard test
npx ts-node docs-living/scripts/dashboard-test-simple.ts
```

## Server Logs

When events are fired, you'll see server logs like:

```
# Conversation events
Client connected: abc123
Client abc123 joining room: conv456
Broadcasting message to conversation: conv456

# Dashboard events
Client abc123 joining dashboard
📊 Broadcasting dashboard event: conversation_created
📊 Broadcasting dashboard event: conversation_participant_added
📊 Broadcasting dashboard event: conversation_updated
📊 Broadcasting dashboard event: conversation_participant_removed
```

## Error Handling

All events should include proper error handling:

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

## Performance Notes

- **Dashboard Events**: Lightweight, suitable for real-time monitoring
- **Conversation Events**: Include full message data, may be larger
- **Event Ordering**: Events are fired in real-time as they occur
- **Connection State**: All subscriptions are per-connection (lost on disconnect)
- **Multiple Clients**: Multiple clients can join the same rooms simultaneously
