# KnobbyOpenAiSearch Robot Implementation Strategy

## Overview

KnobbyOpenAiSearch is a specialized OpenAI-powered robot designed to provide user-facing search interface for the Information Services API. It returns formatted search results directly to users through a two-step workflow: query analysis followed by targeted search execution.

## References

**Related Documentation:**
- API specification - [`docs-living/features/30000-information-services/artifacts/istack-buddy-information-servcice.yml`]
- Feature overview - [`docs-living/features/30000-information-services/00000-info-services-overview.md`]

**Demo Script Locations:**
- Information Service API workflow demo - [`docs-living/features/30000-information-services/artifacts/scripts/test-search-service.sh`]
- KnobbyOpenAiSearch robot test - [`docs-living/features/30000-information-services/artifacts/scripts/test-knobby-robot.sh`]

**Example API Call Scripts:**
The `docs-living/features/30000-information-services/artifacts/example-of-server-calls/` directory contains comprehensive examples of Information Services API usage:

**Core Workflow Examples:**
- `test-top-results.sh` - Complete preQuery → top-results workflow (recommended for KnobbyBot)
- `test-dev-debug-preQuery.sh` - preQuery endpoint testing and analysis
- `test-all-searches.sh` - Demonstrates all available search endpoints

**Individual Search Type Examples:**
- `test-search-keyword.sh` - Keyword-based search testing
- `test-search-domain.sh` - Domain-based search testing  
- `test-search-free-text.sh` - Free text search testing
- `test-search-noun.sh` - Noun-based search testing
- `test-search-proper-nouns.sh` - Proper noun search testing
- `test-search-vector.sh` - Semantic/vector search testing

**Utility Scripts:**
- `test-with-known-data.sh` - Testing with pre-validated data
- `test-embedding-consistency.sh` - Vector embedding validation
- `create-test-data.sh` - Test data generation utilities 


**Core Functionality:**
- Analyze user queries using preQuery endpoint for structured data extraction
- Execute comprehensive search using top-results endpoint (recommended workflow)
- Return formatted results to users with confidence scoring
- Support intelligent routing across all knowledge bases (SLACK, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC)

**Recommended Two-Step Workflow:**
1. **preQuery Analysis**: Extract keywords, nouns, domains, and technical observations from user input
2. **top-results Search**: Use extracted data to automatically run all applicable search types and return best matches

## Architecture Design

### Robot Class Structure

Following the existing `SlackyOpenAiAgent` pattern, the robot will extend `AbstractRobotChat` with:

**Key Properties:**
- Name: `KnobbyOpenAiSearch`
- Version: `1.0.0` 
- Context window: `128000` tokens
- Model: `gpt-4o` (2024-05-13)

**Robot Role/System Prompt:**
An expert search assistant specialized in Formstack's knowledge bases with instructions to:
1. Analyze search queries to extract keywords, domains, and intent
2. Execute appropriate search strategies across knowledge bases
3. Present results in clear, useful format

**Available Knowledge Bases:**
- SLACK: Internal team conversations and discussions
- CONTEXT-DOCUMENTS: Technical documentation and guides  
- CONTEXT-DYNAMIC: Live Formstack entity data

### Tool Definitions Architecture

Create focused tool set in `src/robots/tool-definitions/knobby-search/` following existing patterns:

**Primary Tool: PreQuery + Top Results** (`knobby_search_comprehensive`)
- **Purpose**: Complete two-step workflow for optimal results
- **Process**: 
  1. Calls preQuery to analyze user input and extract structured data
  2. Passes full preQuery response to top-results for comprehensive search
- **Parameters**: query text, optional result limits, confidence thresholds
- **Returns**: Best match from each applicable search type (semantic, keyword, noun, domain, etc.)

**Secondary Tool: PreQuery Analysis** (`knobby_search_prequery`) 
- **Purpose**: Standalone query analysis for debugging or custom workflows
- **Extracts**: keywords, nouns, proper nouns, domains, aiTechnicalObservation
- **Parameters**: query text, confidence thresholds, chunk analysis options

