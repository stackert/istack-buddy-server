_TMC_

Editor's note, do not remove.

THIS DOCUMENT HAS NOT BEEN REVIEWED - DO NOT USE UNTIL HUMAN REVIEW

_TMC_

# Information Services Robots Implementation

## Overview

This document defines the required implementation for Information Services robots. It outlines the work needed to create specialized robots that handle/manage services and features from iStackBuddy Information Services, acting as wrappers around the Information Services API to fetch data and provide intelligent responses.

## References

- **Parent Feature Documentation**: `docs-living/features/30001-information-service-pre-req/00000-info-serv-overview.md`
- **Intent Routing Documentation**: `docs-living/features/30001-information-service-pre-req/10002-info-service-intent-routing.md`
- **API Integration Documentation**: `docs-living/features/30001-information-service-pre-req/10003-info-service-api.md`
- **API Documentation**: `docs-living/features/30000-information-services/artifacts/istack-buddy-information-servcice.yml`

## Robot Architecture

**Wrapper Pattern**: Robots act as intelligent wrappers around Information Services API endpoints, providing:

- **Data Fetching**: Retrieve data from Information Services API
- **Intelligent Processing**: Transform raw API responses into user-friendly responses
- **Context Awareness**: Understand user intent and provide relevant information
- **Streaming Support**: Real-time response streaming for better user experience

## Required Robots

### 1. KnobbyOpenAiSearch Robot

**Purpose**: Knowledge base search across SLACK, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC

**Intent**: `searchKnowledge`

**SubIntents**:

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
- `findSlackConverationRelated`
- `findSlackConverationRelatedAnyChannel`
- `findSlackConverationRelatedSameChannel`
- `recommend`
- `recommendForm`
- `recommendFormField`
- `recommendFormFieldCalculation`
- `recommendFormFieldLogic`

**API Integration**:

- Uses `iStackInfoService.knowledgeBase.*` methods
- Implements search workflow: `preQuery` → `topSearch`/`keywordSearch`/`semanticSearch`
- Handles multiple knowledge bases: SLACK, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC

**Implementation Requirements**:

- **Tool Definitions**: Create search tool definitions in `src/robots/tool-definitions/knobby-search/`
- **Response Formatting**: Format search results with confidence scores and citations
- **Error Handling**: Handle API failures gracefully with fallback strategies
- **Streaming Support**: Stream search results as they become available

### 2. KnobbyOpenAiSumoReport Robot

**Purpose**: Sumo Logic reporting and log analysis workflows

**Intent**: `generateSumoReport`

**SubIntents**:

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

**API Integration**:

- Uses `iStackInfoService.sumoReport.*` methods
- Implements job workflow: `submitQuery` → `jobs.getStatus` → `jobs.getResults`
- Handles file management: `files.get`, `files.list`, `files.delete`

**Implementation Requirements**:

- **Tool Definitions**: Create Sumo tool definitions in `src/robots/tool-definitions/knobby-sumo/`
- **Job Management**: Handle asynchronous job processing with status polling
- **Result Processing**: Transform Sumo Logic results into readable reports
- **File Handling**: Manage generated report files and cleanup
- **Streaming Support**: Stream job status updates and final results

### 3. Context Dynamic Robots

**Purpose**: Provide context data for forms, accounts, and auth providers

**API Integration**:

- Uses `iStackInfoService.contextDynamic.*` methods
- Handles entity-specific data retrieval: `getForm`, `getAccount`, `getAuthProvider`

**Implementation Requirements**:

- **Entity Processing**: Transform raw entity data into structured responses
- **Relationship Mapping**: Show relationships between entities (forms → submitActions)
- **Data Validation**: Ensure entity data is complete and valid
- **Caching Strategy**: Cache frequently accessed entity data

## Tool Definition Frameworks

### Knobby Search Tools (`src/robots/tool-definitions/knobby-search/`)

**Required Tools**:

- `knobby_search_comprehensive` - Multi-strategy search
- `knobby_search_keyword` - Keyword-based search
- `knobby_search_semantic` - Semantic search
- `knobby_search_domain` - Domain-specific search
- `knobby_search_prequery` - Query preprocessing

