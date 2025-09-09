# Robot Router: Intent Parsing & Multi-Robot Routing System

## Overview

A specialized service that analyzes user messages and routes them to appropriate robots. Uses direct OpenAI API calls for intent parsing and intelligent routing decisions without robot framework overhead.

## Steps to Implement

1. Create IntentParsingService
2. Add abstract handleIntentWithTools to AbstractRobotChat
3. Implement handleIntentWithTools in all robots
4. Update ChatManager to use intent parsing
5. Modify ChatManager to call handleIntentWithTools only
6. Add currentRobot tracking to conversations

## Architecture

### Intent Parsing Service (NOT a robot)
- **Implementation**: `IntentParsingService` (specialized service)
- **Purpose**: Parse natural language → structured robot routing
- **Input**: User message (most recent only) + conversation context (last robot used)
- **Output**: Structured intent with robot routing and parameters

### Core Intent Format

```json
{
  "robotName": "[robot.name property]",
  "intent": "[action category]", 
  "intentData": {
    "originalUserPrompt": "[full user message]",
    "subjects": {
      "formId": ["1234999"],
      "submissionId": ["567890"] 
    },
    "[tool-required-params]": "...",
    "subIntents": ["[specific-action]"]
  }
}
```

## Supported Robots & Routing

### 🔧 AnthropicMarv
- **robotName**: `"AnthropicMarv"`
- **intent**: `"manageForm"`
- **Required**: `formId` (always required for Marv tools)
- **SubIntents**: Defined by `AnthropicMarv.getSubIntents()` - maps to actual tool names
- **Subject Types**: `["formId", "fieldId"]` - registered via `AnthropicMarv.getKnownSubjectKeys()`
- **Routes when**: troubleshoot, debug, validate, manage form + formId present

### 🤖 SlackyOpenAiAgent (Catch-All & Conversational)
- **robotName**: `"SlackyOpenAiAgent"`
- **intent**: `"assistUser"` 
- **Required**: None (handles any request)
- **SubIntents**: `["handleFollowUp", "clarifyRequest", "generalAssistance"]`
- **Subject Types**: `["formId", "submissionId", "accountId", "case"]` - broad support
- **Routes when**: 
  - Intent parsing fails
  - Follow-up questions without clear context
  - General conversational assistance
  - Ambiguous requests

### 🔍 KnobbyOpenAiSearch  
- **robotName**: `"KnobbyOpenAiSearch"`
- **intent**: `"searchKnowledge"`
- **Required**: `query`
- **SubIntents**: Defined by `KnobbyOpenAiSearch.getSubIntents()` - maps to search tools
- **Subject Types**: `null` - searches don't require specific entity IDs
- **Routes when**: find, search, help, documentation, guides

### 📊 KnobbyOpenAiSumoReport
- **robotName**: `"KnobbyOpenAiSumoReport"`  
- **intent**: `"generateReport"`
- **Required**: `queryName`, `subject`
- **SubIntents**: `["submitActionReport", "submissionCreatedReport", "authProviderMetrics"]`
- **Subject Types**: `["formId", "submissionId", "submitActionId"]`
- **Routes when**: report, logs, analyze, track, metrics

### 🔄 KnobbyOpenAiContextDynamic
- **robotName**: `"KnobbyOpenAiContextDynamic"`
- **intent**: `"getLiveData"`
- **Required**: varies by context type
- **SubIntents**: `["getFormContext", "getAccountContext", "getAuthProviderContext"]`
- **Subject Types**: `["formId", "accountId", "authProviderId"]`
- **Routes when**: current, live, get state, real-time

## Robot Registration Protocol

### SubIntent Registration
```typescript
// Each robot defines its own subIntents based on actual tools
export abstract class AbstractRobot {
  static getSubIntents(): string[] {
    // Return array of subIntent names that map to tools
  }
}

export class AnthropicMarv extends AbstractRobotChat {
  static getSubIntents(): string[] {
    return ["validateLogic", "validateCalculations", "getOverview", "createForm"];
  }
}
```

### Subject Type Registration  
```typescript
// Each robot declares what subject types it understands
export abstract class AbstractRobot {
  static getKnownSubjectKeys(): string[] {
    // Return entity types this robot can work with
  }
}

export class AnthropicMarv extends AbstractRobotChat {
  static getKnownSubjectKeys(): string[] {
    return ["formId", "fieldId", "submitActionId"];
  }
}
```

