# Information Services Robot Architecture Proposal

## Overview
This proposal outlines the creation of 5 specialized OpenAI-based robots to interface with the Information Services API, following existing patterns from Marv and Slacky implementations.

## Robot Architecture

### 🤖 KnobbyOpenAiSearch (7 endpoints)
**Purpose**: User-facing search interface returning results directly to users
**Endpoints**:
- POST `/information-services/knowledge-bases/preQuery`
- POST `/information-services/knowledge-bases/keyword-search`
- POST `/information-services/knowledge-bases/noun-search`
- POST `/information-services/knowledge-bases/proper-noun-search`
- POST `/information-services/knowledge-bases/domain-search`
- POST `/information-services/knowledge-bases/free-text-search`
- POST `/information-services/knowledge-bases/semantic-search`

**Tools**: 7 tools mapping to search endpoints
**User Experience**: "Search for SAML documentation" → Returns formatted results

### 🤖 KnobbyOpenAiContextDocument (10 endpoints)
**Purpose**: Fetch context documents to enhance other robot prompts and conversations
**Endpoints**:
- GET `/information-services/knowledge-bases` (metadata)
- GET `/information-services/knowledge-bases/channels` (metadata)
- GET `/information-services/knowledge-bases/domains` (metadata)
- POST `/information-services/knowledge-bases/preQuery`
- POST `/information-services/knowledge-bases/keyword-search`
- POST `/information-services/knowledge-bases/noun-search`
- POST `/information-services/knowledge-bases/proper-noun-search`
- POST `/information-services/knowledge-bases/domain-search`
- POST `/information-services/knowledge-bases/free-text-search`
- POST `/information-services/knowledge-bases/semantic-search`

**Tools**: 10 tools (3 metadata + 7 search)
**User Experience**: "Enhance my conversation about form validation" → Fetches relevant context docs

### 🤖 KnobbyOpenAiContextDynamic (4 endpoints)
**Purpose**: Live Formstack entity retrieval and context
**Endpoints**:
- POST `/information-services/context-dynamic/health`
- POST `/information-services/context-dynamic/account`
- POST `/information-services/context-dynamic/auth-provider`
- POST `/information-services/context-dynamic/form`

**Tools**: 4 tools mapping to context endpoints
**User Experience**: "Get live form configuration for form 12345" → Returns current form state

### 🤖 KnobbyOpenAiSumoReport (12 endpoints)
**Purpose**: Sumo Logic reporting workflows and file management
**Endpoints**:
- POST `/information-services/context-sumo-report/query/submit`
- GET `/information-services/context-sumo-report/query/{jobId}/status`
- GET `/information-services/context-sumo-report/query/{jobId}/results`
- DELETE `/information-services/context-sumo-report/query/{jobId}`
- GET `/information-services/context-sumo-report/query/jobs`
- GET `/information-services/context-sumo-report/query-list`
- GET `/information-services/context-sumo-report/known-messages`
- GET `/information-services/context-sumo-report/submit-action-types`
- GET `/information-services/context-sumo-report/status`
- GET `/information-services/context-sumo-report/files/{fileId}`
- DELETE `/information-services/context-sumo-report/files/{fileId}`
- GET `/information-services/context-sumo-report/files`

**Tools**: 12 tools covering full reporting workflow
**User Experience**: "Generate submission report for form 12345" → Submits job, polls status, returns results

### 🤖 KnobbyOpenAiSumoSyntax (1 endpoint)
**Purpose**: Sumo Logic query syntax assistance
**Endpoints**:
- POST `/information-services/context-sumo-syntax/estimate`

**Tools**: 1 tool for syntax estimation
**User Experience**: "Help me write a query for failed submissions" → Returns estimated Sumo Logic syntax

## Implementation Pattern Analysis

Based on existing Marv and Slacky robots:

### Tool Definition Structure (Following Marv Pattern):
```typescript
// Tool definitions in /tool-definitions/knobby-search/
export const knobbySearchToolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[]
export const performKnobbySearchToolCall = (toolName: string, toolArgs: any) => Promise<string>
```

### Robot Class Structure (Following SlackyOpenAiAgent Pattern):
```typescript
export class KnobbyOpenAiSearch extends AbstractRobotChat {
  public readonly contextWindowSizeInTokens: number = 128000;
  public readonly LLModelName: string = 'gpt-4o';
  public readonly LLModelVersion: string = 'gpt-4o-2024-05-13';
  private readonly robotRole = `[Specialized prompt]`;
  private readonly tools: OpenAI.Chat.Completions.ChatCompletionTool[];
}
```

### Authentication Pattern:
All robots will require bearer token authentication following the existing pattern in FsApiClient.

## Key Architectural Decisions

### 1. Separation of Search vs Context Document Fetching
- **Search Robot**: Returns formatted results to users
- **Context Document Robot**: Fetches documents for prompt enhancement
- **Shared endpoints but different use cases and response handling**

### 2. Tool Count Distribution
- KnobbyOpenAiSearch: 7 tools (focused search workflow)
- KnobbyOpenAiContextDocument: 10 tools (metadata + search)
- KnobbyOpenAiContextDynamic: 4 tools (live context)
- KnobbyOpenAiSumoReport: 12 tools (full reporting workflow)
- KnobbyOpenAiSumoSyntax: 1 tool (specialized expert)

### 3. Global Utilities
- Health check endpoints should be accessible across robots
- Service status checks for workflow validation
- Authentication handled consistently across all robots

## Test Scripts Structure

Each robot will have a corresponding test script in:
`docs-living/features/30000-information-services/artifacts/scripts/`

Scripts will be simple bash/curl implementations (~20 lines) that:
1. Set authentication token
2. Make sample API call
3. Print formatted response
4. Test both success and error cases

### Script Files:
- `test-knobby-search.sh`
- `test-knobby-context-document.sh` 
- `test-knobby-context-dynamic.sh`
- `test-knobby-sumo-report.sh`
- `test-knobby-sumo-syntax.sh`

## Implementation Phases

### Phase 1: Core Infrastructure
- Create tool definition structure following Marv pattern
- Implement base authentication handling
- Set up robot class templates

### Phase 2: Individual Robots
- Implement each robot following SlackyOpenAiAgent pattern
- Create tool definitions and handlers
- Add robot role/system prompts

### Phase 3: Testing & Integration
- Implement test scripts
- Add to robot service registry
- Create routing logic integration points

### Phase 4: Documentation & Deployment
- Update robot service documentation
- Add usage examples
- Deploy and validate functionality

## Expected Usage Patterns

### Search Workflow:
```
User: "Find SAML setup documentation"
→ KnobbyOpenAiSearch
→ preQuery analysis → semantic search → formatted results
```

### Context Enhancement Workflow:
```
System: "Enhance prompt about form validation"
→ KnobbyOpenAiContextDocument  
→ domain search → fetch relevant docs → return context
```

### Dynamic Context Workflow:
```
User: "Get current form 12345 configuration"
→ KnobbyOpenAiContextDynamic
→ health check → form lookup → return live data
```

### Reporting Workflow:
```
User: "Generate submission report for form 12345"
→ KnobbyOpenAiSumoReport
→ submit job → poll status → fetch results → format report
```

### Syntax Help Workflow:
```
User: "Help write query for failed submissions"
→ KnobbyOpenAiSumoSyntax
→ syntax estimation → return formatted query
```

This architecture provides clear separation of concerns while maintaining the established patterns from existing robot implementations.
