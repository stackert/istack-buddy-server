# iStack Buddy Slack App - Refined Function Description

This document should be considered tenative plan.

The features concluding remarks should layout actual feature with details.

As example, this document was written with websocket slack communication in mind, which does not work for our nest application.
How that gets address is unclear. We'll use ngrok to create https/ssl tunnel to our application.

## Core Function

The iStack Buddy Slack App bridges Slack conversations with AI-powered backend iStackBuddy utility services through asynchronous processing and webhook callbacks.

## Key Components

### 1. Conversation Processing

- **Input**: Slack thread conversations
- **Processing**: Fire-and-forget architecture with immediate acknowledgment
- **Output**: Asynchronous AI responses delivered via callbacks

### 2. API Integration Points

- `POST /istack-buddy/slack-integration/conversation/process` - Main conversation processing endpoint
- `POST /istack-buddy/slack-integration/webhook/message` - Callback message delivery to Slack threads
- `GET /istack-buddy/slack-integration/{knowledgeBaseId}` - Agent capability discovery
- `POST /istack-buddy/slack-integration/conversation/{conversationId}/feedback` - Conversation feedback collection

```json
{
  "conversationResolved": "success" | "inconclusive" | "negative",
  "robotUsefulness": 0 // Range: -5 (negative) < 0 (not useful) < 5 (very useful)
}
```

### 3. Session Management

- Thread-based conversation sessions with context preservation
- Channel-specific knowledge base routing
- Response association via `channelId + threadTs`

### 4. Agent Discovery

Returns channel-specific agent capabilities in structured format:

```json
{
  "channelId": "string",
  "knowledge_base": "string",
  "knownShortCodes": ["array"],
  "functionDescriptions": {
    "functionName": {
      "shortText": "brief description",
      "longText": "detailed usage",
      "parameters": {"param": {"isRequired": boolean, "datatype": "string"}},
          "supportedShortCodes": ["string"];

    }
  }
}
```

## Slack Events Subscription

### Core Message Events (Required)

- **`message.channels`** - Messages in public channels where bot is invited
  - **OAuth Scope**: `channels:history`
  - **Purpose**: Process conversation requests from public channels
- **`message.groups`** - Messages in private channels
  - **OAuth Scope**: `groups:history`
  - **Purpose**: Process conversation requests from private channels
- **`message.im`** - Direct messages with the bot
  - **OAuth Scope**: `im:history`
  - **Purpose**: Handle direct conversations with the bot

### Thread Management & Interaction Events

- **`app_mention`** - When bot is mentioned (@botname)
  - **OAuth Scope**: `app_mentions:read`
  - **Purpose**: Direct interaction triggers and help requests

### Channel Management Events

- **`member_joined_channel`** - When bot joins a channel
  - **Purpose**: Initialize channel-specific configurations
- **`member_left_channel`** - When bot leaves a channel
  - **Purpose**: Cleanup channel-specific data

### Application Lifecycle Events

- **`tokens_revoked`** - When app permissions are revoked
  - **Purpose**: Handle graceful degradation when access is removed
- **`app_uninstalled`** - When app is uninstalled from workspace
  - **Purpose**: Cleanup and notification of service interruption

### Required OAuth Scopes

```json
{
  "bot_token_scopes": [
    "channels:history",
    "groups:history",
    "im:history",
    "app_mentions:read",
    "channels:read",
    "chat:write",
    "users:read"
  ]
}
```

## Architecture Pattern

Three-server design: Slack Bolt App (HTTPS events) → Backend API (domain processing) → Webhook Server (callback delivery)

_Note: WebSocket support is available for development/debugging purposes only. Production communication relies on HTTPS._

## General User/Robot Flow

### Typical Conversation Sequence

#### User Interaction Patterns

**Scenario A: User mentions bot with query**

```
User: @istackbuddy help with formId abc123
```

1. **Slack Event**: `app_mention` event fired → Bot receives via Events API
2. **Message filtering**: Bot processes mention (iStackBuddy conversation subset)
3. **Immediate acknowledgment**: HTTP 200 OK to Slack within 3 seconds
4. **API Call**: `POST /istack-buddy/slack-integration/conversation/process`
5. **Context analysis**: Extract `formId abc123`, determine channel knowledge base
6. **AI processing**: Backend iStackBuddy utilities process the query
7. **Response delivery**: `POST /istack-buddy/slack-integration/webhook/message`
8. **Thread reply**: AI response posted to original thread