## Conversation Flow & Fallback Strategy

### Conversation State Tracking
**Integration Point**: Conversation entity/record should track current robot

```typescript
// Enhanced conversation data model (ChatManager responsibility)
interface Conversation {
  id: string;
  participantIds: string[];
  // ... existing fields ...
  currentRobot?: string;           // Last robot used for this conversation
  robotSwitchedAt?: Date;          // When robot was last changed
}

// Or in conversation metadata
conversationMetadata: {
  lastRobotUsed: "AnthropicMarv",
  lastActiveTimestamp: "2025-09-06T14:00:00Z"
}
```

**Flow**: Each message → ChatManager adds to conversation → Updates currentRobot field

### Routing Logic Priority
1. **Clear intent** → Route to specific robot
2. **Follow-up question** + last robot = Marv/Search/Sumo → Continue with same robot  
3. **Follow-up question** + last robot = Slacky → Use intent parsing (Slacky doesn't maintain context)
4. **Ambiguous request** → Route to SlackyOpenAiAgent (catch-all)
5. **Intent parsing failure** → Route to SlackyOpenAiAgent (fallback)

### SlackyOpenAiAgent as Conversational Hub
- **Handles follow-up questions** when intent unclear
- **Provides clarification** when user requests are ambiguous  
- **General assistance** for broad questions
- **Can handoff** to other robots: "It sounds like you want to troubleshoot a form, let me connect you to Marv..."

## Smart Entity Extraction (Subjects)

### Dynamic Subject Registration
```typescript
// Built from robot registrations
const allKnownSubjects = [
  ...AnthropicMarv.getKnownSubjectKeys(),
  ...KnobbyOpenAiSearch.getKnownSubjectKeys(), 
  ...SlackyOpenAiAgent.getKnownSubjectKeys()
];
```

### Extraction Patterns (Fixed Specification)
- **Form IDs**: "form 1234", "formId:1234", URLs like "/admin/form/settings/1234/"
- **Submissions**: "submission 567890", "submissionId:567890"
- **Cases**: "*Case Number* 00821037"
- **Jira**: "https://formstack.atlassian.net/browse/FORM-3545"

## Implementation Strategy: Universal Intent Processing

### System Flow (Exact Responsibility Chain)

## 🔒 **CRITICAL: Responsibility Boundaries**

### Slack API Service
- **File**: `src/istack-buddy-slack-api/istack-buddy-slack-api.service.ts`
- **Responsibility**: Receive Slack events → Pass to ChatManager  
- **Changes**: NONE (existing flow preserved)

### Chat Manager Service  
- **File**: `src/chat-manager/chat-manager.service.ts`
- **Responsibility**: Conversation management + Intent parsing + Robot routing
- **Changes**: Add intent parsing BEFORE robot selection
- **Critical**: Message still added to conversation FIRST, robot selection happens AFTER

### All Robots
- **Files**: All robot implementations
- **Responsibility**: Accept intent data + Execute tools + Generate responses
- **Changes**: Add universal `handleIntentWithTools()` method
- **Critical**: Existing `acceptMessage*()` methods preserved unchanged

#### 1. Slack API Service (NO CHANGES)
**File**: `src/istack-buddy-slack-api/istack-buddy-slack-api.service.ts`  
**Method**: `handleAppMention()` line 158

```typescript
// Current flow (UNCHANGED)
await this.chatManagerService.addMessageFromSlack(
  conversationRecord.internalConversationId,
  { type: 'text', payload: event.text },
  conversationRecord.sendConversationResponseToSlack,
);
```
**Responsibility**: Receive Slack event → Pass to ChatManager (no intent processing here)

#### 2. Chat Manager Service (ENHANCED)
**File**: `src/chat-manager/chat-manager.service.ts`  
**Method**: `addMessageFromSlack()` line 575

**Current Flow**:
```typescript
// 1. Add user message to conversation first (UNCHANGED)
const userMessage = await this.addUserMessage(conversationId, content.payload, ...);

// 2. Select robot (CURRENT - hardcoded to SlackyOpenAiAgent)
const robot = this.robotService.getRobotByName('SlackyOpenAiAgent')!;

// 3. Call robot (CURRENT)
await robot.acceptMessageMultiPartResponse(message, internalRobotCallback);
```

**Enhanced Flow**:
```typescript
// CRITICAL: Message storage happens FIRST (conversation integrity preserved)
// 1. Add user message to conversation (UNCHANGED - line 583-590)
const userMessage = await this.addUserMessage(
  conversationId,
  content.payload,
  'cx-slack-robot',
  UserRole.CUSTOMER,
  UserRole.AGENT,
);

// 2. Parse intent for robot selection (NEW - replaces hardcoded robot selection)
const intentResult = await this.intentParsingService.parseIntent(content.payload);
const targetRobotName = intentResult.robotName || 'SlackyOpenAiAgent';

// 3. Update conversation robot tracking (NEW)
await this.updateConversationCurrentRobot(conversationId, targetRobotName);

// 4. Create robot message object (UNCHANGED - line 603-616)
const message: IConversationMessage<TConversationMessageContentString> = {
  id: uuidv4(),
  conversationId,
  content: { type: 'text/plain', payload: content.payload },
  // ... rest unchanged
};

// 5. Call robot with intent (NEW UNIVERSAL METHOD - replaces acceptMessageMultiPartResponse)
await robot.handleIntentWithTools(
  intentResult.intentData, 
  message, 
  internalRobotCallback  // Same callback that handles sendMessageToSlack
);
```

**CRITICAL ChatManager Requirements**:
- **Message integrity**: User message added to conversation BEFORE robot processing (UNCHANGED)
- **Conversation state**: Participant tracking, message count, etc. (UNCHANGED)
- **Response flow**: Robot responses added via same callback mechanism (UNCHANGED)
- **Intent parsing**: NEW responsibility - parse before robot selection (not in Slack API)
- **Robot tracking**: NEW responsibility - track currentRobot per conversation
- **Robot invocation**: CHANGED - ChatManager calls `handleIntentWithTools()` NOT `acceptMessage*()`

#### 3. Robot Universal Interface (ALL ROBOTS ENHANCED)

**File**: `src/robots/AbstractRobotChat.ts`
```typescript
export abstract class AbstractRobotChat {
  // EXISTING methods (preserved but ChatManager won't call them directly)
  abstract acceptMessageStreamResponse(message, callbacks): Promise<void>;
  abstract acceptMessageImmediateResponse(message): Promise<Response>;
  abstract acceptMessageMultiPartResponse(message, callback): Promise<Response>;
  
  // NEW universal method (ChatManager ONLY calls this)
  abstract handleIntentWithTools(
    intentData: IntentData, 
    message: IConversationMessage,
    callbacks: IStreamingCallbacks  // ChatManager provides sendMessageToSlack callback
  ): Promise<void>;
}
```

**All Robot Implementation** (Phase 1 - minimal change):
```typescript
// AnthropicMarv, KnobbyOpenAiSearch, SlackyOpenAiAgent, etc.
async handleIntentWithTools(
  intentData: IntentData, 
  message: IConversationMessage, 
  callbacks: IStreamingCallbacks
): Promise<void> {
  // Phase 1: Just use existing method (ignore intent data for now)
  return this.acceptMessageStreamResponse(message, callbacks);
}
```

### Intent Parsing Service
**File**: `src/common/services/intent-parsing.service.ts` (new)

```typescript
@Injectable()
export class IntentParsingService {
  private readonly openAIClient: OpenAI;
  
  async parseIntent(messageText: string): Promise<IntentResult> {
    // Direct OpenAI API call
    // Returns structured intent JSON
  }
}
```

## 🔒 **WHAT DOES NOT CHANGE (Preserved)**

### Chat/Conversation Management
- ✅ **Message storage flow**: `addUserMessage()` → conversation → message persistence  
- ✅ **Conversation integrity**: Participants, message count, conversation state
- ✅ **WebSocket broadcasting**: Real-time message distribution unchanged
- ✅ **Response callbacks**: Robot responses added to conversation same way
- ✅ **Existing tests**: All current ChatManager functionality preserved

### Robot Interfaces  
- ✅ **Existing methods**: `acceptMessage*Response()` methods unchanged
- ✅ **Robot autonomy**: Robots can still select their own tools
- ✅ **Tool execution**: Existing tool patterns unchanged
- ✅ **Response generation**: Current robot response mechanisms preserved

## 🔥 **WHAT CHANGES (Enhanced)**

### ChatManager Enhancement
- **CHANGED**: Robot invocation method - calls `handleIntentWithTools()` instead of `acceptMessage*()`
- **NEW**: Intent parsing before robot selection (replaces hardcoded `SlackyOpenAiAgent`)
- **NEW**: `updateConversationCurrentRobot()` method for conversation state
- **NEW**: Inject and use `IntentParsingService`
- **NEW**: Pass callbacks to `handleIntentWithTools()` (including sendMessageToSlack callback)

### Robot Interface Addition
- **NEW**: Universal `handleIntentWithTools()` method in `AbstractRobotChat` (abstract - all must implement)
- **CHANGED**: ChatManager will ONLY call `handleIntentWithTools()`, NOT `acceptMessage*()` methods
- **INITIAL**: All robots implement by calling existing `acceptMessageStreamResponse()` internally
- **FUTURE**: Robots can optimize by using intent data directly (skip AI tool selection)

## 🎯 **Phase 1 Implementation Impact**

### Minimal Breaking Changes
- **Slack API**: No changes - existing event flow preserved
- **Conversation storage**: No changes - message persistence unchanged  
- **Robot functionality**: Existing behavior preserved (just called through new interface)
- **Existing conversations**: Continue working - just better robot selection

### Required Changes
- **Robot interface**: All robots must implement `handleIntentWithTools()` (abstract method)
- **ChatManager invocation**: Calls `handleIntentWithTools()` instead of `acceptMessage*()`
- **Intent parsing**: Adds intelligent routing (replaces hardcoded SlackyOpenAiAgent selection)
- **Conversation tracking**: Adds `currentRobot` field

### Phase 1 Implementation Strategy
1. **Add abstract method** to `AbstractRobotChat`
2. **Implement in all robots** by calling existing `acceptMessageStreamResponse()`
3. **Update ChatManager** to call `handleIntentWithTools()` instead of `acceptMessage*()`
4. **Add IntentParsingService** for robot selection logic

This approach changes the robot invocation interface but preserves all existing robot functionality and conversation management.

## Live Testing Without Slack

### Test Script: `test-slack-flow.sh`
**Location**: `docs-living/features/30000-information-services/artifacts/scripts/test-slack-flow.sh`

**Purpose**: Test complete Slack flow without sending actual Slack messages

**Usage**:
```bash
# Modify TEST_MESSAGE variable in script, then run:
./docs-living/features/30000-information-services/artifacts/scripts/test-slack-flow.sh
```

**Flow Tested**:
1. **Slack Event Simulation** → Dev/Debug endpoint receives test message
2. **ChatManager Processing** → `addMessageFromSlack()` called with test data
3. **Intent Parsing** → Router analyzes message and selects robot
4. **Robot Execution** → Selected robot processes with `handleIntentWithTools()`
5. **Response Handling** → Mock callback logs robot response

**Test Scenarios**:
- **AnthropicMarv routing**: `"Help troubleshoot form 12345 validation errors"`
- **KnobbyOpenAiSearch routing**: `"Find SAML authentication documentation"`  
- **SlackyOpenAiAgent fallback**: `"What are best practices for security?"`
- **Follow-up handling**: Multiple messages to same conversation

**Debug Output**: Check server logs for detailed intent parsing, robot selection logic, and conversation flow

## Follow-up Question Handling

### SlackyOpenAiAgent Follow-up Response Pattern
When SlackyOpenAiAgent receives ambiguous follow-up questions:

```typescript
// SlackyOpenAiAgent can suggest clarification:
"I'm not sure what you'd like me to help with. Are you trying to:
- Troubleshoot form issues? (I can connect you to Marv)  
- Search for documentation? (I can help you find guides)
- Generate reports? (I can help with log analysis)

Or would you like me to assist with general questions?"
```

## Testing

**Test Script**: `docs-living/features/30000-information-services/artifacts/scripts/test-knobby-sumo-two-job.sh`

Currently tests the intent parsing logic using the temporary intent parser robot implementation. Will be adapted to test the IntentParsingService directly.

## Future Considerations

### Robot Capability Discovery
- **Dynamic registration**: Robots register their capabilities at startup
- **Intent confidence**: Scoring system for routing decisions  
- **Context handoff**: Structured handoff between specialized robots

### Conversation Management
- **Lightweight state**: Only track last robot used per conversation
- **Context timeouts**: Clear conversation context after inactivity
- **Explicit handoff**: Users can explicitly switch robot contexts

This design provides intelligent routing while maintaining simplicity and using SlackyOpenAiAgent as the conversational fallback for ambiguous requests and follow-up questions.