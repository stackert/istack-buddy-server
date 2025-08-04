# MarvToolBox Socket.io Integration

## Overview

This document describes the integration of socket.io real-time communication with the existing MarvToolBox chat component. The integration provides real-time messaging capabilities while maintaining the existing UI and functionality.

## Architecture

### Components

1. **ChatSocketService** (`src/services/ChatSocketService.ts`)

   - Handles socket.io connection management
   - Provides message sending/receiving functionality
   - Manages connection state and error handling
   - Singleton service for application-wide use

2. **MarvToolBoxWithSocket** (`src/components/MarvToolBox/MarvToolBoxWithSocket.tsx`)

   - Enhanced version of the original MarvToolBox
   - Integrates with ChatSocketService for real-time communication
   - Maintains the same UI and user experience
   - Adds connection status and error handling

3. **Chat Configuration** (`src/config/chatConfig.ts`)
   - Centralized configuration for chat settings
   - Environment variable management
   - Helper functions for conversation and user management

## Features

### Real-time Communication

- **WebSocket Connection**: Automatic connection to backend chat server
- **Message Broadcasting**: Real-time message sending and receiving
- **Connection Management**: Automatic reconnection and error handling
- **Message History**: Load previous messages on connection

### Enhanced UI

- **Connection Status**: Shows connection state in header
- **Error Handling**: Displays connection errors with user-friendly messages
- **Loading States**: Shows loading indicators during message history loading
- **Typing Indicators**: Visual feedback during message sending

### Backward Compatibility

- **Same Interface**: Maintains the same props and callbacks as original MarvToolBox
- **Template Support**: Preserves template button functionality
- **Message Format**: Compatible with existing message structure

## Usage

### Basic Usage

```tsx
import MarvToolBoxWithSocket from "./components/MarvToolBox/MarvToolBoxWithSocket";

const MyComponent = () => {
  const handleMessageSent = (message: string) => {
    console.log("Message sent:", message);
  };

  return (
    <MarvToolBoxWithSocket
      onMessageSent={handleMessageSent}
      formId="123456"
      autoConnect={true}
    />
  );
};
```

### Advanced Usage

```tsx
import MarvToolBoxWithSocket from "./components/MarvToolBox/MarvToolBoxWithSocket";

const AdvancedComponent = () => {
  const [conversationId, setConversationId] = useState(
    "custom-conversation-id"
  );

  const handleMessageSent = (message: string) => {
    // Custom message handling
    console.log("Message sent:", message);
  };

  const handleTemplateClick = (template: string) => {
    // Custom template handling
    console.log("Template clicked:", template);
  };

  return (
    <MarvToolBoxWithSocket
      conversationId={conversationId}
      formId="123456"
      onMessageSent={handleMessageSent}
      onTemplateButtonClick={handleTemplateClick}
      initialInputText="Hello, I need help with my form"
      autoConnect={true}
    />
  );
};
```

## Configuration

### Environment Variables

Set these environment variables for the chat service:

```env
# Backend server configuration
NEXT_PUBLIC_ISTACK_BUDDY_BACKEND_SERVER_HOST=localhost
NEXT_PUBLIC_ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT=3500
```

### JWT Token Management

The system automatically extracts JWT tokens from secure session URLs and stores them in sessionStorage:

- **Token Extraction**: JWT tokens are extracted from backend responses
- **Storage**: Tokens are stored in sessionStorage (cleared when tab closes)
- **Authentication**: Tokens are available for WebSocket authentication
- **Security**: Tokens are automatically cleared when session ends

### Chat Configuration

The chat service uses the following default configuration:

```typescript
const CHAT_CONFIG = {
  SERVER_HOST: "localhost",
  SERVER_PORT: "3500",
  DEFAULT_USER_ID: "form-marv-user",
  DEFAULT_USER_ROLE: "cx-agent",
  CONNECTION_TIMEOUT: 20000,
  RECONNECT_ATTEMPTS: 5,
  DEFAULT_MESSAGE_LIMIT: 50,
  DEBUG_MODE: process.env.NODE_ENV === "development",
};
```

## Props

### MarvToolBoxWithSocket Props

| Prop                    | Type                         | Default          | Description                             |
| ----------------------- | ---------------------------- | ---------------- | --------------------------------------- |
| `messages`              | `Message[]`                  | `[]`             | Initial messages to display             |
| `onMessageSent`         | `(message: string) => void`  | `undefined`      | Callback when message is sent           |
| `onTemplateButtonClick` | `(template: string) => void` | `undefined`      | Callback for template button clicks     |
| `initialInputText`      | `string`                     | `""`             | Initial text in input field             |
| `conversationId`        | `string`                     | `auto-generated` | Custom conversation ID                  |
| `formId`                | `string`                     | `undefined`      | Form ID for form-specific conversations |
| `autoConnect`           | `boolean`                    | `true`           | Whether to auto-connect on mount        |

