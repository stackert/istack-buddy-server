# Message Processing & Persistence Plan

## Overview

Core message handling system with real-time delivery, persistence, multiple message types, and support for streaming/batch-delay processing modes.

## Implementation Order

**Priority: 5**
**Dependencies: 11001-authentication, 11005-websocket, 11010-database-schema, 11015-room-management**
**Required Before: Robot integration, file uploads, escalation system**

## Features Included

### 1. Message Processing Pipeline

- Real-time message validation and sanitization
- Multiple message types (chat, robot, system, file, image, graph)
- Streaming vs batch-delay processing modes
- Message delivery confirmation and retry

### 2. Message Persistence

- Efficient database storage with indexing
- Message history and search capabilities
- Message threading and replies
- Message editing and deletion policies

### 3. Real-time Delivery

- WebSocket-based instant delivery
- Room-based message broadcasting
- Offline message queuing
- Read receipt tracking

### 4. Content Management

- Rich content support (text, images, files, graphs)
- Message metadata handling
- Content validation and filtering
- Message size and rate limiting

## Message Types & Structure

### Core Message Interface

```typescript
interface BaseMessage {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  timestamp: Date;
  deliveryStatus: DeliveryStatus;
  metadata: MessageMetadata;
}

enum MessageType {
  CHAT = 'chat', // Standard text message
  ROBOT = 'robot', // Robot-generated response
  SYSTEM = 'system', // System notifications
  FILE = 'file', // File attachments
  IMAGE = 'image', // Image content
  GRAPH = 'graph', // Data visualizations
}

enum DeliveryStatus {
  STREAMING = 'streaming', // Real-time delivery
  BATCH_DELAY = 'batch-delay', // Delayed processing (files, robots)
  DELIVERED = 'delivered', // Successfully delivered
  FAILED = 'failed', // Delivery failed
}

interface MessageMetadata {
  editedAt?: Date;
  readBy?: Array<{ userId: string; readAt: Date }>;
  replyToMessageId?: string;
  threadId?: string;
  robotInteraction?: RobotInteractionMetadata;
  fileAttachments?: FileAttachmentMetadata[];
  deliveryAttempts?: number;
  clientRequestId?: string; // For idempotency
}
```

### Message Type Implementations

```typescript
interface ChatMessage extends BaseMessage {
  type: MessageType.CHAT;
  content: string;
  formatting?: TextFormatting;
}

interface RobotMessage extends BaseMessage {
  type: MessageType.ROBOT;
  content: string | object;
  robotId: string;
  isVisibleToGuests: boolean;
  processingTimeMs?: number;
}

interface SystemMessage extends BaseMessage {
  type: MessageType.SYSTEM;
  content: string;
  systemEventType:
    | 'user_joined'
    | 'user_left'
    | 'room_created'
    | 'escalation_created';
  relatedEntityId?: string;
}

interface FileMessage extends BaseMessage {
  type: MessageType.FILE;
  content: string; // Description or caption
  fileAttachments: FileAttachmentMetadata[];
}
```

## Implementation Strategy

### Message Service Architecture

```typescript
@Injectable()
export class MessageService {
  @RequirePermissions('chat:message:send')
  async sendMessage(
    senderId: string,
    messageData: CreateMessageDto,
  ): Promise<Message> {
    // Validate sender permissions for room
    // Sanitize and validate content
    // Create message in database
    // Process based on delivery status
    // Broadcast to room participants
    // Handle robot interactions if applicable
  }

  async processStreamingMessage(message: Message): Promise<void> {
    // Immediate delivery via WebSocket
    // Store in database
    // Update read receipts
    // Send delivery confirmations
  }

  async processBatchDelayMessage(message: Message): Promise<void> {
    // Queue for background processing
    // Send initial "processing" notification
    // Update when processing completes
    // Handle failures and retries
  }
}
```

### Message Processing Pipeline

```typescript
@Injectable()
export class MessageProcessor {
  async processMessage(
    messageData: CreateMessageDto,
    senderId: string,
  ): Promise<Message> {
    // Phase 1: Validation
    await this.validateMessage(messageData, senderId);

    // Phase 2: Content Processing
    const processedContent = await this.processContent(messageData);

    // Phase 3: Persistence
    const message = await this.persistMessage(processedContent, senderId);

    // Phase 4: Delivery
    await this.deliverMessage(message);

    // Phase 5: Post-processing
    await this.handlePostProcessing(message);

    return message;
  }

  private async validateMessage(
    messageData: CreateMessageDto,
    senderId: string,
  ): Promise<void> {
    // Check room access permissions
    const canSend = await this.roomService.canUserSendMessage(
      senderId,
      messageData.roomId,
    );
    if (!canSend) {
      throw new ForbiddenException('Cannot send message to this room');
    }

    // Content validation
    if (messageData.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message too long');
    }

    // Rate limiting
    await this.rateLimitService.checkMessageRate(senderId);
  }

  private async processContent(
    messageData: CreateMessageDto,
  ): Promise<ProcessedContent> {
    // Sanitize HTML/markdown
    const sanitizedContent = this.contentSanitizer.sanitize(
      messageData.content,
    );

    // Extract mentions and links
    const mentions = this.extractMentions(sanitizedContent);
    const links = this.extractLinks(sanitizedContent);

    // Process attachments
    const attachments = await this.processAttachments(messageData.attachments);

    return {
      content: sanitizedContent,
      mentions,
      links,
      attachments,
    };
  }
}
```

