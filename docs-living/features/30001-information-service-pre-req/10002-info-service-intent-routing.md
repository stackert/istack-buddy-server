# Intent Parsing Service Implementation Plan

## ⚠️ CRITICAL REQUIREMENTS ⚠️

- **After work done here, we will be backward compatible.** We are doing major upgrade and we will not remain backward compatible after we are finished. But this step is not a breaking change.

- **We need to build different system prompts** that are generic for robots that will do intent/prompt parsing. The current robot role / system message will conflict. We need to write simple system prompt, then append the correct prompt for each functionality (parse), or current behavior.

- **We will add 'parsePromptIntent' to slacky.** We will add an argument to getRobotByName (I think we have a factory or something) or not, we could do getRobotByName(intent.robotName) at some later time do getRobotByIntent (but for now we want simple).

- **We will have to add to robots (base class) `performIntent` or `executeIntent`.** We need to be careful here because current setup uses `acceptMessage*Response` which requires callbacks. So when we do `executeIntent` it will need to have all the proper callbacks for acceptMessage\*Response.

- **When we are done with this step, the system will run the same way it always has.** We are only adding the functionality.

- **We do not need to add this functionality to Marv,** so we should create same function executeIntent that will simply call marv with the intent.userOriginalPrompt or similar.

- **We need to add unit testing only.** We require +90% coverage.

- **IMPORTANT: we need to define intent type IMPORTANT**

## Action Plan

### Phase 1: Define Intent Types (`src/common/types/intent-parsing.types.ts`)

**CRITICAL FIRST STEP** - Define all intent-related TypeScript types:

```typescript
export interface IntentParsingResponse {
  robotName: string;
  intent: string;
  intentData: IntentData;
}

export interface IntentData {
  originalUserPrompt: string;
  subIntents: string[]; // MISSING from current types - MUST ADD
  subjects?: {
    formId?: string[];
    submissionId?: string[];
    case?: string[];
    jira?: string[];
    account?: string[];
    authProvider?: string[];
    startDate?: string[];
    endDate?: string[];
    // Additional subjects may be added as needed
    [key: string]: string[] | undefined;
  };
  [key: string]: any; // Allow additional robot-specific parameters
}

export interface IntentParsingError {
  error: string;
  reason: string;
}

export type IntentParsingResult = IntentParsingResponse | IntentParsingError;

// Robot Intent Registry Types
export interface RobotIntent {
  intent: string;
  subIntents: string[];
  requiredSubjects?: string[];
  description?: string;
  priority?: number; // For routing when multiple robots handle same intent
}

export interface RobotIntentRegistry {
  robotName: string;
  supportedIntents: RobotIntent[];
}
```

**CURRENT INTENTS & SUBINTENTS** (from existing code):

🔧 **AnthropicMarv** - Intent: "debugForm"

- SubIntents: ["checkFieldsLogic", "checkFieldsCalculation", "checkFieldsCommonIssue", "createForm", "createFormField", "createFormFieldUniqueSlug", "removeFormFieldUniqueSlug", "createFormLogicCalculationStash", "removeFormFieldsLogicCalculation", "restoreFormLogicCalculationStash", "removeFormLogicCalculationStash"]

🔍 **KnobbyOpenAiSearch** - Intent: "searchKnowledge"

- SubIntents: ["findContextDocumentHelpArticles", "findContextDocumentHelpArticleSaml", "findContextDocumentHelpArticleSso", "findContextDocumentHelpArticleForm", "findContextDocumentHelpArticleFormConfiguration", "findContextDocumentHelpArticleFormFieldConfiguration", "findContextDynamic", "findContextDynamicAccount", "findContextDynamicForm", "findContextDynamicAuthProvider", "findSlackConverationRelated", "findSlackConverationRelatedAnyChannel", "findSlackConverationRelatedSameChannel", "recommend", "recommendForm", "recommendFormField", "recommendFormFieldCalculation", "recommendFormFieldLogic"]