**Implementation**:

- **Tool Execution**: Execute search tools with proper error handling
- **Result Processing**: Format and rank search results
- **Citation Management**: Track and display source citations
- **Confidence Scoring**: Provide confidence scores for results

### Knobby Sumo Tools (`src/robots/tool-definitions/knobby-sumo/`)

**Required Tools**:

- `sumo_query_submit` - Submit Sumo Logic queries
- `sumo_job_status` - Check job status
- `sumo_job_results` - Retrieve job results
- `sumo_syntax_help` - Get syntax assistance

**Implementation**:

- **Query Building**: Construct Sumo Logic queries from user intent
- **Job Monitoring**: Track job progress and handle timeouts
- **Result Parsing**: Parse and format Sumo Logic results
- **Error Analysis**: Provide meaningful error messages for failed queries

## Robot Integration

### Intent-Based Routing

**Integration with Intent Parsing Service**:

- Robots implement `executeIntent()` method from `AbstractRobotChat`
- Handle `IntentData` with proper callback management
- Support conversation context and robot selection

**Intent Registry**:

- Each robot defines supported intents via `getSupportedIntents()`
- Provide intent prompt segments via `getIntentPromptSegment()`
- Support subIntent-based routing for specialized functionality

### Chat Manager Integration

**Streaming Support**:

- Implement `acceptMessageStreamResponse()` for real-time responses
- Handle `IStreamingCallbacks` for progress updates
- Support both streaming and immediate response modes

**Message Processing**:

- Process enhanced message types from `src/ConversationLists/types.ts`
- Handle structured robot responses
- Support conversation history management

## Implementation Strategy

### Phase 1: Base Robot Framework

1. **Extend AbstractRobotChat** for all Information Services robots
2. **Implement executeIntent()** method with proper callback handling
3. **Create tool definition frameworks** for search and Sumo operations
4. **Add intent registry methods** for robot discovery

### Phase 2: KnobbyOpenAiSearch Implementation

1. **Create search tool definitions** in `knobby-search/` directory
2. **Implement API integration** with `iStackInfoService.knowledgeBase.*`
3. **Add response formatting** with confidence scores and citations
4. **Implement streaming support** for search results

### Phase 3: KnobbyOpenAiSumoReport Implementation

1. **Create Sumo tool definitions** in `knobby-sumo/` directory
2. **Implement job management** with BullMQ integration
3. **Add result processing** for Sumo Logic reports
4. **Implement file management** for generated reports

### Phase 4: Context Dynamic Robots

1. **Implement entity data retrieval** using `iStackInfoService.contextDynamic.*`
2. **Add relationship mapping** between entities
3. **Implement caching strategy** for frequently accessed data
4. **Add data validation** and error handling

## Testing Requirements

### Unit Tests

- **Tool Execution**: Test each tool definition with mock API responses
- **Intent Handling**: Test `executeIntent()` with various intent data
- **Error Scenarios**: Test API failures and timeout handling
- **Response Formatting**: Test result formatting and confidence scoring

### Integration Tests

- **API Integration**: Test with real Information Services API
- **Job Processing**: Test Sumo Logic job workflows end-to-end
- **Search Workflows**: Test complete search workflows with multiple strategies
- **Context Data**: Test entity data retrieval and relationship mapping

### Performance Tests

- **Response Times**: Ensure robots respond within acceptable timeframes
- **Concurrent Requests**: Test handling of multiple simultaneous requests
- **Memory Usage**: Monitor memory usage during long-running operations
- **Cache Performance**: Test caching effectiveness and hit rates

## Dependencies

- **Information Service API**: `iStackInfoService` from API integration
- **Intent Parsing Service**: For robot routing and intent handling
- **Job Queue System**: BullMQ integration for Sumo Logic jobs
- **Redis**: For caching and job queue backend
- **AbstractRobotChat**: Base robot class with streaming support
- **Enhanced Message Types**: Support for structured robot responses
