# Job Queue System

This module provides a complete BullMQ-based job queue system for background processing, with Redis as the backing store and a web-based monitoring dashboard.

## Features

- **Three Queue Types**:
  - `message-queue`: For offline message delivery
  - `file-processing`: For file upload processing (virus scanning, thumbnails, etc.)
  - `notifications`: For sending notifications to users

- **Job Monitoring**: Web-based dashboard at `/admin/queues`
- **API Endpoints**: REST API for queue management
- **Automatic Retries**: Configurable retry logic with exponential backoff
- **Job Cleanup**: Automatic cleanup of old completed/failed jobs

## Setup

### 1. Environment Configuration

Add these variables to your `.env.live` file (see `config/redis-env.example`):

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

### 2. Start Redis

```bash
# Start Redis using Docker Compose
docker-compose up -d redis

# Or start Redis manually
docker run -d --name istack-buddy-redis -p 6379:6379 redis:7-alpine
```

### 3. Start the Application

```bash
npm run start:dev
```

## Usage

### Basic Job Queueing

```typescript
import { JobQueueService } from './job-queue/job-queue.service';

@Injectable()
export class YourService {
  constructor(private readonly jobQueueService: JobQueueService) {}

  async queueMessageDelivery(userId: string, messageId: string) {
    const job = await this.jobQueueService.queueMessageDelivery(
      userId,
      messageId,
      {
        delay: 0,
        priority: 5,
        attempts: 3,
      },
    );
    return job;
  }

  async queueFileProcessing(
    fileId: string,
    uploaderId: string,
    roomId: string,
  ) {
    const job = await this.jobQueueService.queueFileProcessing(
      fileId,
      uploaderId,
      roomId,
      'standard',
      {
        requiresVirusScanning: true,
        generateThumbnails: true,
        priority: 'normal',
      },
    );
    return job;
  }

  async queueNotification(
    userId: string,
    type: 'message',
    title: string,
    content: string,
  ) {
    const job = await this.jobQueueService.queueNotification(
      userId,
      type,
      title,
      content,
      {
        priority: 'normal',
        metadata: { source: 'your-service' },
      },
    );
    return job;
  }
}
```

### Queue Statistics

```typescript
// Get all queue statistics
const stats = await this.jobQueueService.getAllQueueStats();

// Get specific queue statistics
const messageStats = await this.jobQueueService.getQueueStats('message-queue');
```

### Job Management

```typescript
// Get job status
const job = await this.jobQueueService.getJobStatus('message-queue', 'job-id');

// Clean up old jobs
await this.jobQueueService.cleanCompletedJobs(24 * 60 * 60 * 1000); // 24 hours
await this.jobQueueService.cleanFailedJobs(7 * 24 * 60 * 60 * 1000); // 7 days
```

## API Endpoints

### Queue Statistics

- `GET /job-queue/stats` - Get all queue statistics
- `GET /job-queue/stats/:queueName` - Get specific queue statistics

### Job Management

- `GET /job-queue/job/:queueName/:jobId` - Get job details
- `POST /job-queue/job/:queueName/:jobId/retry` - Retry failed job
- `DELETE /job-queue/job/:queueName/:jobId` - Remove job

### Queue Control

- `POST /job-queue/queue/:queueName/pause` - Pause queue
- `POST /job-queue/queue/:queueName/resume` - Resume queue

### Cleanup

- `POST /job-queue/cleanup/completed` - Clean completed jobs
- `POST /job-queue/cleanup/failed` - Clean failed jobs

## Monitoring Dashboard

Access the Bull Board dashboard at: `http://localhost:3500/admin/queues`

Features:

- Real-time queue statistics
- Job details and logs
- Retry failed jobs
- Remove jobs
- Pause/resume queues
- Job search and filtering

## Job Types

### Message Queue Jobs

- **Purpose**: Deliver messages to offline users
- **Data**: `{ userId, messageId, timestamp }`
- **Retry Logic**: 3 attempts with exponential backoff

### File Processing Jobs

- **Purpose**: Process uploaded files (virus scan, thumbnails, etc.)
- **Data**: `{ fileId, uploaderId, roomId, storageClass, requiresVirusScanning, generateThumbnails, priority }`
- **Retry Logic**: 3 attempts with exponential backoff

### Notification Jobs

- **Purpose**: Send notifications to users
- **Data**: `{ userId, type, title, content, metadata, priority }`
- **Retry Logic**: 3 attempts with exponential backoff

## Error Handling

All processors include comprehensive error handling:

- Automatic retries with exponential backoff
- Detailed error logging
- Job state tracking
- Failed job monitoring

## Performance Considerations

- **Concurrency**: Configurable via `JOB_QUEUE_CONCURRENCY`
- **Memory**: Redis memory usage optimized with LRU eviction
- **Cleanup**: Automatic cleanup of old jobs to prevent memory bloat
- **Monitoring**: Real-time statistics and health checks

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis status
docker ps | grep redis

# Check Redis logs
docker logs istack-buddy-redis

# Test Redis connection
redis-cli ping
```

### Job Processing Issues

1. Check the Bull Board dashboard for failed jobs
2. Review application logs for error details
3. Use the API endpoints to retry failed jobs
4. Check Redis memory usage and cleanup old jobs

### Performance Issues

1. Monitor queue statistics via API or dashboard
2. Adjust concurrency settings
3. Clean up old completed/failed jobs
4. Check Redis memory usage
