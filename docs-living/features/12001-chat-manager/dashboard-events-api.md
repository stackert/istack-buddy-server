# Dashboard Events API Documentation

## Overview

The Dashboard Events API provides real-time WebSocket notifications for conversation-level activity. This system allows clients to subscribe to global dashboard events and receive live updates about conversation creation, updates, and participant changes.

## Connection & Authentication

Connect to the WebSocket server at `http://localhost:3500` using Socket.IO client.

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');
```

## Dashboard Subscription Events

### Client → Server Events

#### `join_dashboard`

Subscribe to receive all dashboard events.

```javascript
socket.emit('join_dashboard');
```

**Response**: None (client will start receiving dashboard events)

**Effect**: Client joins the 'dashboard' room and will receive all conversation-level events.

#### `leave_dashboard`

Unsubscribe from dashboard events.

```javascript
socket.emit('leave_dashboard');
```

**Response**: None (client will stop receiving dashboard events)

**Effect**: Client leaves the 'dashboard' room and will no longer receive dashboard events.

## Dashboard Broadcast Events

### Server → Client Events

All dashboard events are automatically sent to clients who have joined the dashboard room.

#### `conversation_created`

Fired when a new conversation is created.

```javascript
socket.on('conversation_created', (data) => {
  console.log('New conversation created:', data);
});
```

**Event Data**:

```typescript
{
  conversation: {
    id: string;
    participantIds: string[];
    participantRoles: UserRole[];
    messageCount: number;
    lastMessageAt: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  createdBy: string;
  initialParticipants: Participant[];
  timestamp: string; // ISO string
}
```

**Example**:

```json
{
  "conversation": {
    "id": "conv_abc123",
    "participantIds": ["user1", "agent1"],
    "participantRoles": ["cx-customer", "cx-agent"],
    "messageCount": 0,
    "lastMessageAt": "2025-01-13T10:30:00.000Z",
    "isActive": true,
    "createdAt": "2025-01-13T10:30:00.000Z",
    "updatedAt": "2025-01-13T10:30:00.000Z"
  },
  "createdBy": "user1",
  "initialParticipants": [
    {
      "userId": "user1",
      "userRole": "cx-customer",
      "joinedAt": "2025-01-13T10:30:00.000Z"
    }
  ],
  "timestamp": "2025-01-13T10:30:00.000Z"
}
```

#### `conversation_updated`

Fired when conversation metadata changes (message count, last activity, etc.).

```javascript
socket.on('conversation_updated', (data) => {
  console.log('Conversation updated:', data);
});
```

**Event Data**:

```typescript
{
  conversationId: string;
  changes: {
    messageCount: number;
    lastMessageAt: Date;
    updatedAt: Date;
  }
  timestamp: string; // ISO string
}
```

**Example**:

```json
{
  "conversationId": "conv_abc123",
  "changes": {
    "messageCount": 5,
    "lastMessageAt": "2025-01-13T10:35:00.000Z",
    "updatedAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": "2025-01-13T10:35:00.000Z"
}
```

#### `conversation_participant_added`

Fired when a participant joins a conversation.

```javascript
socket.on('conversation_participant_added', (data) => {
  console.log('Participant added:', data);
});
```

**Event Data**:

```typescript
{
  conversationId: string;
  participant: {
    userId: string;
    userRole: UserRole;
    joinedAt: Date;
  }
  action: 'added';
  timestamp: string; // ISO string
}
```

**Example**:

```json
{
  "conversationId": "conv_abc123",
  "participant": {
    "userId": "agent1",
    "userRole": "cx-agent",
    "joinedAt": "2025-01-13T10:32:00.000Z"
  },
  "action": "added",
  "timestamp": "2025-01-13T10:32:00.000Z"
}
```

#### `conversation_participant_removed`

Fired when a participant leaves a conversation.

```javascript
socket.on('conversation_participant_removed', (data) => {
  console.log('Participant removed:', data);
});
```

**Event Data**:

```typescript
{
  conversationId: string;
  participant: {
    userId: string;
    userRole: UserRole;
    joinedAt: Date;
  }
  action: 'removed';
  timestamp: string; // ISO string
}
```

**Example**:

```json
{
  "conversationId": "conv_abc123",
  "participant": {
    "userId": "agent1",
    "userRole": "cx-agent",
    "joinedAt": "2025-01-13T10:32:00.000Z"
  },
  "action": "removed",
  "timestamp": "2025-01-13T10:38:00.000Z"
}
```

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

### Participant

```typescript
interface Participant {
  userId: string;
  userRole: UserRole;
  joinedAt: Date;
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

## Complete Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3500');

// Connect and join dashboard
socket.on('connect', () => {
  console.log('Connected to server');
  socket.emit('join_dashboard');
});

// Listen for all dashboard events
socket.on('conversation_created', (data) => {
  console.log('🎉 New conversation:', data.conversation.id);
  console.log('   Created by:', data.createdBy);
  console.log('   Participants:', data.initialParticipants.length);
});

socket.on('conversation_updated', (data) => {
  console.log('📝 Updated conversation:', data.conversationId);
  console.log('   Message count:', data.changes.messageCount);
  console.log('   Last activity:', data.changes.lastMessageAt);
});

socket.on('conversation_participant_added', (data) => {
  console.log('➕ Participant joined:', data.participant.userId);
  console.log('   Conversation:', data.conversationId);
  console.log('   Role:', data.participant.userRole);
});

socket.on('conversation_participant_removed', (data) => {
  console.log('➖ Participant left:', data.participant.userId);
  console.log('   Conversation:', data.conversationId);
  console.log('   Role:', data.participant.userRole);
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

## Testing

Use the provided test script to verify dashboard events:

```bash
npx ts-node docs-living/scripts/dashboard-test.ts
```

This script will:

1. Join the dashboard
2. Create a conversation
3. Add/remove participants
4. Show all dashboard events in real-time

## Usage Notes

- **Multiple Dashboard Clients**: Multiple clients can join the dashboard simultaneously
- **Event Ordering**: Events are fired in real-time as they occur
- **Connection State**: Dashboard subscription is per-connection (lost on disconnect)
- **Error Handling**: All dashboard events are informational only (no error responses)
- **Performance**: Dashboard events are lightweight and suitable for real-time monitoring

## Server Logs

When dashboard events are fired, you'll see server logs like:

```
📊 Broadcasting dashboard event: conversation_created
📊 Broadcasting dashboard event: conversation_participant_added
📊 Broadcasting dashboard event: conversation_updated
📊 Broadcasting dashboard event: conversation_participant_removed
```
