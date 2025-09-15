# Message Routing Architecture Implementation Plan

**CRITICAL NOTES:**

- **NO TESTING**: We will NOT be fixing tests or writing tests for this work segment
- **NO DATABASE COMPLEXITY**: We are NOT overcomplicating with SQL/database details
- **FOCUS**: Get the architecture working first, worry about testing after legacy code removal

**NOTE**: Throughout this document, 'SYSTEM' role should be renamed to 'INTENT_PROCESSOR' for clarity

## **Complete Message Content Types Reference**

**All content types use the structure: `{type: string, payload: PayloadType}`**

#### **Basic Content Types**

- **`text/plain-string`**: `{type: 'text/plain', payload: string}` - Plain text messages
- **`text/markdown-string`**: `{type: 'text/markdown', payload: string}` - Markdown formatted text
- **`application/json-string`**: `{type: 'application/json', payload: string}` - JSON data as string

#### **Media Content Types**

- **`image/jpg-buffer`**: `{type: 'image/jpg', payload: Buffer}` - JPEG image data
- **`image/gif-buffer`**: `{type: 'image/gif', payload: Buffer}` - GIF image data
- **`image/*-buffer`**: `{type: 'image/*', payload: Buffer}` - Generic image data
- **`application/octet-stream-buffer`**: `{type: 'application/octet-stream', payload: Buffer}` - Binary file data

#### **Information Services Content Types**

- **`context/dynamic-string`**: `{type: 'context/dynamic', payload: string}` - JSON string of dynamic context data
- **`context/dynamic-account-json`**: `{type: 'context/dynamic-account', payload: {accountRecord: any, [key: string]: any}}` - Account context
- **`context/dynamic-form-json`**: `{type: 'context/dynamic-form', payload: {formRecord: any, submitActionIds?: string[], emails?: string[], [key: string]: any}}` - Form context
- **`context/dynamic-auth-provider-json`**: `{type: 'context/dynamic-auth-provider', payload: {authProviderRecord: any, [key: string]: any}}` - Auth provider context
- **`context/document-string`**: `{type: 'context/document', payload: string}` - Robot context documents (robot sees full, user sees summary)
- **`context/knowledge-base-prompt-string`**: `{type: 'context/knowledge-base-prompt', payload: string}` - Structured robot prompts for knowledge base searches
- **`sumo-search/report-json`**: `{type: 'sumo-search/report', payload: {recordCount: number, results: any[], originalQuery: string, [key: string]: any}}` - Sumo report results
- **`sumo-syntax/query-json`**: `{type: 'sumo-syntax/query', payload: {query: string, isValid: boolean, [key: string]: any}}` - Sumo query syntax
- **`sumo-syntax/validation-json`**: `{type: 'sumo-syntax/validation', payload: {isValid: boolean, errors?: string[], [key: string]: any}}` - Sumo validation results

## **Overview: Client Connection to Conversation Flow**

### **Slack User Connection Flow**

#### **Slack Events → Conversation Creation**

**1. Slack Event Types:**

- **`app_mention`**: `@iStackBuddyChatApp [message]` in channel
- **`message`**: Direct message to bot or thread reply
- **Event Distinction**: `app_mention` = new conversation, `message` in thread = existing conversation

**2. Event Processing Flow:**

```typescript
SlackEvent → IstackBuddySlackApiService.handleEvent() → {
  if (event.type === 'app_mention') {
    // NEW CONVERSATION
    const conversation = await chatManager.startConversation({
      createdBy: event.user,
      title: `Slack Channel Conversation`,
      initialParticipants: [event.user]
    });

    // Create Slack callback for responses
    const slackCallback = this.createSlackResponseCallback(event.channel, event.ts);

    // Map Slack thread to internal conversation
    this.slackThreadToConversationMap[event.ts] = {
      internalConversationId: conversation.id,
      slackConversationId: event.ts,
      sendConversationResponseToSlack: slackCallback
    };
  }
}
```

**3. First Message Addition:**

