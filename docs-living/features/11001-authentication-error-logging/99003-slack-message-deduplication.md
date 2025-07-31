# Enhanced Slack Message Deduplication System

## Overview

This document describes the comprehensive deduplication system implemented to prevent duplicate Slack messages from being processed and stored in conversations.

## The Problem

When users mention the bot from a Slack channel, it can create a thread with the same message, potentially causing:

1. **Duplicate events** - Same Slack event received multiple times
2. **Duplicate messages** - Same message content added to conversations multiple times
3. **Thread confusion** - Messages appearing in wrong conversation contexts

## Multi-Layer Deduplication Strategy

### Layer 1: Slack Event Deduplication

**Location**: `src/istack-buddy-slack-api/istack-buddy-slack-api.service.ts`

**Strategy**: Three-tier fallback system for event identification:

```typescript
// Strategy 1: Slack's event_id (most reliable)
if (eventId) {
  const primaryId = `slack-event-${eventId}`;
  // Uses Slack's unique event identifier
}

// Strategy 2: event_time (fallback)
if (eventTime) {
  const eventTimeId = `${event.channel}-${event.user}-${eventTime}`;
  // Uses event_time Unix timestamp
}

// Strategy 3: Legacy method (last resort)
const legacyId = `${event.channel}-${event.ts}-${event.user}`;
// Uses message timestamp, channel, and user
```

**Enhanced Features**:

- **Content hashing** - MD5 hash of message content for duplicate detection
- **Time-based comparison** - Detects near-duplicate messages within 10 seconds
- **Comprehensive logging** - Tracks deduplication method used and reasons

### Layer 2: Message Content Deduplication

**Location**: `src/chat-manager/chat-manager.service.ts`

**Strategy**: Content-based duplicate detection at message level:

```typescript
private generateMessageContentHash(createMessageDto: CreateMessageDto): string {
  const contentToHash = {
    content: createMessageDto.content,
    conversationId: createMessageDto.conversationId,
    fromUserId: createMessageDto.fromUserId,
    fromRole: createMessageDto.fromRole,
    toRole: createMessageDto.toRole,
    messageType: createMessageDto.messageType,
  };

  return createHash('md5')
    .update(JSON.stringify(contentToHash))
    .digest('hex');
}
```

**Features**:

- **MD5 content hashing** - Generates unique hash for message content
- **Conversation-scoped** - Prevents duplicates within same conversation
- **Automatic return** - Returns existing message if duplicate detected
- **Comprehensive logging** - Logs duplicate detection with details

## Event Structure Understanding

### Slack Event Fields

Based on analysis of Slack webhook events:

```typescript
// Full event structure
{
  event_id: string;        // Slack's unique event identifier (most reliable)
  event_time: number;      // Unix timestamp when event was created
  team_id: string;         // Slack workspace ID
  event: {
    type: 'app_mention';
    user: string;          // User ID who sent message
    channel: string;       // Channel ID where message was sent
    ts: string;            // Message timestamp (should be unique)
    thread_ts?: string;    // Thread timestamp if in thread
    text: string;          // Message content
  }
}
```

### Unique Identifiers Priority

1. **`event_id`** - Most reliable, provided by Slack
2. **`event_time`** - Unix timestamp, good fallback
3. **`ts`** - Message timestamp, should be unique but can have issues
4. **Content Hash** - MD5 of message content as final check

## Implementation Details

### Event Deduplication Data Structure

```typescript
interface EventDeduplicationInfo {
  eventId: string; // Primary deduplication ID
  contentHash: string; // MD5 hash of message content
  timestamp: number; // Message timestamp in milliseconds
  eventTime?: number; // Event creation time in milliseconds
  processedAt: number; // When we processed this event
}
```

### Memory Management

**Time-based cleanup**:

- Events older than 5 minutes are automatically removed
- Additional cleanup if more than 1000 events in memory
- Sorted by `processedAt` timestamp for efficient cleanup

**Cleanup Strategy**:

```typescript
// Remove events older than retention time (5 minutes)
if (now - deduplicationInfo.processedAt > this.eventRetentionTime) {
  this.processedEvents.delete(eventId);
}

// Additional cleanup if still too many events
if (this.processedEvents.size > 1000) {
  // Remove oldest 500 events
}
```

## Enhanced Logging

### Slack Event Logging

```typescript
this.logger.log('📥 Received Slack event:', {
  eventType: body.event?.type,
  eventId: body.event_id,
  eventTime: body.event_time,
  teamId: body.team_id,
  eventTs: body.event?.ts,
  eventUser: body.event?.user,
  eventChannel: body.event?.channel,
  eventText: body.event?.text?.substring(0, 100) + '...',
});
```

### Comprehensive Slack Event File Logging

**NEW**: All incoming Slack events are now logged to individual JSON files with **RAW REQUEST BODY** for detailed debugging:

**Location**: `docs-living/debug-logging/conversations/{unix-timestamp}.slack.log.json`

**Features**:

- **RAW Request Body**: Original unmodified request body as Buffer and string
- **Complete Request Data**: Full HTTP request including headers, body, and metadata
- **Event Analysis**: Structured analysis of event type, IDs, timestamps, and flags
- **Duplicate Detection Info**: Content hashes and potential event IDs for debugging
- **Processing Metadata**: Timing and correlation information

