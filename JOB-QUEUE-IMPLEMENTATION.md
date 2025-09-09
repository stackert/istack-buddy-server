# Job Queue Implementation Guide

## Overview

This document provides a complete guide for the iStackBuddy Job Queue system implementation using BullMQ and Redis. The system provides background processing capabilities for message handling, file processing, and notifications.

## Architecture

The job queue system consists of:

- **Redis**: In-memory data store for job persistence and queue management
- **BullMQ**: Node.js job queue library with Redis backend
- **Three Queue Types**:
  - `message-queue`: Handles offline message delivery and processing
  - `file-processing`: Processes file uploads (virus scan, thumbnails, metadata)
  - `notifications`: Sends notifications to users (email, Slack, push)

## Prerequisites

### Dependencies

The following packages are required and have been installed:

```json
{
  "bullmq": "^5.58.5",
  "redis": "^5.8.2",
  "@nestjs/bull": "^11.0.3",
  "@bull-board/api": "^6.12.7",
  "@bull-board/express": "^6.12.7",
  "@types/redis": "^4.0.10"
}
```

### Infrastructure

1. **Redis Server**: Required for job persistence
2. **File Storage**: Local filesystem storage for file manager
3. **Environment Configuration**: Redis and BullMQ settings

## Setup Instructions

### 1. Redis Configuration

#### Using Docker (Recommended)

```bash
# Start Redis container
docker-compose up -d redis

# Check Redis health
docker-compose ps
```

#### Manual Redis Installation

```bash
# Install Redis (Ubuntu/Debian)
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
```

### 2. Environment Configuration

Copy the environment template and configure:

```bash
cp config/redis-env.example .env
```

Update `.env` with your Redis settings:

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

### 3. File Storage Setup

The file manager uses local filesystem storage:

```bash
# Create storage directories
mkdir -p storage/temp
mkdir -p storage/short-term

# Set appropriate permissions
chmod 755 storage/temp
chmod 755 storage/short-term
```

### 4. Start the Application

```bash
# Install dependencies
npm install

# Start the server
npm run start:dev
```

## Usage Examples

### 1. Adding Jobs to Queues

#### Message Queue

```typescript
import { JobQueueService } from './src/job-queue/job-queue.service';

// Inject the service
constructor(private readonly jobQueueService: JobQueueService) {}

// Add a message processing job
const job = await this.jobQueueService.addMessageJob({
  messageId: 'msg-123',
  userId: 'user-456',
  content: {
    type: 'text/plain',
    payload: 'Hello, World!'
  },
  priority: 1,
  delay: 0
});
```

#### File Processing

```typescript
// Add a file processing job
const job = await this.jobQueueService.addFileProcessingJob({
  fileId: 'file-789',
  userId: 'user-456',
  operation: 'virus-scan',
  priority: 2,
});
```

#### Notifications

```typescript
// Add a notification job
const job = await this.jobQueueService.addNotificationJob({
  userId: 'user-456',
  type: 'email',
  subject: 'Welcome!',
  message: 'Welcome to iStackBuddy',
  priority: 1,
});
```

### 2. File Manager Usage

```typescript
import { FileManagerService, STORAGE_CLASS } from './src/file-manager/file-manager.service';

// Inject the service
constructor(private readonly fileManagerService: FileManagerService) {}

// Store a file
const fileId = await this.fileManagerService.put(
  { content: 'Hello, World!', contentType: 'text/plain' },
  STORAGE_CLASS.TEMP
);

// Retrieve a file
const content = await this.fileManagerService.get(fileId);

// Get metadata
const metadata = await this.fileManagerService.getMetaDetails(fileId);
```

## API Endpoints

### Queue Management