```typescript
// Add user message to conversation
await chatManager.addMessageFromSlack(
  conversation.id,
  { type: 'text', payload: event.text },
  slackCallback, // This callback sends responses back to Slack
);
```

**4. Expected Result:**

- **Conversation created** with internal ID
- **Slack thread mapped** to conversation ID
- **User message added** to conversation
- **Intent parsing triggered** (if applicable)
- **Slack callback registered** for sending responses back

### **Dev/Debug User Connection Flow**

#### **Dev/Debug Session → Conversation Creation**

**1. Session Creation:**

```typescript
GET /dev-debug/create-session → {
  // Create temporary dev user + JWT
  const session = await authPermissions.createDevUserAndSession();
  return { sessionId, userId, jwtToken };
}
```

**2. Chat Page Access:**

```typescript
GET /dev-debug/chat/:conversationId → {
  // Either join existing conversation or create new one
  const conversation = await chatManager.getOrCreateConversation(conversationId);

  // Return HTML page with WebSocket connection
  return chatHtmlPage;
}
```

**3. WebSocket Connection:**

```typescript
// Client-side JavaScript
socket.emit('join_room', {
  conversationId: conversationId,
  userId: userId,
  userRole: 'cx-customer',
});

// Server-side WebSocket handler
socket.on('join_room', (data) => {
  socket.join(data.conversationId);
  // Client now receives all conversation broadcasts
});
```

**4. First Message Addition:**

```typescript
// Two pathways:

// A. Regular Message (via chat input)
POST /dev-debug/api/conversation/:id/send
await chatManager.addMessageFromSlack(
  conversationId,
  { type: 'text', payload: message },
  undefined // No Slack callback - uses WebSocket
);

// B. Direct Intent (via intent input)
POST /dev-debug/api/conversation/:id/send-intent
const callbacks = chatManager.createConversationCallbacks(conversationId);
await intentRouter.routeIntent(intentData, callbacks);
```

**5. Expected Result:**

- **WebSocket connection** established to conversation
- **User message added** to conversation
- **Real-time updates** via WebSocket events
- **No external callbacks** (everything via WebSocket)

### **Key Differences: Slack vs Dev/Debug**

#### **Connection Method**

- **Slack**: Event-driven (app_mention triggers conversation creation)
- **Dev/Debug**: Session-based (JWT + WebSocket connection)

#### **Response Delivery**

- **Slack**: Via `slackCallback` → sends to Slack API → appears in Slack thread
- **Dev/Debug**: Via WebSocket broadcast → appears in browser immediately

#### **Message Addition Functions**

- **Slack**: `addMessageFromSlack(conversationId, content, slackCallback)`
- **Dev/Debug**: `addMessageFromSlack(conversationId, content, undefined)` OR direct intent routing

#### **Client Registration**

- **Slack**: Automatic (callback created and mapped to thread)
- **Dev/Debug**: Manual (WebSocket join_room event)

#### **Conversation Lifecycle**

- **Slack**: Tied to Slack thread lifecycle
- **Dev/Debug**: Tied to browser session + manual navigation

### **Unified Message Flow (After Architecture Change)**

**Both clients will use the same flow:**

```typescript
1. User input → Intent parsing
2. Intent router → conversation.addSystemMessage() [acknowledgment]
3. Intent handler → conversation.addContext() [context data]
4. Intent handler → conversation.addRobotPrompt() [triggers robot]
5. Robot → conversation.addMessage() [robot response]
6. Conversation → broadcast to ALL clients
7. Each client decorates message for its UI
```

**Result**: Same conversation flow, different client presentation

### **Message Lifecycle Flows**

**You're right! There are multiple lifecycle flows depending on message type:**

#### **Flow 1: Simple Chat Message (No Intent)**

```
1. USER MESSAGE → conversation.addMessage()
   ↓
2. CONVERSATION.broadcastMessage() → ALL CLIENTS
   ↓
3. ROBOT RESPONSE (if toRole: ROBOT)
   ↓
4. conversation.addMessageResponseFromRobot()
   ↓
5. CONVERSATION.broadcastMessage() → ALL CLIENTS
```