**Scenario B: User mentions bot without query**

```
User: @istackbuddy
```

1. **Slack Event**: `app_mention` event fired → Bot receives via Events API
2. **Empty prompt detection**: No query parameters found
3. **Welcome message**: Bot posts help/welcome message immediately
4. **No conversation created**: Welcome message is NOT part of iStackBuddy conversation
5. **Thread opened**: User can now provide actual query in thread

**Scenario C: User replies in existing thread**

```
User: @istackbuddy Can you also check submission xyz789?
```

1. **Slack Event**: `app_mention` with `thread_ts` → Bot receives via Events API
2. **Thread context**: Bot retrieves conversation context using `channelId + threadTs`
3. **Conversation continuation**: Message added to existing iStackBuddy conversation
4. **Processing**: Same API flow as Scenario A with preserved context

_Note: Users can chat among themselves in threads without mentioning @istackbuddy - those messages are ignored by the bot._

#### Message Filtering Rules

- **iStackBuddy conversations are a subset of Slack conversations**
- **Processed messages**: Bot mentions (`@istackbuddy`) and thread replies to bot messages
- **Ignored messages**: All other channel messages, non-threaded conversations
- **Context boundary**: Each thread represents one isolated iStackBuddy conversation

### Bot Interaction Triggers

- **Direct mention**: `@istackbuddy help with formId abc123`
- **Natural conversation**: Messages in channels where bot is invited
- **Thread replies**: Responses within existing conversation threads
- **Direct messages**: Private conversations with the bot

### Response Patterns

- **Loading indicator**: `🤖 Processing your request...` (immediate response)
- **Incremental responses**: Multiple messages as AI processes complex queries
- **Thread-based replies**: All responses maintain conversation context
- **Error recovery**: Clear error messages with suggested next steps

## Security

### Data Handling

#### Data at Rest

- **Conversation logs**: Temporary storage with configurable TTL (default: 24 hours)
- **User session data**: Encrypted storage of active conversation contexts
- **Configuration data**: Channel mappings and knowledge base associations
- **No persistent message storage**: Messages processed and discarded per privacy policy

#### Data in Flight

- **Server to third party**: TLS 1.3 encryption for all external API calls
- **Slack app to servers**: HTTPS with certificate pinning for webhook callbacks
- **Slack app to Slack**: OAuth 2.0 with signed requests using Slack signing secret

### Authorization/Authentication

#### Slack Request Verification

- **Signing secret validation**: All incoming webhook requests verified using Slack signing secret
- **Timestamp validation**: Reject requests older than 5 minutes to prevent replay attacks
- **Token verification**: Bot tokens validated against Slack's token info endpoint

#### Backend Integration Security

- **API key authentication**: iStackBuddy services authenticated via API keys
- **Request correlation**: Each conversation assigned unique correlation ID for tracking
- **Scope validation**: Verify bot permissions before processing sensitive operations

#### User Privacy

- **No user PII storage**: Slack user IDs used for session management only
- **Channel access control**: Bot only processes messages from channels it's invited to
- **Private channel protection**: Separate handling with additional privacy safeguards

## Configuration

### Required Environment Variables

- **`SLACK_BOT_TOKEN`**: Bot user OAuth token (xoxb-\*)
- **`SLACK_SIGNING_SECRET`**: Request signature verification secret
- **`ISTACK_BUDDY_API_URL`**: Backend service base URL
- **`ISTACK_BUDDY_API_KEY`**: Authentication key for backend services
- **`WEBHOOK_BASE_URL`**: Public URL for Slack webhook callbacks

### Slack App Configuration

#### Basic Information

- **App Name**: iStack Buddy
- **Description**: AI-powered conversation assistant for iStackBuddy utilities
- **Bot User**: Required with appropriate display name

#### Event Subscriptions

- **Request URL**: `{WEBHOOK_BASE_URL}/slack/events`
- **Bot Events**: All events listed in Slack Events Subscription section
- **Verification**: URL verification challenge handling