**Example Log Structure**:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "unixTimestamp": 1704110400,
  "requestInfo": {
    "method": "POST",
    "url": "/istack-buddy/slack-integration/slack/events",
    "headers": {
      "content-type": "application/json",
      "x-slack-signature": "v0=...",
      "x-slack-request-timestamp": "1704110400",
      "x-slack-retry-num": "1",
      "x-slack-retry-reason": "timeout"
    },
    "body": {
      /* Complete Slack event payload */
    }
  },
  "eventAnalysis": {
    "eventType": "app_mention",
    "eventId": "Ev1234567890ABCDEF",
    "eventTime": 1704110400,
    "teamId": "T1234567890",
    "apiAppId": "A1234567890",
    "isChallenge": false,
    "isRetry": true,
    "retryNum": "1",
    "retryReason": "timeout"
  },
  "eventDetails": {
    "type": "app_mention",
    "user": "U1234567890",
    "channel": "C1234567890",
    "ts": "1704110400.123456",
    "thread_ts": "1704110300.123456",
    "text": "@istackbuddy help with form 12345",
    "textLength": 29,
    "textPreview": "@istackbuddy help with form 12345",
    "blocks": [
      /* Slack blocks if present */
    ],
    "attachments": [
      /* Attachments if present */
    ],
    "files": [
      /* Files if present */
    ],
    "edited": {
      /* Edit info if edited */
    },
    "subtype": null,
    "hidden": false,
    "bot_id": null,
    "channel_type": "channel"
  },
  "duplicateDetection": {
    "contentHash": "a1b2c3d4e5f6789012345678",
    "potentialEventIds": [
      "slack-event-Ev1234567890ABCDEF",
      "C1234567890-U1234567890-1704110400",
      "C1234567890-1704110400.123456-U1234567890"
    ]
  },
  "processingMetadata": {
    "receivedAt": 1704110400123,
    "loggedAt": 1704110400124,
    "sessionId": "sess_abc123",
    "correlationId": "corr_xyz789"
  }
}
```

**Benefits**:

- **Complete Audit Trail**: Every Slack event is preserved for analysis
- **Debugging Duplicate Issues**: Compare multiple events to identify patterns
- **Performance Analysis**: Track request timing and retry patterns
- **Security Monitoring**: Monitor for unusual patterns or attacks
- **Integration Testing**: Validate Slack webhook behavior

### Conversation Logging Enhancement

Each conversation JSON log now includes:

```typescript
{
  conversationId: string,
  timestamp: string,
  conversation: ConversationData,
  participants: ParticipantData[],
  messageCount: number,
  deduplicationInfo: {
    totalContentHashes: number,
    duplicateGroups: number,
    duplicateDetails: Array<{
      contentHash: string,
      messageIds: string[]
    }>
  },
  messages: Message[],
  messageHashes: Array<{
    messageId: string,
    contentHash: string,
    timestamp: string
  }>
}
```

## Monitoring and Debugging

### Log Messages to Watch For

**Successful Deduplication**:

```
🔑 Using Slack event_id for deduplication: slack-event-abc123
⚠️ Duplicate event detected by event ID: slack-event-abc123
⚠️ Duplicate message detected in conversation conv_123
```

**Fallback Methods**:

```
🕐 Using event_time for deduplication: C123-U456-1234567890
⚠️ Using legacy deduplication method: C123-1234567890.123456-U456
```

**Content Hash Duplicates**:

```
⚠️ Duplicate event detected by content hash: a1b2c3d4 (5000ms apart)
⚠️ Duplicate message groups found in conversation conv_123:
   Hash: a1b2c3d4 -> Messages: msg_123, msg_456
```

## Performance Considerations

### Memory Usage

- **Event deduplication**: ~1KB per event, max 1000 events = ~1MB
- **Message hashes**: ~100 bytes per message, grows with conversation size
- **Cleanup intervals**: 1-minute intervals prevent memory buildup

### Processing Overhead

- **MD5 hashing**: ~1ms per message (negligible)
- **Duplicate checking**: O(1) for event ID, O(n) for content hash
- **Cleanup**: O(n) every minute, but only when needed

## Configuration Options

### Environment Variables

```bash
# Deduplication settings (if needed in future)
SLACK_DEDUPLICATION_RETENTION_TIME=300000  # 5 minutes
SLACK_EVENT_CLEANUP_INTERVAL=60000         # 1 minute
SLACK_MAX_EVENTS_IN_MEMORY=1000           # Max events
```

### Tunable Parameters

- `eventRetentionTime`: How long to keep events (currently 5 minutes)
- `eventCleanupInterval`: How often to clean up (currently 1 minute)
- `maxEventsInMemory`: Maximum events before forced cleanup (currently 1000)

## Testing

### Manual Testing

1. **Send same message twice** - Should be deduplicated
2. **Mention bot in channel** - Should not create duplicate threads
3. **Reply in thread** - Should continue existing conversation
4. **Check logs** - Should show deduplication method used

### Automated Testing

Test cases should cover:

- Event ID deduplication
- Event time fallback
- Content hash detection
- Memory cleanup
- Conversation logging enhancements

## Future Enhancements

### Potential Improvements

1. **Database persistence** - Store deduplication info in database
2. **Cross-instance deduplication** - Share deduplication across multiple servers
3. **Advanced content similarity** - Use Levenshtein distance for near-duplicates
4. **Metrics collection** - Track deduplication effectiveness
5. **Admin dashboard** - View deduplication statistics

### Monitoring Recommendations

1. **Track deduplication rates** - How many duplicates are being caught
2. **Memory usage alerts** - Monitor event map size
3. **Performance metrics** - Track processing time impact
4. **Error rate monitoring** - Watch for deduplication failures

## Conclusion

The enhanced deduplication system provides robust protection against duplicate Slack messages through:

1. **Multi-layer approach** - Event-level and message-level deduplication
2. **Multiple fallback strategies** - Reliable identification using best available data
3. **Comprehensive logging** - Full visibility into deduplication decisions
4. **Memory management** - Automatic cleanup prevents memory leaks
5. **Performance optimization** - Minimal overhead with maximum effectiveness

This system addresses the core issue of duplicate messages while providing the debugging information needed to monitor and improve the system over time.