#### **Flow 2: Intent-Based Message (Long Job)**

```
1. USER MESSAGE → conversation.addMessage()
   ↓
2. INTENT PARSING → intentData created
   ↓
3. INTENT ROUTER → conversation.addMessageSystemNotification() [ack]
   ↓
4. INTENT HANDLER → job execution (non-blocking)
   ↓
5. JOB PROGRESS → conversation.addMessageSystemNotification() [status]
   ↓
6. JOB DATA → conversation.addMessageAsContext() [context for robot]
   ↓
7. FINAL PROMPT → conversation.addMessageRequestRobotResponse() [triggers robot]
   ↓
8. ROBOT RESPONSE → conversation.addMessageResponseFromRobot() [auto-added]
   ↓
9. ALL CLIENTS receive all messages with client-specific decoration
```

#### **Flow 3: Direct Intent (Dev/Debug)**

```
1. DIRECT INTENT → intentRouter.routeIntent()
   ↓
2. INTENT ROUTER → conversation.addMessageSystemNotification() [ack]
   ↓
3. INTENT HANDLER → [same as Flow 2 from step 4]
```

### **Message Types and Client Handling**

#### **User Messages** (`fromRole: USER, toRole: USER|ROBOT`)

- **All Clients**: Display normally
- **Triggers**: Intent parsing, robot responses

#### **System Messages** (`fromRole: SYSTEM, toRole: USER`)

- **Slack**: `"⚙️ System: [message]"`
- **Dev/Debug**: `[System badge] [message]`
- **Purpose**: Acknowledgments, status updates

#### **Robot Context Messages** (`fromRole: ROBOT, toRole: ROBOT`)

- **Slack**: `"🤖 Robot content loaded: Form context for 5375703 (8 submit actions)"`
- **Dev/Debug**: `[Expandable JSON panel with full context data]`
- **Purpose**: Provide context to robot without triggering response

#### **Robot Response Messages** (`fromRole: ROBOT, toRole: USER`)

- **All Clients**: Display normally (robot talking to user)
- **Purpose**: Final robot responses to user queries

#### **Job Progress Messages** (`fromRole: [job-robot], toRole: USER`)

- **Slack**: `"⏳ Sumo report processing... (2/5 minutes)"`
- **Dev/Debug**: `"Processing..." + progress indicator`
- **Purpose**: Keep user informed during long operations

### **Conversation as State Management**

#### **State Storage in Conversation**

```typescript
// Instead of separate state management:
conversation.messages = [
  {id: 1, intent: "getContextDynamic", subjects: {formId: ["5375703"]}, ...},
  {id: 2, fromRole: "ROBOT", content: "context loaded", ...},
  {id: 3, fromRole: "ROBOT", toRole: "USER", content: "Here's your form...", ...}
]

// State retrieval from conversation:
const currentRobot = conversation.getCurrentRobot(); // Always returns value (empty string if none)
const lastIntent = conversation.getLastIntent(); // Always returns value (empty object if none)
const lastSubjects = conversation.getLastSubjects(); // Always returns value (empty object if none)

// Consistent naming pattern - all methods return non-null values:
// - getCurrentRobot(): string (returns '' if no robot)
// - getLastIntent(): IntentData (returns {} if no intent)
// - getLastSubjects(): SubjectsObject (returns {} if no subjects)
```

#### **Benefits of Conversation-Based State**

- ✅ **Single source of truth**: No state synchronization issues
- ✅ **Natural persistence**: State persists with conversation
- ✅ **Audit trail**: Full history of intents and context
- ✅ **Simple queries**: Get context when needed, not stored separately

---

## **Implementation Plan**

### **Phase 1: Core Architecture Changes**

#### **Step 1.1: Update IntentData Structure**

**Current IntentData:**

```typescript
export interface IntentData {
  originalUserPrompt: string;
  subIntents: string[];
  subjects?: {...};
  [key: string]: any;
}
```

**New IntentData:**

