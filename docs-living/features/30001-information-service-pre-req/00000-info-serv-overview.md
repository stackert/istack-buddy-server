# iStackBuddy Information Services Prerequisites

References

- git branch istack-buddy-info-servie-take-1
- iStackBuddy Info Service API docs-living/features/30000-information-services/artifacts/istack-buddy-information-servcice.yml
- specific sub-intents docs-living/features/30000-information-services/artifacts/intents-subintents.md
- docs-living/features/30000-information-services/artifacts/istack-buddy-information-servcice.yml

#### iStackBuddy Information Services

Collection of APIs/support to support iStackBuddy.

The main features:

- Sumo Report Generation
- Sumo Syntax Validation
- Context-Dynamic - Database snapshots of certain database entities with associated entityIds. (Form with it all of it's submitActionIds as example)
- Knowledge Base Search
  -- Couple of knowledge bases ContextDocuments and Slack
  -- Several search strategy

We will to build a collection of robots to handle/manage services and features from iStackBuddy Information Services. In many cases we simply need to write a wrapper around iStackBuddy Info Services, fetch data and give it to the robot that knows how do handle the data.

## Objective

The work we are trying to copy/complete/port is been done on branch istack-buddy-info-servie-take-1.
We are going to create a second branch (off of main) istack-buddy-info-service-take-2. We will port working high quality code from take1 to take2. We will rewrite poor quality code.

## Fundamental Prerequisites

## External/Prebuilt Resources

- **BullMQ** (`bullmq: ^5.58.5`) - Job queue system for background processing
- **Redis** (`redis: ^5.8.2`) - In-memory data store for caching and job queue backend
- **@nestjs/bull** (`^11.0.3`) - NestJS integration for BullMQ
- **@bull-board/api** (`^6.12.7`) - API for BullMQ dashboard
- **@bull-board/express** (`^6.12.7`) - Express integration for BullMQ dashboard
- **@types/redis** (`^4.0.10`) - TypeScript type definitions for Redis

## Internal subsystem resource

### Low-Level Infrastructure Dependencies (Must be built first)

- **Job Queue System** (`src/job-queue/`) - Complete BullMQ-based background processing system
  - JobQueueModule, JobQueueService, JobQueueController
  - Three queue types: message-queue, file-processing, notifications
  - Job processors for each queue type
  - Bull Board dashboard service for monitoring
  - REST API endpoints for queue management

### Configuration & Infrastructure Setup (`100002`)

- **Redis Configuration** (`config/redis.conf`) - Optimized Redis settings for job processing
- **Docker Compose** (`docker-compose.yml`) - Redis container setup with health checks
- **Environment Configuration** (`config/redis-env.example`) - Redis environment variables
- **Job Queue Documentation** (`JOB-QUEUE-IMPLEMENTATION.md`) - Complete implementation guide

### Core System Updates (Required for features to work)

- **Enhanced Message Types** (`src/ConversationLists/types.ts`) - Richer conversation content
  - Extended message content types for complex data
  - Support for structured robot responses
  - Enhanced conversation history management

- **Enhanced Chat Manager** (`src/chat-manager/`) - Updated with new message types and robot integration
- **Robot Service Updates** (`src/robots/robot.service.ts`) - Integration with new robots
- **App Module Updates** (`src/app.module.ts`) - Integration of all new modules
- **Personality Prompt** Each user facing prompt will include personality Prompt
- **Observation Maker Sumo** Need to create ObservationMaker for each known sumo report and perhaps one generic

# Things to remember

- new file/content types type

## Major items done in other steps

### Information Services Features (Depend on prerequisites above)

- **Intent Parsing Service** (`src/common/services/intent-parsing.service.ts`) - AI-powered request routing ((`10002`))
  - OpenAI GPT-4 powered intent analysis
  - Routes user requests to appropriate specialized robots
  - Extracts entity IDs (formId, submissionId, case numbers, etc.)
  - Handles conversation context and robot selection logic
  - Structured JSON response format for robot routing

- **Information Service API Integration** (`src/istack-buddy-slack-api/`) (`10003`)
  - IstackBuddySlackApiService - Main Slack integration service
  - KnowledgeBaseService - Knowledge base search integration
  - Slack conversation mapping and event handling
  - JWT token validation and user authentication

- **Information Services Robots** (`src/robots/`) (`10004`)
  - **KnobbyOpenAiSearch** - Knowledge base search across SLACK, CONTEXT-DOCUMENTS, CONTEXT-DYNAMIC
  - **KnobbyOpenAiSumoReport** - Sumo Logic reporting and log analysis workflows
  - Tool definitions and execution frameworks for each robot
  - Streaming and immediate response handling

- **Tool Definition Frameworks** (`src/robots/tool-definitions/`)
  - `knobby-search/` - Search tool definitions and execution
  - `knobby-sumo/` - Sumo Logic tool definitions and execution
  - Tool catalog and execution infrastructure

### API Integration & Types

- **Information Service API Types** - Proper TypeScript interfaces for all API endpoints
- **Mini API Clients** - Dedicated API clients for each information service:
  - Context-dynamic API client
  - Knowledge-base search API client
  - Sumo query API client
  - Sumo syntax validation API client

## Test/Dev utilities used during this development

### Development Controllers & Testing Infrastructure

- **Dev-Debug Controllers** (`src/dev-debug/`) - Development and testing infrastructure
  - DevDebugKnobbyController - Knobby search testing endpoints
  - DevDebugKnobbySumoController - Sumo report testing endpoints
  - DevDebugChatClientController - Chat client testing interfaces
  - DevDebugChatManagerController - Chat manager testing
  - Intent parsing validation endpoints

### Test Scripts & Utilities

- **Test Scripts** (`scripts/test-job-queue.ts`) - Job queue testing utilities
- **Integration Test Scripts** (`docs-living/features/30000-information-services/artifacts/scripts/`)
  - Knobby intent testing
  - Sumo report testing
  - Search functionality testing
  - API endpoint validation scripts