## Real-time Delivery System

### WebSocket Broadcasting

```typescript
@Injectable()
export class MessageBroadcastService {
  async broadcastMessage(message: Message): Promise<void> {
    const room = await this.roomService.findById(message.roomId);
    const participants = await this.roomService.getActiveParticipants(
      message.roomId,
    );

    for (const participant of participants) {
      const canView = await this.canUserViewMessage(
        participant.userId,
        message,
      );
      if (canView) {
        await this.sendToUser(participant.userId, message);
      }
    }
  }

  private async canUserViewMessage(
    userId: string,
    message: Message,
  ): Promise<boolean> {
    // Check room participation
    const isParticipant = await this.roomService.isUserParticipant(
      userId,
      message.roomId,
    );
    if (!isParticipant) return false;

    // Robot message visibility rules
    if (message.type === MessageType.ROBOT) {
      const robotMessage = message as RobotMessage;
      if (!robotMessage.isVisibleToGuests) {
        const userRole = await this.roomService.getUserRole(
          userId,
          message.roomId,
        );
        return userRole !== ParticipantRole.GUEST;
      }
    }

    return true;
  }

  private async sendToUser(userId: string, message: Message): Promise<void> {
    const socketId = await this.connectionService.getSocketId(userId);
    if (socketId) {
      this.wsGateway.sendToClient(socketId, 'message:received', message);
    } else {
      // User offline, queue for later delivery
      await this.offlineMessageService.queueMessage(userId, message);
    }
  }
}
```

### Offline Message Queue

```typescript
@Injectable()
export class OfflineMessageService {
  async queueMessage(userId: string, message: Message): Promise<void> {
    await this.messageQueue.add(
      'deliver-offline-message',
      {
        userId,
        messageId: message.id,
        timestamp: new Date(),
      },
      {
        delay: 0,
        attempts: 3,
        backoff: 'exponential',
      },
    );
  }

  @Process('deliver-offline-message')
  async deliverOfflineMessage(job: Job<OfflineMessageJob>): Promise<void> {
    const { userId, messageId } = job.data;

    // Check if user is now online
    const isOnline = await this.connectionService.isUserOnline(userId);
    if (isOnline) {
      const message = await this.messageService.findById(messageId);
      await this.broadcastService.sendToUser(userId, message);
    } else {
      // Reschedule for later
      throw new Error('User still offline');
    }
  }
}
```

## Message Search & History

### Search Implementation

```typescript
@Injectable()
export class MessageSearchService {
  async searchMessages(
    userId: string,
    query: MessageSearchQuery,
  ): Promise<MessageSearchResult> {
    // Validate user can access rooms in search
    const accessibleRooms = await this.getAccessibleRooms(
      userId,
      query.roomIds,
    );

    // Build search query
    const searchParams = {
      content: query.text,
      roomIds: accessibleRooms,
      dateRange: query.dateRange,
      messageTypes: query.messageTypes,
      senderId: query.senderId,
    };

    // Execute search with pagination
    return await this.executeSearch(searchParams, query.pagination);
  }

  private async executeSearch(
    params: SearchParams,
    pagination: PaginationOptions,
  ): Promise<MessageSearchResult> {
    // Use full-text search capabilities
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.room', 'room')
      .where('message.room_id IN (:...roomIds)', { roomIds: params.roomIds })
      .andWhere('message.deleted_at IS NULL');

    // Add text search
    if (params.content) {
      queryBuilder.andWhere(
        "to_tsvector('english', message.content) @@ plainto_tsquery('english', :query)",
        { query: params.content },
      );
    }

    // Add filters
    if (params.dateRange) {
      queryBuilder.andWhere(
        'message.created_at BETWEEN :startDate AND :endDate',
        params.dateRange,
      );
    }

    // Execute with pagination
    const [messages, total] = await queryBuilder
      .orderBy('message.created_at', 'DESC')
      .skip(pagination.offset)
      .take(pagination.limit)
      .getManyAndCount();

    return {
      messages,
      total,
      hasMore: total > pagination.offset + pagination.limit,
    };
  }
}
```

### Message History API

```typescript
@Controller('messages')
export class MessageController {
  @Get('rooms/:roomId/history')
  @RequirePermissions('chat:message:view')
  async getRoomHistory(
    @Param('roomId') roomId: string,
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: User,
  ): Promise<MessageHistoryResponse> {
    // Validate room access
    const canAccess = await this.roomService.canUserAccessRoom(user.id, roomId);
    if (!canAccess) {
      throw new ForbiddenException('Cannot access room history');
    }

    // Get paginated history
    return await this.messageService.getRoomHistory(roomId, {
      before: query.before,
      limit: query.limit || 50,
      includeDeleted: false,
    });
  }
}
```