```typescript
export interface IntentData {
  conversationId: string; // REQUIRED - never have intent without conversation
  originalUserPrompt: string;
  subIntents: string[];
  subjects?: {
    formId?: string[];
    submissionId?: string[];
    submitActionId?: string[];
    submitActionType?: string[];
    accountId?: string[];
    authProviderId?: string[];
    // API UPDATED: startDate/endDate moved to separate dateRange object
    [key: string]: string[] | undefined;
  };
  dateRange?: {
    startDate?: string; // API UPDATED: Now in DateRangeDto (ISO8601 format)
    endDate?: string; // API UPDATED: Now in DateRangeDto (ISO8601 format)
  };
  // NOTE: currentRobot, lastRobot retrieved from conversation.getCurrentRobot()
  [key: string]: any;
}
```

**VERIFIED**: startDate/endDate are NEVER part of subjects - they're in separate `dateRange` object per API spec

#### **Step 1.2: Update Intent Handler Interface**

**Current Interface:**

```typescript
interface IntentHandler {
  executeIntent(
    intentData: IntentData,
    callbacks: IStreamingCallbacks,
  ): Promise<void>;
}
```

**New Interface:**

```typescript
interface IntentHandler {
  executeIntent(intentData: IntentData): Promise<void>;
  // conversationId comes from intentData.conversationId
  // No callbacks - all messages go through conversation.broadcastMessage()
}
```

#### **Step 1.3: Update Intent Router**

**Current Router:**

```typescript
async routeIntent(intentResult: IntentParsingResponse, callbacks: IStreamingCallbacks): Promise<void>
```

**New Router:**

```typescript
async routeIntent(intentData: IntentData): Promise<void> {
  // 1. Send acknowledgment
  await conversation.broadcastMessage({
    conversationId: intentData.conversationId,
    fromRole: SYSTEM,
    toRole: USER,
    content: {type: 'text/plain', payload: 'Intent received, processing...'}
  });

  // 2. Route to handler (no callbacks)
  const handler = this.getHandler(intentData.intent);
  await handler.executeIntent(intentData);
}
```

### **Phase 2: Uniform Message Broadcasting**

#### **Step 2.1: Create Conversation Specialty Methods**

**CRITICAL PRINCIPLE**: Never create messages manually - ConversationManager provides specialty functions

**Core Content Structure** (heavily used, continue using):

```typescript
content: {
  type: 'text/plain' | 'context/dynamic' | 'sumo-search/report' | ...,
  payload: any
}
```

**ConversationManager Specialty Methods:**

```typescript
class ConversationManager {
  // NEVER require manual message creation - only content + conversationId
  // Uses proper TConversationMessageContent typing (already used EVERYWHERE)

  async addMessageSystemNotification(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // Creates system notification message (toRole: USER, fromRole: SYSTEM)
    // Purpose: Acknowledgments, status updates, progress notifications
    // Visible to: ALL clients (user-facing notifications)
    await this.broadcastMessage({
      conversationId,
      fromRole: SYSTEM,
      toRole: USER,
      content,
      // All other fields auto-generated (fromUserId, timestamps, messageId, etc.)
    });
  }

  async addMessageAsContext(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // Creates context message (toRole: ROBOT, fromRole: SYSTEM)
    // Purpose: Provide context data to robot for future prompts
    // Visible to: Robot (full content) + User (summary via client decoration)
    await this.broadcastMessage({
      conversationId,
      fromRole: SYSTEM,
      toRole: ROBOT,
      content,
      // Robot sees full content, user sees decorated summary
    });
  }

  async addMessageRequestRobotResponse(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // Creates prompt message + triggers robot response
    // Purpose: Send prompt to robot and get response back to user
    // Flow: 1. Add prompt to conversation, 2. Call robot, 3. Robot response added
    await this.broadcastMessage({
      conversationId,
      fromRole: SYSTEM,
      toRole: ROBOT,
      content,
      triggerRobotResponse: true, // Special flag to trigger robot processing
    });
  }

  async addMessageResponseFromRobot(
    conversationId: string,
    content: TConversationMessageContent,
  ): Promise<void> {
    // Creates robot response message (toRole: USER, fromRole: ROBOT)
    // Purpose: Robot's response to user query
    // Visible to: ALL clients (normal robot response display)
    await this.broadcastMessage({
      conversationId,
      fromRole: ROBOT,
      toRole: USER,
      content,
    });
  }

  async sendError(conversationId: string, error: Error): Promise<void> {
    await this.addMessageSystemNotification(conversationId, {
      type: 'text/plain',
      payload: `Error: ${error.message}`,
    });
  }

  // TODO: Consider 'overrides' parameter for special cases:
  // async addMessageAsContext(conversationId: string, content: TConversationMessageContent, overrides?: Partial<IConversationMessage>): Promise<void>

  private async broadcastMessage(message: IConversationMessage): Promise<void> {
    // 1. Store raw message in conversation
    await this.addMessage(message);

    // 2. Get all connected clients and broadcast with decoration
    const clients = this.getConnectedClients(message.conversationId);
    await Promise.all(
      clients.map(async (client) => {
        const decoratedMessage = await client.decorateMessage(message);
        await client.sendMessage(decoratedMessage);
      }),
    );
  }
}
```