📊 **KnobbyOpenAiSumoReport** - Intent: "generateSumoReport"

- SubIntents: ["searchSumoLogSubmissionErrors", "searchSumoLogSubmitActionErrors", "searchSumoLogIntegrationErrors", "searchSumoLogWebhookErrors", "searchSumoLogEmailErrors", "searchSumoLogEmailConfirmationErrors", "searchSumoLogEmailNotificationErrors", "searchSumoLogEmailConfigurationErrors", "searchSumoLogFormSubmissionLifeCycle", "searchSumoLogFormSubmissionSubmitActionRun"]

🤖 **SlackyOpenAiAgent** - Intent: "assistUser" (CATCH-ALL)

- SubIntents: ["parseUserPrompt", "handleFollowUp", "clarifyRequest", "generalAssistance", "conversation"]

**INTENT RELATIONSHIP MODEL**:

- **Many-to-Many**: Robots can handle multiple intents, intents can be handled by multiple robots
- **Robot Intent Registry**: Each robot defines its supported intents and subIntents
- **Intent Prompt Segments**: Each robot provides prompt segments for its intents
- **SubIntent-Based Routing**: When multiple robots handle same intent, route based on subIntent specificity

### Phase 2: Create Intent Parsing Service (`src/common/services/intent-parsing.service.ts`)

**Core Service**:

- OpenAI GPT-4 integration for intent analysis
- **Slacky-based generic system prompt** (separate from robot-specific prompts)
- **Subject Harvest Prompt** - Entity extraction logic (formId, submissionId, case, jira, account, authProvider, startDate, endDate)
- Robot selection rules
- Conversation context handling

**System Prompt Strategy**:

- **Base Prompt**: Generic intent parsing instructions
- **Personality Prompt**: System personality and behavior guidelines
- **Robot Intent Segments**: Each robot provides prompt segments for its intents
- **Dynamic Assembly**: Intent parsing service combines base + personality + robot intent segments
- **Avoid conflicts** with existing robot role/system messages

**Intent Management Architecture**:

- **Robot Intent Registry**: Each robot defines its supported intents via `getSupportedIntents()`
- **Intent Prompt Segments**: Each robot provides prompt segments via `getIntentPromptSegment(intent)`
- **Dynamic Prompt Building**: Intent parsing service combines base prompt + personality prompt + robot intent segments
- **Extensible Design**: New robots can register intents without modifying core parsing logic
- **SubIntent-Based Routing**: When multiple robots handle same intent, route based on subIntent specificity

### Phase 3: Add parsePromptIntent to Slacky (`src/robots/SlackyOpenAiAgent.ts`)

**New Method**:

```typescript
async parsePromptIntent(
  messageText: string,
  conversationContext?: { currentRobot?: string }
): Promise<IntentParsingResult>
```

**Integration**:

- Use existing `getRobotByName()` method
- Add argument to support intent-based robot selection
- Keep simple for now (no `getRobotByIntent` yet)

### Phase 4: Add executeIntent to Robot Base Class (`src/robots/AbstractRobotChat.ts`)

**New Method**:

```typescript
async executeIntent(
  intentData: IntentData,
  callbacks: IStreamingCallbacks
): Promise<void>
```

**Implementation Strategy**:

- **Handle callbacks properly** - Must work with existing `acceptMessage*Response` pattern
- **Pass all required callbacks** to maintain current functionality
- **Maintain streaming support** for real-time responses

### Phase 5: Marv Special Handling (`src/robots/AnthropicMarv.ts`)

**Simple Implementation**:

```typescript
async executeIntent(
  intentData: IntentData,
  callbacks: IStreamingCallbacks
): Promise<void> {
  // Simple pass-through to existing Marv functionality
  const message = {
    content: { type: 'text/plain', payload: intentData.originalUserPrompt }
  };
  return this.acceptMessageStreamResponse(message, callbacks);
}
```

**No new functionality** - Just route to existing Marv behavior.