| Method | Endpoint                                               | Description                       |
| ------ | ------------------------------------------------------ | --------------------------------- |
| GET    | `/admin/bullmq/job-queue/stats`                        | Get statistics for all queues     |
| GET    | `/admin/bullmq/job-queue/stats/:queueName`             | Get statistics for specific queue |
| GET    | `/admin/bullmq/job-queue/job/:queueName/:jobId`        | Get job details                   |
| POST   | `/admin/bullmq/job-queue/job/:queueName/:jobId/retry`  | Retry failed job                  |
| POST   | `/admin/bullmq/job-queue/job/:queueName/:jobId/remove` | Remove job                        |
| POST   | `/admin/bullmq/job-queue/queue/:queueName/pause`       | Pause queue                       |
| POST   | `/admin/bullmq/job-queue/queue/:queueName/resume`      | Resume queue                      |
| GET    | `/admin/bullmq/job-queue/queue/:queueName/status`      | Get queue status                  |
| POST   | `/admin/bullmq/job-queue/cleanup`                      | Clean all queues                  |
| POST   | `/admin/bullmq/job-queue/cleanup/:queueName`           | Clean specific queue              |
| GET    | `/admin/bullmq/job-queue/health`                       | Health check                      |

### Example API Calls

```bash
# Get all queue statistics
curl http://localhost:3500/admin/bullmq/job-queue/stats

# Get specific queue statistics
curl http://localhost:3500/admin/bullmq/job-queue/stats/message-queue

# Retry a failed job
curl -X POST http://localhost:3500/admin/bullmq/job-queue/job/message-queue/job-123/retry

# Pause a queue
curl -X POST http://localhost:3500/admin/bullmq/job-queue/queue/message-queue/pause

# Health check
curl http://localhost:3500/admin/bullmq/job-queue/health
```

## Monitoring Dashboard

### Bull Board Dashboard

Access the web-based monitoring dashboard at:

```
http://localhost:3500/admin/queues
```

Features:

- Real-time queue statistics
- Job monitoring and management
- Job retry and removal capabilities
- Queue pause/resume functionality
- Job progress tracking

### Redis Commander (Optional)

If using Docker Compose with the `tools` profile:

```bash
# Start with Redis Commander
docker-compose --profile tools up -d

# Access Redis Commander
http://localhost:8081
```

## Configuration Options

### Redis Configuration (`config/redis.conf`)

Key settings:

- **Memory limit**: 256MB with LRU eviction
- **Persistence**: AOF enabled for durability
- **Performance**: Optimized for job queue operations
- **Security**: Basic security settings

### Environment Variables

| Variable                  | Default     | Description               |
| ------------------------- | ----------- | ------------------------- |
| `REDIS_HOST`              | localhost   | Redis server host         |
| `REDIS_PORT`              | 6379        | Redis server port         |
| `REDIS_PASSWORD`          | -           | Redis password (optional) |
| `REDIS_DB`                | 0           | Redis database number     |
| `BULLMQ_REDIS_HOST`       | localhost   | BullMQ Redis host         |
| `BULLMQ_REDIS_PORT`       | 6379        | BullMQ Redis port         |
| `BULLMQ_REDIS_DB`         | 1           | BullMQ Redis database     |
| `JOB_QUEUE_CONCURRENCY`   | 5           | Default job concurrency   |
| `JOB_QUEUE_ATTEMPTS`      | 3           | Default retry attempts    |
| `JOB_QUEUE_BACKOFF_DELAY` | 2000        | Backoff delay in ms       |
| `JOB_QUEUE_BACKOFF_TYPE`  | exponential | Backoff type              |

### File Manager Configuration

| Variable                       | Default              | Description                  |
| ------------------------------ | -------------------- | ---------------------------- |
| `FILE_STORAGE_BASE_PATH`       | ./storage            | Base storage path            |
| `FILE_STORAGE_TEMP_PATH`       | ./storage/temp       | Temporary files path         |
| `FILE_STORAGE_SHORT_TERM_PATH` | ./storage/short-term | Short-term files path        |
| `TEMP_FILE_MAX_AGE`            | 86400000             | Temp file max age (24h)      |
| `SHORT_TERM_FILE_MAX_AGE`      | 604800000            | Short-term file max age (7d) |

## Performance Considerations

### Redis Optimization

1. **Memory Management**: Monitor Redis memory usage
2. **Persistence**: Balance between performance and durability
3. **Connection Pooling**: Use connection pooling for high throughput
4. **Monitoring**: Set up Redis monitoring and alerts

### Job Queue Optimization

1. **Concurrency**: Adjust concurrency based on system resources
2. **Retry Logic**: Configure appropriate retry attempts and backoff
3. **Job Cleanup**: Regular cleanup of completed/failed jobs
4. **Queue Separation**: Use separate queues for different job types

### File Storage Optimization