### **Detailed Message Type Differences**

#### **1. addMessageSystemNotification() - User Notifications**

```typescript
// Creates: { fromRole: SYSTEM, toRole: USER, content }
```

**Purpose**: Acknowledgments, status updates, progress notifications, errors
**Visibility**: ALL clients see this as user-facing notification
**Client Decoration**:

- **Slack**: `"⚙️ System: Processing your request..."`
- **Dev/Debug**: `[System badge] Processing your request...`
  **When to Use**: Immediate acknowledgments, job progress, completion notifications

#### **2. addMessageAsContext() - Robot Context**

```typescript
// Creates: { fromRole: SYSTEM, toRole: ROBOT, content }
```

**Purpose**: Provide context data to robot for future prompts (does NOT trigger response)
**Visibility**: Robot sees full content, user sees decorated summary
**Client Decoration**:

- **Slack**: `"🤖 Robot content loaded: Form context for 5375703 (8 submit actions)"`
- **Dev/Debug**: `[Expandable JSON panel with full context data]`
  **When to Use**: Form context, Sumo report data, knowledge base results

#### **3. addMessageRequestRobotResponse() - Robot Prompts**

```typescript
// Creates: { fromRole: SYSTEM, toRole: ROBOT, content, triggerRobotResponse: true }
```

**Purpose**: Send prompt to robot AND trigger robot response to user
**Visibility**: Robot sees prompt, user typically does NOT see prompt (hidden from user)
**Special Behavior**: Automatically calls robot and adds robot response to conversation
**Client Decoration**:

- **Slack**: Usually hidden from user (internal robot communication)
- **Dev/Debug**: `[Debug panel] Robot prompt sent: [first 100 chars]...`
  **When to Use**: Final prompt after context is loaded, triggering robot analysis

#### **4. addMessageResponseFromRobot() - Robot Responses**

```typescript
// Creates: { fromRole: ROBOT, toRole: USER, content }
```

**Purpose**: Robot's response to user query
**Visibility**: ALL clients see this as normal robot response
**Client Decoration**:

- **All Clients**: Display normally (standard robot response formatting)
  **When to Use**: When robot generates response (usually automatic via addMessageRequestRobotResponse)

### **Message Flow Example**

```typescript
// Intent handler typical flow:
async executeContextDynamic(intentData: IntentData): Promise<void> {
  const conversationId = intentData.conversationId;

  // 1. Acknowledge (user sees immediately)
  await conversation.addMessageSystemNotification(conversationId, {
    type: 'text/plain',
    payload: 'Fetching form context...'
  });

  // 2. Add context data (robot sees full, user sees summary)
  await conversation.addMessageAsContext(conversationId, {
    type: 'context/dynamic',
    payload: JSON.stringify(formContextData)
  });

  // 3. Trigger robot response (robot analyzes context and responds to user)
  await conversation.addMessageRequestRobotResponse(conversationId, {
    type: 'text/plain',
    payload: 'Please analyze this form context and help the user with their question'
  });

  // 4. Robot response automatically added via addMessageResponseFromRobot()
}
```