### Phase 6: Chat Manager Integration (`src/chat-manager/chat-manager.service.ts`)

**Add Intent Routing**:

- Call `parsePromptIntent` before robot selection
- Use intent result to select appropriate robot
- Pass intent data to `executeIntent`
- **Maintain existing flow** - only add intent layer

### Phase 7: Testing (90%+ Coverage Required)

**Unit Tests Only**:

- Intent parsing service with various message types
- Entity extraction accuracy
- Robot selection logic
- Error handling for unclear requests
- Marv pass-through functionality
- Chat manager integration

## Implementation Order

1. **Define Intent Types** (CRITICAL FIRST)
2. **Create Intent Parsing Service**
3. **Add parsePromptIntent to Slacky**
4. **Add executeIntent to Base Class**
5. **Implement Marv Special Handling**
6. **Integrate with Chat Manager**
7. **Add Comprehensive Unit Tests**

## Success Criteria

- **System runs identically** to current behavior
- **Intent parsing works** for Information Services robots
- **90%+ test coverage** achieved
- **No breaking changes** to existing functionality
- **Backward compatibility** maintained

## Adding New Robots & Intents

### **How to Add New Robots**:

1. **Extend AbstractRobotChat** and implement required methods
2. **Define Intent Registry** via `getSupportedIntents()`:
   ```typescript
   getSupportedIntents(): RobotIntent[] {
     return [
       {
         intent: "searchKnowledge",
         subIntents: ["comprehensive", "semantic", "keyword"],
         requiredSubjects: ["query"],
         description: "Handles knowledge base search operations"
       },
       {
         intent: "generateSumoReport",
         subIntents: ["errorAnalysis", "performance", "audit"],
         requiredSubjects: ["startDate", "endDate"],
         description: "Generates analytical reports from Sumo Logic logs"
       }
     ];
   }
   ```
3. **Provide Intent Prompt Segments** via `getIntentPromptSegment(intent)`:
   ```typescript
   getIntentPromptSegment(intent: string): string {
     switch(intent) {
       case "searchKnowledge": return "Search robot handles knowledge base queries with multiple strategies...";
       case "generateSumoReport": return "Sumo Report robot generates analytical reports from Sumo Logic log data...";
     }
   }
   ```
4. **Implement executeIntent()** method with proper callback handling
5. **Register with RobotService** - automatically discovered

### **How to Add New Intents**:

1. **Update IntentData types** if new subject types needed
2. **Add intent to robot's getSupportedIntents()**
3. **Add prompt segment via getIntentPromptSegment()**
4. **Update intent parsing service** to recognize new intent patterns
5. **Add unit tests** for new intent parsing

### **Intent Relationship Model**:

- **Many-to-Many**: Robots ↔ Intents (one robot can handle multiple intents, one intent can be handled by multiple robots)
- **SubIntents**: Specific actions within an intent (e.g., "comprehensive" search vs "semantic" search)
- **Subjects**: Entity extraction (formId, submissionId, etc.) - extensible via `[key: string]: string[]`
- **Dynamic Prompt Building**: Base prompt + robot-specific intent segments = complete parsing prompt

### **Prompt Strategy**:

- **Base Prompt**: Generic intent parsing instructions
- **Personality Prompt**: System personality and behavior guidelines
- **Robot Intent Segments**: Each robot describes how it handles specific intents
- **Dynamic Assembly**: Intent parsing service combines base + personality + relevant robot segments
- **No Conflicts**: Robot role/system messages remain separate from intent parsing

### **SubIntent-Based Routing Strategy**:

- **Strong Comparator**: Match on intent (exact match required)
- **Loose Comparator**: Match on subIntent (best fit selection)
- **Multiple Robot Handling**: When multiple robots handle same intent, route based on subIntent specificity
- **Fallback Strategy**: If subIntent unclear, use robot priority or default to catch-all robot

## Dependencies

- OpenAI API key
- Existing robot service registry
- Chat manager service
- AbstractRobotChat base class