1. **Storage Classes**: Use appropriate storage classes for different file types
2. **Cleanup**: Regular cleanup of old temporary files
3. **Monitoring**: Monitor disk usage and file counts
4. **Backup**: Implement backup strategy for important files

## Troubleshooting

### Common Issues

#### Redis Connection Errors

```bash
# Check Redis status
redis-cli ping

# Check Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

#### Job Processing Failures

1. Check job logs in Bull Board dashboard
2. Verify job data structure
3. Check processor error handling
4. Review Redis connection stability

#### File Storage Issues

1. Check directory permissions
2. Verify disk space availability
3. Check file manager service logs
4. Validate file ID format

### Monitoring and Logging

#### Application Logs

```bash
# View application logs
tail -f logs/server.json

# View error logs
tail -f logs/error.json
```

#### Redis Monitoring

```bash
# Redis info
redis-cli info

# Monitor Redis commands
redis-cli monitor

# Check memory usage
redis-cli info memory
```

#### Queue Statistics

```bash
# Get queue stats via API
curl http://localhost:3500/admin/bullmq/job-queue/stats

# Health check
curl http://localhost:3500/admin/bullmq/job-queue/health
```

## Security Considerations

### Redis Security

1. **Authentication**: Use Redis AUTH for production
2. **Network**: Restrict Redis access to application servers
3. **Encryption**: Use TLS for Redis connections in production
4. **Firewall**: Configure firewall rules appropriately

### File Storage Security

1. **Permissions**: Set appropriate file permissions
2. **Validation**: Validate file types and sizes
3. **Scanning**: Implement virus scanning for uploads
4. **Access Control**: Implement proper access controls

### API Security

1. **Authentication**: Secure admin endpoints
2. **Rate Limiting**: Implement rate limiting for API calls
3. **Input Validation**: Validate all input parameters
4. **Error Handling**: Avoid exposing sensitive information in errors

## Production Deployment

### Docker Deployment

```bash
# Production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Scale workers
docker-compose up -d --scale worker=3
```

### Environment Configuration

```bash
# Production environment
NODE_ENV=production
REDIS_PASSWORD=your_secure_password
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=your_secure_password
```

### Monitoring Setup

1. **Health Checks**: Implement health check endpoints
2. **Metrics**: Set up metrics collection (Prometheus/Grafana)
3. **Alerts**: Configure alerts for queue backlogs and failures
4. **Logging**: Centralized logging with ELK stack

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npm test -- file-manager.service.spec.ts
```

### Integration Tests

```bash
# Start Redis for testing
docker-compose up -d redis

# Run integration tests
npm run test:e2e
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## Best Practices

### Job Design

1. **Idempotency**: Make jobs idempotent when possible
2. **Error Handling**: Implement proper error handling and logging
3. **Progress Updates**: Update job progress for long-running tasks
4. **Data Validation**: Validate job data before processing

### Queue Management

1. **Queue Separation**: Use separate queues for different job types
2. **Priority Handling**: Use job priorities appropriately
3. **Dead Letter Queues**: Implement dead letter queues for failed jobs
4. **Monitoring**: Monitor queue health and performance

### File Management

1. **Storage Classes**: Use appropriate storage classes
2. **Cleanup**: Implement regular cleanup of old files
3. **Metadata**: Store comprehensive file metadata
4. **Security**: Implement proper file security measures

## Support and Maintenance

### Regular Maintenance

1. **Queue Cleanup**: Regular cleanup of completed jobs
2. **File Cleanup**: Regular cleanup of temporary files
3. **Redis Maintenance**: Regular Redis maintenance and optimization
4. **Monitoring**: Continuous monitoring of system health

### Backup and Recovery

1. **Redis Backup**: Regular Redis data backup
2. **File Backup**: Backup important files
3. **Configuration Backup**: Backup configuration files
4. **Recovery Procedures**: Document recovery procedures

### Updates and Upgrades

1. **Dependency Updates**: Regular dependency updates
2. **Security Patches**: Apply security patches promptly
3. **Version Compatibility**: Ensure version compatibility
4. **Testing**: Test updates in staging environment

## Conclusion

The iStackBuddy Job Queue system provides a robust foundation for background processing with comprehensive monitoring, management, and maintenance capabilities. Follow this guide for successful implementation and operation of the system.

For additional support or questions, refer to the project documentation or contact the development team.