**Individual Search Tools** (for specialized use cases):
- `knobby_search_keyword` - Search using extracted keywords from preQuery
- `knobby_search_noun` - Search using extracted nouns from preQuery  
- `knobby_search_proper_noun` - Search for technologies, brands, specific entities
- `knobby_search_domain` - Search by technical domain categories
- `knobby_search_free_text` - Search using free text terms from preQuery
- `knobby_search_semantic` - AI-powered semantic matching

**Recommended Usage**: Use `knobby_search_comprehensive` for most queries as it automatically determines and executes the best search strategies based on preQuery analysis.

### Tool Execution Strategy

Tools will make direct HTTP calls to Information Services API following existing patterns:
- Use existing HTTP client patterns from Marv/Slacky tools
- Bearer token authentication using established auth patterns
- Standard error handling and response parsing

## Dev/Debug Endpoint Strategy

Create dedicated testing endpoint following existing dev-debug patterns:

**Controller Design:**
- Base route: `/dev-debug/knobby-search/`
- Test search functionality endpoint
- Sample queries and metadata endpoint  
- Full robot conversation flow testing
- Proper error handling and logging

**Robot Retrieval Mechanism:**
KnobbyOpenAiSearch follows the existing robot retrieval pattern used by Slacky:

1. **Registration:** Robot is registered in `RobotService.initializeRobots()` by adding `new KnobbyOpenAiSearch()` to the robot instances array
2. **Retrieval:** Services get the robot using `this.robotService.getRobotByName('KnobbyOpenAiSearch')`
3. **Usage:** Call robot methods like `robot.acceptMessageImmediateResponse(message)` for testing

**Example:**
```
const robot = this.robotService.getRobotByName('KnobbyOpenAiSearch');
if (robot) {
  const response = await robot.acceptMessageImmediateResponse(testMessage);
}
```

**Testing Approach:**
Single simple demonstration script that:
1. Makes one API call to test the robot with a basic query
2. Shows the robot can process a search request and return results
3. Validates basic connectivity to Information Services API

**That's it.** No complex scenarios, no edge case testing, no performance benchmarks - just proof the robot works.

**Dev/Debug DTO Design:**
Based on the Information Services API documentation (yaml file), the robot uses the existing API DTOs internally. The dev/debug endpoint only needs one simple test DTO:

**`KnobbySearchTestDto`:**
- `message: string` (required) - The test message to send to the robot

**Why This Simple?** The robot internally handles the complexity:
- Robot receives the message and analyzes it using preQuery
- Robot determines which search strategies to use
- Robot makes appropriate API calls using the documented DTOs (PreQueryInputDto, KeywordSearchInputDto, etc.)
- Robot returns formatted results

The test DTO just simulates a user message - the robot does the rest.

**Why Only One DTO:**
The robot uses the existing Information Services API DTOs directly (PreQueryInputDto, KeywordSearchInputDto, SemanticSearchInputDto, etc.) as defined in the API specification. The robot's tools make HTTP calls to the Information Services endpoints using these existing DTOs.

The dev/debug endpoint only needs one simple test DTO (KnobbySearchTestDto) to send a test message to the robot. We don't create additional DTOs because the robot already uses the well-defined API DTOs from the Information Services specification.


## Test Script Strategy

Create simple bash/curl script (~20 lines max) that:
1. Makes a single API call to test the robot
2. Displays the output
3. No fancy formatting or emoji - just basic functionality validation

**Script Purpose:** Demonstrate the robot is working, nothing more.
**Approach:** One curl command to dev/debug endpoint with a test query, display response.




## Implementation Phases

### Phase 1: Core Infrastructure Setup
1. Create tool definitions directory structure
2. Implement base TypeScript interfaces and enums
3. Set up HTTP client service for Information Services API
4. Establish authentication patterns

### Phase 2: Robot Implementation  
1. Create robot class extending AbstractRobotChat
2. Implement tool integration and execution handlers
3. Add response formatting and result presentation
4. Configure authentication and error handling

