# Information Services Prerequisites Implementation

## ⚠️ IMPORTANT: BACKWARD COMPATIBILITY ⚠️

**These additions should NOT affect the current system. Everything must remain backward compatible.**

Existing message types, robot functionality, and chat system behavior must continue to work exactly as before.

## Low-Level Infrastructure Dependencies (Must be built first)

### Job Queue System (`src/job-queue/`)

**Purpose**: Complete BullMQ-based background processing system for handling async operations.

**Components to implement**:

1. **FileManager** (`src/file-manager/`) - Simple internal file storage utility
   - `fileManager.put(fileContent, STORAGE_CLASS)` - Store file and return fileId
   - `fileManager.get(fileId)` - Retrieve file content by ID
   - `fileManager.getMetaDetails(fileId)` - Get metadata (content types, token size, datestamps)
   - Support for TEMP and SHORT_TERM storage classes

2. **JobQueueModule** - NestJS module configuration
   - Configure BullMQ with Redis connection
   - Register three queue types: `message-queue`, `file-processing`, `notifications`
   - Set up job processors for each queue

3. **JobQueueService** - Core service for job management
   - Methods to add jobs to each queue type
   - Job status tracking and retrieval
   - Queue statistics and monitoring
   - Job cleanup (completed/failed jobs)

4. **JobQueueController** - REST API endpoints
   - `GET /admin/bullmq/job-queue/stats` - Queue statistics
   - `GET /admin/bullmq/job-queue/job/:queueName/:jobId` - Job details
   - `POST /admin/bullmq/job-queue/job/:queueName/:jobId/retry` - Retry failed jobs
   - `POST /admin/bullmq/job-queue/queue/:queueName/pause` - Pause queue
   - `POST /admin/bullmq/job-queue/queue/:queueName/resume` - Resume queue

5. **Job Processors** (`src/job-queue/processors/`)
   - `message-queue.processor.ts` - Handle offline message delivery
   - `file-processing.processor.ts` - Process file uploads (virus scan, thumbnails)
   - `notification.processor.ts` - Send notifications to users

6. **Bull Board Dashboard Service** (`src/job-queue/bull-board.service.ts`)
   - Web-based monitoring dashboard at `/admin/queues`
   - Real-time queue statistics and job monitoring
   - Job retry and management capabilities
   - Queue pause/resume functionality
   - **Note**: Uses Express adapter but integrates with NestJS - no conflicts

**Key Features**:

- Automatic retry logic with exponential backoff
- Job priority handling
- Job cleanup and statistics tracking
- Integration with Express for web dashboard

### File Manager (`src/file-manager/`)

**Purpose**: Very simple file storage and retrieval system.

**API**:

```typescript
// Put file content and get file ID
fileId = fileManager.put(fileContent, STORAGE_CLASS.TEMP);
fileId = fileManager.put(fileContent, STORAGE_CLASS.SHORT_TERM);

// Get file content by ID
fileContent = fileManager.get(fileId);

// Get metadata details
metaDetails = fileManager.getMetaDetails(fileId);
// Returns: { contentTypes, tokenSize, createdDate, modifiedDate, etc. }
```

**Storage Classes**:

- `STORAGE_CLASS.TEMP` - Temporary storage (short-lived)
- `STORAGE_CLASS.SHORT_TERM` - Short-term storage (medium-lived)

**Implementation**:

- **Disk-based storage** - Files stored on local filesystem
- **Directory structure**:
  - `storage/temp/` - For STORAGE_CLASS.TEMP files
  - `storage/short-term/` - For STORAGE_CLASS.SHORT_TERM files
- **File ID mapping**:
  - FileId = `{storage_class}-{UUID}.{extension}` (e.g., `temp-550e8400-e29b-41d4-a716-446655440000.csv`)
  - File path: `storage/{storage_class}/{fileId}`
  - Storage class extracted from fileId prefix/suffix
- **File ID generation** - UUID v4 with file extension (e.g., `550e8400-e29b-41d4-a716-446655440000.csv`)
- **Basic put/get operations** - Write/read files to/from disk
- **Storage class handling** - Route files to appropriate directories
- **Metadata extraction** - Read metadata from file content (not separate storage)
- **Token size calculation** - Calculate tokens for message content

### Enhanced Message Content Types (`src/ConversationLists/types.ts`)

**Purpose**: Extended message content types to support Information Services data structures.

**New Content Types Added**:

1. **Dynamic Content Types**:
   - `content/dynamic` - Generic dynamic content (string)
   - `content/dynamic-account` - Account records with structured data
   - `content/dynamic-form` - Form records with submit actions, emails, etc.
   - `content/dynamic-auth-provider` - Auth provider records
   - `content/document` - Document content (any type)

2. **Sumo Logic Content Types**:
   - `sumo-search/report` - Sumo Logic search results with record count and data
   - `sumo-syntax/*` - Sumo Logic query syntax content

**Content Type Structure**:

```typescript
// Example: Dynamic Form Content (structure may vary)
{
  type: 'content/dynamic-form',
  payload: {
    formRecord: { /* form data structure */ }
  }
}

// Example: Sumo Search Report Content (may include originalQuery)
{
  type: 'sumo-search/report',
  payload: {
    recordCount: number;
    firstRecord: any;
    results: any;
    originalQuery?: string; // optional
  }
}

// Example: Document Content (may include tokenCount)
{
  type: 'content/document',
  payload: {
    content: any;
    tokenCount?: number; // optional
  }
}
```

**What You're Implementing**:

- **Content Type Definitions** - Add new TypeScript types for Information Services data
- **Message Processing Updates** - Extend chat manager to handle new content types
- **Token Calculation** - Calculate tokens for structured content types
- **Robot Content Handling** - Robots must properly handle new content types in responses

