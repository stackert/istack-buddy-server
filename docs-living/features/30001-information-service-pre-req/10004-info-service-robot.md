_TMC_

Editor's note, do not remove.

THIS DOCUMENT HAS NOT BEEN REVIEWED - DO NOT USE UNTIL HUMAN REVIEW

WE NEED TO ADDRESS CITATION (probably not in this doc but it needs to be mentioned somewhere, with th e new content types I think)

_TMC_

# Information Services Robots Implementation

⚠️ **IMPORTANT NOTES**:

- **A)** This is not a complete robot design. This should be sufficient to get robots started but development will have to be done with the human
- **B)** Use this branch `istack-buddy-info-servie-take-1` to reference. WE ARE NOT PORTING or COPYING from istack-buddy-info-servie-take-1, but we can refer to it for snippet examples, etc.

## Overview

This document defines the required implementation for Information Services robots. It outlines the work needed to create specialized robots that intelligently use iStackBuddy Information Services to provide context-aware responses and assistance.

**Required Robots**:

- **KnobbyOpenAiSearch** - Knowledge search
- **KnobbyOpenAiSumoReport** - Log analysis
- **KnobbyOpenAiLiveContext** - Entity data

## References

- **Parent Feature Documentation**: `docs-living/features/30001-information-service-pre-req/00000-info-serv-overview.md`
- **Intent Routing Documentation**: `docs-living/features/30001-information-service-pre-req/10002-info-service-intent-routing.md`
- **API Integration Documentation**: `docs-living/features/30001-information-service-pre-req/10003-info-service-api.md`
- **API Documentation**: `docs-living/features/30000-information-services/artifacts/istack-buddy-information-servcice.yml`

## Required Robots

- KnobbyOpenAiSearch
- KnobbyOpenAiSumoReport
- KnobbyOpenAiLiveContext
- SlackyOpenAiAgent (existing, needs updates)

## Changes in current structure

### A) Changes to proto-type/abstract

- **AbstractRobotChat** now requires `handleIntentWithTools()` method
- All robots must implement intent-based calling interface
- Intent data includes `originalUserPrompt` and `subjects` from Intent Parsing Service

### B) Changes to 'flow'

- **ChatManager** now calls `robot.handleIntentWithTools()` instead of `acceptMessage*Response()`
- **Intent Parsing Service** analyzes user input and routes to appropriate robot
- Robots still use existing `acceptMessageStreamResponse()` internally for response generation

## Robots Described

### 1. KnobbyOpenAiSearch

- **Purpose**: Knowledge search across SLACK, CONTEXT-DOCUMENTS
- **Tools**:
  - prequery
  - review top results
  - review results
- **Intent**: `searchKnowledge` with subIntents:
  - `findContextDocumentHelpArticles`
  - `findContextDocumentHelpArticleSaml`
  - `findContextDocumentHelpArticleSso`
  - `findContextDocumentHelpArticleForm`
  - `findContextDocumentHelpArticleFormConfiguration`
  - `findContextDocumentHelpArticleFormFieldConfiguration`
  - `findContextDynamic`
  - `findContextDynamicAccount`
  - `findContextDynamicForm`
  - `findContextDynamicAuthProvider`
  - `findSlackConversationRelated`
  - `findSlackConversationRelatedAnyChannel`
  - `findSlackConversationRelatedSameChannel`
  - `recommend`
  - `recommendForm`
  - `recommendFormField`
  - `recommendFormFieldCalculation`
  - `recommendFormFieldLogic`
- **preQuery Function**: Analyzes user queries to extract keywords, nouns, proper nouns, domains, and provides AI technical observations. Used to normalize and enhance queries before search execution.
- **Changes**: Added `handleIntentWithTools()`, complete tool system, Information Services API integration

### 2. KnobbyOpenAiSumoReport

- **Purpose**: Sumo Logic log analysis and reporting
- **Tools**:
  - `sumo_query_submit`
  - `sumo_job_status`
  - `sumo_job_results`
  - `Run Observation Makers` (see ObservationMakers for more information)
- **Intent**: `generateSumoReport` with subIntents:
  - `searchSumoLogSubmissionErrors`
  - `searchSumoLogSubmitActionErrors`
  - `searchSumoLogIntegrationErrors`
  - `searchSumoLogWebhookErrors`
  - `searchSumoLogEmailErrors`
  - `searchSumoLogEmailConfirmationErrors`
  - `searchSumoLogEmailNotificationErrors`
  - `searchSumoLogEmailConfigurationErrors`
  - `searchSumoLogFormSubmissionLifeCycle`
  - `searchSumoLogFormSubmissionSubmitActionRun`
- **Specialty**: Two main functions: 'parse user prompt for json query parameters' and 'interpret log query results'. Jobs/fetch are handled outside of the robot. Uses ObservationMakers to assist in interpreting results.
- **Changes**: Added `handleIntentWithTools()`, job monitoring, file processing, `sumo-search/report` content type

### 3. KnobbyOpenAiLiveContext

- **Purpose**: Context data for forms, accounts, auth providers
- **Tools**:
  - `Run Observation Makers`
  - Context retrieval tools (to be defined)
- **Intent**: `getContextData` with subIntents:
  - `fetchContentDynamic`
  - `fetchContentDynamicAccount`
  - `fetchContentDynamicAuthProvider`
  - `fetchContentDynamicForm`
- **Specialty**: Retrieves and provides context data for entities (forms, accounts, auth providers) to help users understand relationships and configurations. Focus on context manipulation rather than tool calls.
- **Changes**: NEW robot - must be created from scratch with `handleIntentWithTools()`

### 4. SlackyOpenAiAgent Changes

- **Purpose**: Catch-all assistant robot (unchanged)
- **Changes**: Added `handleIntentWithTools()` method (Phase 1: delegates to existing `acceptMessageStreamResponse()`)
- **Intent**: `assistUser` with subIntents:
  - `parseUserPrompt`
  - `handleFollowUp`
  - `clarifyRequest`
  - `generalAssistance`
  - `conversation`

### 5. Testing Requirements

- **Unit Tests**: Tool execution, intent handling, error scenarios, response formatting
- **Coverage**: 90%+ required
- **Focus**: Mock API responses, various intent data, timeout handling

# Reminders

#### About Testing

When writing test - TRY TO AVOID OVER MOCKING.
We using a mock check in test-data/mocks first to see if the mock exists.
If it does exist - use it. If it does not exist create it, and store it in test-data/mocks

### About Logging{}

WE NEVER USE EMOJI IN LOGS
Avoid writing several log statements when one will do. Concat strings or log message, be reasonable, make sure the message are related

```bad
log({fileSize})
log({fileName})
log({fileLocation})
```

```Good
log({fileSize, fileName, fileLocation})

```