### **What Makes Each Message Type Different**

#### **Message Creation and Storage Differences**

**All methods accept ONLY** `(conversationId: string, content: TConversationMessageContent)`:

- **Content**: Uses existing `TConversationMessageContent` typing (heavily used everywhere)
- **Auto-generated fields**: `messageId`, `fromUserId`, `createdAt`, `updatedAt`
- **Role assignment**: Each method sets appropriate `fromRole` and `toRole`

#### **Message Role Assignment Differences**

**1. System Notifications** (`addMessageSystemNotification`):

- **fromRole**: INTENT_PROCESSOR, **toRole**: USER
- **Purpose**: User-facing notifications and acknowledgments

**2. Robot Context** (`addMessageAsContext`):

- **fromRole**: INTENT_PROCESSOR, **toRole**: ROBOT
- **Purpose**: Context data for robot (user sees summary)

**3. Robot Prompts** (`addMessageRequestRobotResponse`):

- **fromRole**: INTENT_PROCESSOR, **toRole**: ROBOT
- **Special**: `triggerRobotResponse: true` flag
- **Purpose**: Triggers robot response to user

**4. Robot Responses** (`addMessageResponseFromRobot`):

- **fromRole**: ROBOT, **toRole**: USER
- **Purpose**: Robot's response to user query

#### **Client Broadcast Differences**

**Each message type broadcasts to ALL clients but with different decoration:**

**System Notification** → **All clients show to user**:

- Slack: `"⚙️ Processing your request..."`
- Dev/Debug: `[System] Processing your request...`

**Robot Context** → **Robot gets full, user gets summary**:

- Slack: `"🤖 Context loaded: Form 5375703 (8 actions)"`
- Dev/Debug: `[Context Panel] {full JSON data}`

**Robot Prompt** → **Usually hidden from user**:

- Slack: No display (internal robot communication)
- Dev/Debug: `[Debug] Robot prompt: "Please analyze..."`

**Robot Response** → **All clients show normally**:

- Slack: `"Based on the form context, I can help you with..."`
- Dev/Debug: `[Robot] Based on the form context, I can help you with...`

#### **Behavior Differences**

**Only `addMessageRequestRobotResponse()` has special behavior:**

- **Stores message** in conversation
- **Calls robot** with conversation context
- **Robot response** automatically added via `addMessageResponseFromRobot()`
- **User sees robot response**, not the prompt

**All other methods:**

- **Store message** in conversation
- **Broadcast to clients** with decoration
- **No additional processing**

**Usage in Intent Handlers:**

```typescript
// Clean, simple intent handler:
async executeIntent(intentData: IntentData): Promise<void> {
  const conversationId = intentData.conversationId;

  // 1. Immediate acknowledgment (user sees)
  await conversation.addMessageSystemNotification(conversationId, {
    type: 'text/plain',
    payload: 'Processing your request...'
  });

  // 2. Context data (robot sees full, user sees summary)
  await conversation.addMessageAsContext(conversationId, {
    type: 'context/dynamic',
    payload: JSON.stringify(formData)
  });

  // 3. Robot prompt (triggers robot response to user)
  await conversation.addMessageRequestRobotResponse(conversationId, {
    type: 'text/plain',
    payload: 'Please analyze this form context and respond to user'
  });
}
```

#### **Step 2.2: Client Decoration System**

**Slack Client Decorator:**

```typescript
class SlackClientDecorator {
  decorateMessage(message: IConversationMessage): string {
    if (
      message.toRole === 'ROBOT' &&
      message.contentType === 'context/dynamic'
    ) {
      // Robot context → summary for Slack
      const summary = this.summarizeContext(message.content);
      return `🤖 Robot content loaded: ${summary}`;
    }

    if (message.toRole === 'USER') {
      // User message → display normally
      return message.content.payload;
    }

    // Default handling
    return message.content.payload;
  }
}
```

