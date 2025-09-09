# Robot Router Dev Client - Live Testing Interface

## Overview
A simple web-based dev/debug interface for real-time testing of the robot router system without Slack. Two-page interface: Monitor (watch conversations) and Chat (join/participate in conversations).

## Plan

### 🔐 **Authentication & User Management**
**Approach**: Exact marv-session pattern (reuse existing infrastructure)
- **Method**: `AuthorizationPermissionsService.createDevUserAndSession()`
  - Creates temporary dev user with dev permissions
  - Generates JWT with `ISTACK_BUDDY_INTERNAL_JWT_SECRET`
  - Stores in `devSessions[jwtToken]` (similar to `formMarvSessions`)
- **Endpoint**: `GET /dev-debug/create-session` 
  - Returns `{sessionId, userId, jwtToken}`
  - Sets HTTP-only cookie with JWT
- **User Persistence**: 8 hours (same as marv-session)
- **Auth Method**: JWT cookie validation (proven pattern)

### 📺 **Monitor Page** 
**Endpoint**: `GET /dev-debug/monitor`
**Purpose**: Watch all conversation activity in real-time

**Features**:
- **Conversation List**: Active conversations with metadata
  - Conversation ID, title, message count
  - Current robot, last activity  
  - Participant count
- **Real-time Updates**: WebSocket connection for conversation events
  - New conversations created
  - Robot switches (`conversation_robot_changed`)
  - New messages added
  - Conversation updates
- **Actions**: Click conversation → redirect to chat page

**Implementation**:
- HTML page served from controller
- WebSocket connection to existing ChatManagerGateway
- Listen to dashboard events (`conversation_created`, `conversation_updated`, etc.)

### 💬 **Chat Page**
**Endpoint**: `GET /dev-debug/chat/:conversationId`
**Purpose**: Join conversation and participate with real-time robot routing

**Features**:
- **Message History**: Load all previous messages on join
- **Real-time Messaging**: WebSocket for bidirectional chat
- **Streaming Responses**: Watch robot responses stream in real-time
- **Debug Panel**: Show intent parsing results for each message
  - Selected robot, intent, subIntents
  - Robot switches highlighted
  - Processing time, errors
- **Send Messages**: Text input → intent parsing → robot selection → response

**Implementation**:
- HTML page with message history loaded via API
- WebSocket connection for real-time chat
- Uses `addMessageFromSlack` pathway (proper intent parsing)
- Debug info displayed alongside messages

### 🛠️ **Backend Requirements**

#### **New Controller**: `DevDebugChatClientController`
```typescript
@Controller('dev-debug')
export class DevDebugChatClientController {
  @Get('create-session')     // Create temp user + JWT
  @Get('monitor')           // Serve monitor HTML page  
  @Get('chat/:id')          // Serve chat HTML page
  @Get('api/conversations') // Get conversation list
  @Get('api/conversation/:id/messages') // Get message history
  @Post('api/conversation/:id/send')    // Send message (uses addMessageFromSlack)
}
```

#### **WebSocket Enhancements**
- **Monitor Events**: Broadcast conversation list changes
- **Chat Events**: Join conversation, send/receive messages
- **Debug Events**: Intent parsing results, robot switches

#### **HTML Pages** (Simple & Functional)
- **Monitor**: Conversation list + WebSocket updates
- **Chat**: Message history + input + debug panel + WebSocket

### 📋 **Implementation Steps**

1. **Authentication Setup**
   - Create temporary user generation
   - JWT token creation/validation
   - Session management

2. **Backend API Endpoints**
   - Conversation list API
   - Message history API  
   - Send message API (uses addMessageFromSlack)

3. **WebSocket Integration**
   - Monitor: conversation events
   - Chat: real-time messaging + debug events

4. **HTML Pages**
   - Simple responsive UI
   - WebSocket client code
   - Debug info display

5. **Integration Testing**
   - Test with robot switching scenarios
   - Verify streaming responses
   - Validate debug info accuracy

### 🎯 **User Flow**

1. **Start Session**: Visit `/dev-debug/monitor` → creates temp user + JWT
2. **Monitor**: See live conversation list, select conversation  
3. **Join Chat**: Click conversation → redirect to `/dev-debug/chat/{id}`
4. **Chat Interface**: See message history, send messages, watch streaming responses
5. **Debug Info**: Intent parsing results, robot switches, processing times displayed in real-time

### 🔧 **Technical Benefits**

- **Real-time Testing**: Immediate feedback on robot routing decisions
- **Debug Visibility**: See intent parsing + robot selection process
- **Streaming Validation**: Verify robot responses stream correctly  
- **Conversation Context**: Test robot switching within conversations
- **No Slack Dependency**: Complete standalone testing environment

### 📝 **File Structure**
```
src/dev-debug/
├── dev-debug-chat-client.controller.ts  # New controller
├── templates/
│   ├── monitor.html                      # Monitor page
│   └── chat.html                         # Chat page
└── static/
    ├── monitor.js                        # Monitor WebSocket client  
    └── chat.js                          # Chat WebSocket client
```

## Expected Outcome
A simple but powerful web interface for testing robot router system with real-time feedback, debug visibility, and conversation context - enabling thorough testing without Slack dependency.