### Phase 3: Dev/Debug Integration
1. Create debug controller with test endpoints
2. Add DTOs for testing configuration
3. Update dev-debug module registration
4. Create comprehensive test script

### Phase 4: Integration and Testing
1. Register robot in robot service
2. Add conversation routing logic
3. Implement full testing workflow
4. Performance optimization and monitoring setup

## Expected Usage Patterns

### Basic Search Workflow (Recommended)
**User Query:** "Find SAML setup documentation"

**Robot Process:**
1. KnobbyOpenAiSearch robot uses `knobby_search_comprehensive` tool
2. **Step 1 - PreQuery**: Extracts keywords ["SAML", "setup", "documentation"], domains ["authentication"], proper nouns ["SAML"]
3. **Step 2 - Top Results**: Automatically runs semantic, keyword, proper noun, and domain searches
4. Returns top 1 result from each successful search type with confidence scores
5. Results formatted from all knowledge bases (SLACK conversations, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC)

### Technical Troubleshooting Workflow
**User Query:** "Customer reports webhook integration failures on form 12345"

**Robot Process:**
1. **PreQuery Analysis**: 
   - Keywords: ["webhook", "integration", "failures", "form"]
   - Domains: ["integration", "forms", "api"]  
   - Technical observation: "Customer issue with form-specific webhook connectivity"
2. **Top Results Execution**: Automatically runs all applicable searches:
   - Semantic search: Understanding webhook failure context
   - Keyword search: Technical terminology matching
   - Domain search: Integration and forms-specific content
   - Proper noun search: Form ID if relevant patterns exist
3. **Result Presentation**: Best matches from each search type, prioritizing troubleshooting guides and known solutions

### Live Data Integration Query
**User Query:** "What SSO provider is configured for form 98765?"

**Robot Process:**
1. **PreQuery**: Identifies form-specific query requiring live data lookup
2. **Top Results**: Searches across knowledge bases and may trigger CONTEXT-DYNAMIC lookups for live form configuration
3. **Response**: Combines documentation about SSO configuration with live form data (if available through context-dynamic endpoints)

## Error Handling Strategy

**API Failures:**
- Graceful degradation when Information Services unavailable
- Fallback to cached responses or alternative search strategies
- Clear error messages to users explaining service limitations

**Authentication Issues:**
- Proper error handling for expired/invalid tokens
- Automatic retry with exponential backoff
- Comprehensive logging for debugging and monitoring

**Query Validation:**
- Input sanitization and validation before processing
- Handling of malformed or empty queries with helpful guidance
- Rate limiting protection to prevent service abuse

## File Structure Overview

**Core Robot Files:**
- `src/robots/KnobbyOpenAiSearch.ts` - Main robot class
- `src/robots/tool-definitions/knobby-search/` - Tool definitions directory
- `src/robots/tool-definitions/knobby-search/types.ts` - TypeScript interfaces and enums
- `src/robots/tool-definitions/knobby-search/knobbySearchToolDefinitions.ts` - Tool definitions
- `src/robots/tool-definitions/knobby-search/knobbySearchToolSet.ts` - Tool execution logic

**Dev/Debug Files:**
- `src/dev-debug/dev-debug-knobby.controller.ts` - Testing controller
- `src/dev-debug/dto/knobby-search-test.dto.ts` - Single test DTO (just KnobbySearchTestDto)

**Why Only One DTO File?**
The demo script only needs to send a test message to the robot. The robot handles all the complex API interactions internally using the existing Information Services DTOs. We don't need separate testing DTOs for each API endpoint - that would be over-engineering for a simple demonstration.
- `docs-living/features/30000-information-services/artifacts/scripts/test-knobby-search.sh` - Test script

**Integration Points:**
- Update `src/robots/robot.service.ts` for robot registration
- Update `src/dev-debug/dev-debug.module.ts` for controller registration

**Scope:** Creating a robot and demo script only. No chat integration needed for this implementation.

This strategy provides the architectural foundation and implementation roadmap necessary to build and test the KnobbyOpenAiSearch robot with a simple demonstration script.