**Dev/Debug Client Decorator:**

```typescript
class DevDebugClientDecorator {
  decorateMessage(message: IConversationMessage): DisplayMessage {
    if (
      message.toRole === 'ROBOT' &&
      message.contentType === 'context/dynamic'
    ) {
      // Robot context → full expandable JSON
      return {
        type: 'expandable-json',
        title: 'Context Loaded',
        content: message.content.payload,
        expanded: false,
      };
    }

    // All other messages → display normally
    return {
      type: 'standard',
      content: message.content.payload,
    };
  }
}
```

### **Phase 3: Intent Handler Refactoring**

#### **Step 3.1: Remove Callbacks from ContextDynamicJobExecutor**

**Current Implementation:**

```typescript
async executeIntent(intentData: IntentData, callbacks: IStreamingCallbacks): Promise<void> {
  const conversationId = callbacks.conversationId;
  // ... complex callback routing
}
```

**New Implementation:**

```typescript
async executeIntent(intentData: IntentData): Promise<void> {
  const conversationId = intentData.conversationId;

  // Send context message (robot sees, user sees summary)
  await this.conversationService.broadcastMessage({
    conversationId,
    fromRole: ROBOT,
    toRole: ROBOT,
    contentType: 'context/dynamic',
    content: {type: 'context/dynamic', payload: JSON.stringify(contextData)}
  });

  // Send user summary message
  await this.conversationService.broadcastMessage({
    conversationId,
    fromRole: SYSTEM,
    toRole: USER,
    content: {type: 'text/plain', payload: 'Form context loaded successfully'}
  });
}
```

#### **Step 3.2: Update All Intent Handlers**

- **SumoReportSingleJobExecutor**: Remove callbacks, use `intentData.conversationId`
- **SumoReportMultiJobExecutor**: Remove callbacks, use `intentData.conversationId`
- **KnowledgeBaseJobExecutor**: Remove callbacks, use `intentData.conversationId`

### **Phase 4: Long-Running Job Architecture**

#### **Step 4.1: Non-Blocking Job Pattern**

**Job Flow with Conversation Broadcasting:**

```typescript
async executeSumoReport(intentData: IntentData): Promise<void> {
  const conversationId = intentData.conversationId;

  // 1. Acknowledgment (immediate)
  await conversation.broadcastMessage({
    conversationId,
    fromRole: SYSTEM,
    toRole: USER,
    content: {type: 'text/plain', payload: 'Sumo report job started...'}
  });

  // 2. Start non-blocking job
  this.startNonBlockingJob(async () => {
    // 3. Progress updates
    await conversation.broadcastMessage({
      conversationId,
      fromRole: SYSTEM,
      toRole: USER,
      content: {type: 'text/plain', payload: 'Processing data... (2/5 minutes)'}
    });

    // 4. Context message for robot
    await conversation.broadcastMessage({
      conversationId,
      fromRole: ROBOT,
      toRole: ROBOT,
      contentType: 'sumo-search/report',
      content: {type: 'sumo-search/report', payload: JSON.stringify(reportData)}
    });

    // 5. Final user message with download links
    await conversation.broadcastMessage({
      conversationId,
      fromRole: SYSTEM,
      toRole: USER,
      content: {type: 'text/plain', payload: 'Report complete: [download link]'}
    });
  });
}
```

### **Phase 5: Implementation Order**

#### **Step 1: Update IntentData Interface**

- [ ] Add `conversationId: string` to IntentData (required)
- [ ] Update all intent creation to include conversationId
- [ ] Update TypeScript interfaces

#### **Step 2: Create Conversation Broadcasting**

- [ ] Add `broadcastMessage()` method to ConversationService
- [ ] Add `sendError()` method to ConversationService
- [ ] Create client decoration interfaces

#### **Step 3: Update Intent Router**

- [ ] Change signature to `routeIntent(intentData: IntentData)`
- [ ] Add acknowledgment broadcasting using `intentData.conversationId`
- [ ] Remove all callback parameter passing