**Places Requiring Updates**:

1. **Chat Manager Service** (`src/chat-manager/chat-manager.service.ts`)
   - Message processing pipeline
   - Content type validation
   - Token calculation for new types

2. **Robot Services** (`src/robots/`)
   - Content type handling in robot responses
   - Transformation between content types
   - Proper content type selection for responses

3. **Message Interfaces** (`src/chat-manager/interfaces/message.interface.ts`)
   - Interface updates for new content types
   - Type guards for content type checking

4. **File Manager** (`src/file-manager/`)
   - Metadata extraction from new content types
   - Token size calculation for structured data

**Testing Requirements**:

- **Content Type Validation** - Test all new content type structures
- **Message Processing** - Test message handling with new content types
- **Robot Integration** - Test robot responses with different content types
- **Token Calculation** - Test token counting for structured content
- **Serialization** - Test JSON serialization/deserialization
- **Type Guards** - Test content type detection and validation

## Configuration & Infrastructure Setup

### Redis Configuration (`config/redis.conf`)

**Purpose**: Optimized Redis settings for job processing with BullMQ.

**Key configurations**:

- **Memory management**: 256MB limit with LRU eviction policy
- **Persistence**: AOF (Append Only File) enabled for data durability
- **Performance**: Optimized for job queue operations
- **Security**: Basic security settings (password configuration)
- **Monitoring**: Slow log and latency monitoring enabled

**Implementation**:

- Create `config/redis.conf` with production-ready settings
- Configure memory limits and eviction policies
- Set up persistence and backup strategies
- Enable monitoring and logging

### Docker Compose (`docker-compose.yml`)

**Purpose**: Redis container setup with health checks for development and production.

**Components**:

- **Redis Service**: Redis 7 Alpine image
- **Port mapping**: 6379:6379
- **Volume persistence**: Redis data volume
- **Health checks**: Built-in Redis ping health monitoring
- **Restart policy**: Unless-stopped for reliability

**Implementation**:

- Create `docker-compose.yml` with Redis service
- Configure volume mounting for data persistence
- Set up health checks and restart policies
- Add environment variable configuration

### Environment Configuration (`config/redis-env.example`)

**Purpose**: Environment variables for Redis and BullMQ configuration.

**Required variables**:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# BullMQ Configuration
BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=
BULLMQ_REDIS_DB=1

# Job Queue Configuration
JOB_QUEUE_CONCURRENCY=5
JOB_QUEUE_ATTEMPTS=3
JOB_QUEUE_BACKOFF_DELAY=2000
JOB_QUEUE_BACKOFF_TYPE=exponential
```

**Implementation**:

- Create `config/redis-env.example` template
- Document all required environment variables
- Provide default values and explanations
- Include production vs development configurations

### Job Queue Documentation (`JOB-QUEUE-IMPLEMENTATION.md`)

**Purpose**: Complete implementation guide and usage documentation.

**Contents**:

- Setup instructions (Redis, Docker, environment)
- Usage examples for each queue type
- API endpoint documentation
- Monitoring and troubleshooting guides
- Performance considerations and best practices

**Implementation**:

- Document complete setup process
- Provide code examples for job queuing
- Include troubleshooting and monitoring guides
- Add performance optimization recommendations

## Implementation Order

1. **Redis Configuration** - Set up Redis config and Docker compose
2. **Environment Setup** - Create environment variable templates
3. **Job Queue Module** - Implement core BullMQ module and service
4. **Job Processors** - Create processors for each queue type
5. **Bull Board Dashboard** - Set up monitoring dashboard
6. **REST API** - Implement job management endpoints
7. **Documentation** - Complete implementation and usage guides

## Testing Requirements (90%+ Coverage)

### File Manager Tests (`src/file-manager/`)

**Unit Tests**:

- `fileManager.put()`, `get()`, `getMetaDetails()` methods
- File ID generation and storage class routing
- Error handling and token size calculation

**Integration Tests**:

- End-to-end file storage and retrieval
- Metadata extraction from content types

### Job Queue System Tests (`src/job-queue/`)

**Unit Tests**:

- `JobQueueService`, `JobQueueController`, `BullBoardService` methods
- Job processors and queue statistics
- Job retry logic and error handling

**Integration Tests**:

- Redis connection and job persistence
- Job processing workflows
- Dashboard functionality

**E2E Tests**:

- Complete job lifecycle (add → process → complete)
- Error scenarios and recovery

### Enhanced Message Content Types Tests

**Unit Tests**:

- Content type validation and payload structure
- Token calculation for structured content
- Type guards for content type detection

**Integration Tests**:

- Message processing with new content types
- Robot response handling with different content types
- Backward compatibility verification

### Configuration Tests

**Unit Tests**:

- Redis configuration validation
- Environment variable parsing
- Docker compose configuration
- Configuration file validation

**Integration Tests**:

- Redis connection with various configurations
- Docker container startup and health checks
- Environment variable loading and validation

### Coverage Requirements

**Minimum 90% coverage for**:

- All service methods and business logic
- All controller endpoints and error handling
- All job processors and queue operations
- File manager operations and metadata extraction
- Configuration loading and validation
- Error handling and edge cases

**Test Categories**:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Complete workflow testing
- **Performance Tests**: Load and stress testing
- **Error Tests**: Failure scenario testing

## Dependencies

- Redis server (via Docker or local installation)
- BullMQ and related npm packages (already listed in External/Prebuilt Resources)
- NestJS Bull module integration
- Express for dashboard integration (no conflicts with NestJS)