#### OAuth & Permissions

- **Scopes**: All bot token scopes from Required OAuth Scopes section
- **Install to Workspace**: Enable for workspace-wide installation

### Channel Setup Requirements

- **Bot invitation**: Must be manually invited to each channel via `/invite @istackbuddy`
- **Channel mapping**: Configuration of channel-specific knowledge bases
- **Permission verification**: Validate bot has required permissions in each channel

### Runtime Configuration

- **Processing timeout**: 30 seconds maximum for AI processing
- **Retry attempts**: 3 attempts with exponential backoff for failed operations
- **Rate limiting**: Respect Slack's 30k events/hour per workspace limit
- **Session TTL**: 24 hours for conversation context preservation

## User Experience Patterns

### Design Principles

- **No special emoji support**: Standard text-based responses only
- **Unknown user assumption**: Slack users are generally unknown to backend systems
- **Minimal UI elements**: Focus on clear, readable text responses
- **Thread-based continuity**: All conversations maintain context within threads

### Response Formatting

#### Standard Response Pattern

```
🤖 Processing your request...

[AI-generated response content]

💡 Need help? Try: @istackbuddy help
```

#### Error Message Format

```
❌ Unable to process request

Error: [specific error description]

🔧 Suggested actions:
• Check your parameters
• Try rephrasing your question
• Contact support if issue persists
```

### Interaction Patterns

- **Help command**: `@istackbuddy help` - Show available functions for current channel
- **Context preservation**: Bot remembers conversation within thread boundaries
- **Graceful fallbacks**: Clear guidance when requests cannot be processed
- **No personalization**: Generic responses since users are typically unknown

### Loading States

- **Immediate acknowledgment**: Quick "processing" message within 3 seconds
- **Long operations**: Periodic updates for operations taking >10 seconds
- **Timeout handling**: Clear timeout messages after 30 seconds

## Error Handling

### Server Offline Scenarios

#### Backend iStackBuddy Services Unavailable

- **Immediate response**: `🤖 Processing your request...` (acknowledge to Slack)
- **Retry logic**: 3 attempts with exponential backoff (1s, 5s, 15s delays)
- **Fallback message**: `❌ Backend services temporarily unavailable. Please try again in a few minutes.`
- **Service recovery**: Automatic retry when services come back online

#### Slack API Unavailable

- **Queue messages**: Store outbound messages in memory queue
- **Retry delivery**: Attempt webhook delivery every 30 seconds for up to 10 minutes
- **Circuit breaker**: Stop processing new requests if Slack consistently unavailable
- **Graceful degradation**: Log errors and continue processing when Slack recovers

### Server Error Conditions

#### HTTP 4xx Errors (Client Issues)

- **400 Bad Request**: `❌ Invalid request format. Please check your message and try again.`
- **401 Unauthorized**: `❌ Authentication failed. Contact administrator.`
- **403 Forbidden**: `❌ Insufficient permissions for this operation.`
- **429 Rate Limited**: `⏱️ Too many requests. Please wait a moment before trying again.`

#### HTTP 5xx Errors (Server Issues)

- **500 Internal Error**: `❌ Server error occurred. The issue has been logged and will be investigated.`
- **502/503/504 Gateway Errors**: Treat as "server offline" scenario above
- **Timeout errors**: `⏰ Request timed out. Please try again with a simpler query.`

### Missing Required Parameters

#### Parameter Validation Flow

1. **Parse message**: Extract potential parameters from user message
2. **Validate requirements**: Check against function parameter definitions
3. **Missing parameter response**: Prompt user with specific guidance
4. **Context preservation**: Remember partial inputs within thread

#### Missing Parameter Response Format

```
❌ Missing required information

To help you with [function name], I need:
• **formId** (required): The form identifier
• **emailAddress** (optional): Email to search for

Example: @istackbuddy help with formId abc123

Current thread context preserved - just provide the missing information.
```

### System-Wide Error Recovery

- **Correlation tracking**: All errors logged with unique conversation IDs
- **Health monitoring**: Periodic health checks on all system components
- **Alert mechanisms**: Critical errors trigger immediate notifications
- **Rollback capability**: Ability to disable problematic features quickly