#### **Step 4: Refactor One Intent Handler**

- [ ] Start with ContextDynamicJobExecutor
- [ ] Remove callbacks parameter
- [ ] Use `intentData.conversationId` for all messages
- [ ] Use `conversation.broadcastMessage()` only
- [ ] Test thoroughly with both Slack and dev/debug

#### **Step 5: Update All Intent Handlers**

- [ ] Apply same pattern to SumoReportSingleJobExecutor
- [ ] Apply same pattern to SumoReportMultiJobExecutor
- [ ] Apply same pattern to KnowledgeBaseJobExecutor
- [ ] Remove all callback dependencies

#### **Step 6: Clean Up Legacy Systems**

- [ ] Remove unused callback creation methods
- [ ] Remove dual message routing from ChatManagerService
- [ ] Simplify WebSocket gateway broadcasting
- [ ] Remove callback-based error handling

#### **Step 7: Client Decoration Implementation**

- [ ] Implement Slack client decoration
- [ ] Implement dev/debug client decoration
- [ ] Test message decoration for different content types

#### **Step 8: Integration Testing**

**NOTE**: We will do testing AFTER we verify everything is working

- [ ] Verify Slack integration works with new system
- [ ] Verify dev/debug client works with new system
- [ ] Verify no duplicate messages
- [ ] Verify rich data consistency across clients
- [ ] Verify long-running jobs (Sumo reports) work
- [ ] Verify error handling works
- [ ] **THEN** write/fix tests after architecture is stable

### **Expected Outcomes**

#### **Before (Current Broken State)**

```
User → Intent → Router → Handler → Callbacks → Multiple paths → Different messages to different clients
```

- ❌ Slack gets basic data, dev/debug gets rich data
- ❌ Duplicate messages from multiple routing paths
- ❌ Callback hell with complex parameter passing
- ❌ State management scattered across systems

#### **After (Clean Architecture)**

```
User → Intent → Router → Handler → Conversation.broadcastMessage() → ALL clients get same raw data → Client-specific decoration
```

- ✅ **All clients get identical raw data**
- ✅ **Single message routing path**
- ✅ **Client controls its own presentation**
- ✅ **Conversation-based state management**
- ✅ **No callback dependencies**

### **Critical Success Factors**

#### **Must Haves**

1. **Intent ALWAYS includes conversationId** - never separate them
2. **Single broadcast path** - no dual routing systems
3. **Conversation as state store** - no separate state management
4. **Client decoration responsibility** - server sends raw data only
5. **Non-blocking jobs** - long operations don't block other requests

#### **Must Not Haves**

1. **No callback parameters** in intent handlers
2. **No client-specific message creation** in server logic
3. **No separate state storage** outside conversation
4. **No blocking operations** in intent processing
5. **No duplicate message paths**

### **Risk Mitigation**

#### **Incremental Implementation**

- **One handler at a time** - don't break everything at once
- **Test each step** before proceeding to next
- **Maintain backward compatibility** during transition
- **Keep existing tests working**

#### **Rollback Strategy**

- **Git branch for implementation** - easy to revert if needed
- **Feature flags** for new vs old routing
- **Gradual client migration** - dev/debug first, then Slack

### **Success Metrics**

#### **Technical Metrics**

- ✅ **Zero duplicate messages** in any client
- ✅ **Identical data** in Slack and dev/debug for same intent
- ✅ **Sub-5-second acknowledgments** for all intents
- ✅ **Concurrent job support** without blocking
- ✅ **Clean error messages** in all clients

#### **User Experience Metrics**

- ✅ **Slack users get rich context data** (not "protectionType: undefined")
- ✅ **Dev/debug users get clean single messages** (not triples)
- ✅ **Immediate feedback** on intent submission
- ✅ **Progress updates** during long jobs
- ✅ **Download links** work consistently

This architecture will solve the fundamental message routing issues by treating conversation as the central hub with uniform broadcasting to client-specific decorators.