### Message Interface

```typescript
interface Message {
  id: string;
  content: string;
  author: "user" | "marv";
  dateTime: string;
}
```

## Socket.io Events

### Client to Server Events

- `join_room`: Join a conversation room
- `send_message`: Send a message to the conversation
- `get_messages`: Get message history
- `leave_room`: Leave a conversation room

### Server to Client Events

- `new_message`: Receive a new message
- `user_joined`: User joined the conversation
- `user_left`: User left the conversation
- `user_typing`: User typing indicator

## Error Handling

### Connection Errors

- **Connection Failed**: Shows error message and retry option
- **Lost Connection**: Automatic reconnection attempts
- **Server Unavailable**: Graceful degradation with offline mode

### Message Errors

- **Send Failed**: Removes message from UI and shows error
- **History Load Failed**: Continues without history
- **Invalid Message**: Validation and error feedback

## Integration with Backend

### Backend Requirements

The backend server must implement the following socket.io events:

1. **Chat Manager Gateway** (NestJS)

   - WebSocket gateway with CORS enabled
   - Room management (join/leave)
   - Message broadcasting
   - User typing indicators

2. **Chat Manager Service**
   - Message storage and retrieval
   - Conversation management
   - User authentication
   - Message history

### Message Format

Messages sent to the backend follow this format:

```typescript
{
  content: string,
  conversationId: string,
  fromUserId: string,
  fromRole: string,
  toRole: string,
  messageType: "text",
  timestamp: string
}
```

## Migration from Original MarvToolBox

### Step 1: Install Dependencies

```bash
npm install socket.io-client
npm install --save-dev @types/socket.io-client
```

### Step 2: Replace Component

Replace the original MarvToolBox import:

```tsx
// Before
import MarvToolBox from "./components/MarvToolBox/MarvToolBox";

// After
import MarvToolBoxWithSocket from "./components/MarvToolBox/MarvToolBoxWithSocket";
```

### Step 3: Update Props

The new component accepts the same props as the original, with additional socket-related props:

```tsx
// Original usage
<MarvToolBox
  messages={messages}
  onMessageSent={handleMessageSent}
  onTemplateButtonClick={handleTemplateClick}
  initialInputText="Hello"
/>

// New usage with socket integration
<MarvToolBoxWithSocket
  messages={messages}
  onMessageSent={handleMessageSent}
  onTemplateButtonClick={handleTemplateClick}
  initialInputText="Hello"
  formId="123456"
  autoConnect={true}
/>
```

## Testing

### Test Pages

The project includes two test pages for different scenarios:

1. **Direct Chat Test** (`/test-marv-chat`)

   - Directly tests the MarvToolBox with socket.io integration
   - Connects to backend server on port 3500
   - Shows real-time chat functionality

2. **Secure Session Test** (`/test-chat-session`)
   - Tests the complete secure session flow
   - Requests temporary secure link from backend
   - Demonstrates the full chat session creation process

### Development Testing

1. **Start Backend Server**: Ensure the NestJS chat server is running on port 3500
2. **Set Environment Variables**: Configure server host and port
3. **Test Direct Chat**: Visit `/test-marv-chat` for direct socket.io testing
4. **Test Secure Session**: Visit `/test-chat-session` for full flow testing
5. **Monitor Console**: Check for connection and message logs

### Production Testing

1. **Backend Deployment**: Deploy chat server to production
2. **Environment Configuration**: Set production environment variables
3. **Load Testing**: Test with multiple concurrent users
4. **Error Scenarios**: Test connection loss and recovery

## Troubleshooting

### Common Issues

1. **Connection Failed**

   - Check backend server is running
   - Verify environment variables
   - Check network connectivity

2. **Messages Not Sending**

   - Check socket connection status
   - Verify message format
   - Check backend error logs

3. **History Not Loading**
   - Check conversation ID
   - Verify backend message storage
   - Check network connectivity

### Debug Mode

Enable debug mode for detailed logging:

```typescript
// In chatConfig.ts
DEBUG_MODE: process.env.NODE_ENV === "development";
```

## Future Enhancements

### Planned Features

1. **File Upload Support**: Send files through chat
2. **Message Threading**: Reply to specific messages
3. **Typing Indicators**: Show when users are typing
4. **Message Reactions**: Add reactions to messages
5. **Offline Support**: Queue messages when offline

### Performance Optimizations

1. **Message Pagination**: Load messages in chunks
2. **Connection Pooling**: Reuse connections
3. **Message Compression**: Compress large messages
4. **Caching**: Cache message history locally

## Security Considerations

### Authentication

- JWT token validation
- User role verification
- Session management

### Data Protection

- Message encryption (if required)
- Secure WebSocket connections
- Input validation and sanitization

### Privacy

- Message retention policies
- User consent for data collection
- GDPR compliance considerations