## Message Threading & Replies

### Threading Implementation

```typescript
interface MessageThread {
  rootMessageId: string;
  threadId: string;
  participantCount: number;
  messageCount: number;
  lastActivity: Date;
  participants: string[];
}

@Injectable()
export class MessageThreadService {
  async createReply(
    senderId: string,
    replyData: CreateReplyDto,
  ): Promise<Message> {
    const parentMessage = await this.messageService.findById(
      replyData.parentMessageId,
    );

    // Create threaded message
    const threadId = parentMessage.threadId || parentMessage.id;

    const replyMessage = await this.messageService.sendMessage(senderId, {
      ...replyData,
      replyToMessageId: replyData.parentMessageId,
      threadId: threadId,
    });

    // Update thread statistics
    await this.updateThreadStats(threadId);

    return replyMessage;
  }

  async getThread(threadId: string, userId: string): Promise<MessageThread> {
    // Validate access to thread
    const rootMessage = await this.messageService.findById(threadId);
    const canAccess = await this.roomService.canUserAccessRoom(
      userId,
      rootMessage.roomId,
    );

    if (!canAccess) {
      throw new ForbiddenException('Cannot access thread');
    }

    // Get thread messages
    const messages = await this.messageService.getThreadMessages(threadId);

    return {
      rootMessageId: threadId,
      threadId,
      participantCount: new Set(messages.map((m) => m.senderId)).size,
      messageCount: messages.length,
      lastActivity: messages[messages.length - 1]?.timestamp || new Date(),
      participants: [...new Set(messages.map((m) => m.senderId))],
    };
  }
}
```

## Content Validation & Sanitization

### Content Security

```typescript
@Injectable()
export class ContentSanitizer {
  sanitize(content: string, messageType: MessageType): string {
    switch (messageType) {
      case MessageType.CHAT:
        return this.sanitizeText(content);
      case MessageType.ROBOT:
        return this.sanitizeRobotContent(content);
      default:
        return this.sanitizeGeneric(content);
    }
  }

  private sanitizeText(content: string): string {
    // Remove dangerous HTML
    const cleaned = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'br', 'code', 'pre'],
      ALLOWED_ATTR: [],
    });

    // Limit length
    if (cleaned.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message too long');
    }

    return cleaned;
  }

  extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  extractLinks(content: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.match(urlRegex) || [];
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
@Injectable()
export class MessageCacheService {
  async getCachedMessage(messageId: string): Promise<Message | null> {
    const cached = await this.cacheManager.get(`message:${messageId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheMessage(message: Message): Promise<void> {
    await this.cacheManager.set(
      `message:${message.id}`,
      JSON.stringify(message),
      { ttl: 3600 }, // 1 hour
    );
  }

  async getCachedRoomHistory(
    roomId: string,
    page: number,
  ): Promise<Message[] | null> {
    const cacheKey = `room:${roomId}:history:${page}`;
    const cached = await this.cacheManager.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }
}
```

### Database Optimization

```sql
-- Optimize frequent message queries
CREATE INDEX CONCURRENTLY idx_messages_room_created_desc
    ON messages(room_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Full-text search index
CREATE INDEX CONCURRENTLY idx_messages_content_fts
    ON messages USING gin(to_tsvector('english', content))
    WHERE deleted_at IS NULL;

-- Thread queries
CREATE INDEX CONCURRENTLY idx_messages_thread
    ON messages(thread_id, created_at)
    WHERE thread_id IS NOT NULL AND deleted_at IS NULL;
```

## Testing Strategy

### Unit Tests

```typescript
describe('MessageService', () => {
  describe('Message Processing', () => {
    it('should validate message content', async () => {
      // Test content validation
    });

    it('should enforce rate limits', async () => {
      // Test rate limiting
    });

    it('should sanitize dangerous content', async () => {
      // Test content sanitization
    });
  });

  describe('Real-time Delivery', () => {
    it('should broadcast to room participants', async () => {
      // Test broadcasting logic
    });

    it('should respect robot message visibility', async () => {
      // Test guest visibility rules
    });
  });
});
```

### Integration Tests

- End-to-end message flow testing
- WebSocket delivery validation
- Database consistency checks
- Performance under load
- Message search functionality

## Monitoring & Analytics

### Message Metrics

- Messages per second
- Average message size
- Delivery success rates
- Search query performance
- Cache hit rates

### Alerts

- High message failure rates
- Unusual message volumes
- Performance degradation
- Content policy violations

## Success Criteria

- [ ] Real-time message delivery < 100ms
- [ ] Support for all message types (chat, robot, system, file, image, graph)
- [ ] Streaming and batch-delay processing working
- [ ] Message search with full-text capabilities
- [ ] Threading and reply functionality
- [ ] Offline message queueing operational
- [ ] Robot message visibility rules enforced
- [ ] Content validation and sanitization working
- [ ] > 90% test coverage with performance testing
