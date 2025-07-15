# Slack Event Logging

## Overview

The system now logs **ALL** incoming Slack events to individual JSON files for comprehensive debugging and analysis.

## Log Location

```
docs-living/debug-logging/conversations/{unix-timestamp}.slack.log.json
```

## Features

- **Complete RAW Event Capture**: Every Slack webhook event is logged with raw request body before any processing
- **Raw Body Preservation**: Both Buffer and string versions of original request body
- **Deduplication Analysis**: Content hashes and event IDs for duplicate detection
- **Request Metadata**: Full HTTP request details including headers
- **Structured Data**: JSON format for easy parsing and analysis
- **Automatic Directory Creation**: Logging directory is created automatically

## Log Viewer Script

Use the included script to view and analyze Slack event logs:

```bash
./docs-living/scripts/view-slack-logs.sh [options]
```

### Basic Usage

```bash
# Show help
./docs-living/scripts/view-slack-logs.sh --help

# List all logs
./docs-living/scripts/view-slack-logs.sh --list

# Show most recent event
./docs-living/scripts/view-slack-logs.sh --recent

# Watch for new events (real-time)
./docs-living/scripts/view-slack-logs.sh --watch

# Show statistics
./docs-living/scripts/view-slack-logs.sh --stats
```

### Advanced Usage

```bash
# View specific log file
./docs-living/scripts/view-slack-logs.sh --file 1704110400.slack.log.json

# Filter by event type
./docs-living/scripts/view-slack-logs.sh --type app_mention

# Analyze duplicates
./docs-living/scripts/view-slack-logs.sh --duplicates
```

### Example Output

**List view:**

```
📋 Available Slack Event Logs:
===============================
  📄 1704110400.slack.log.json
      Date: Mon Jan  1 12:00:00 PST 2024
      Type: app_mention
      Event ID: Ev1234567890ABCDEF
      User: U1234567890
```

**Statistics view:**

```
📊 Slack Event Statistics:
=========================
Total events: 15

Events by type:
     12 app_mention
      2 url_verification
      1 message

Date range:
  Oldest: Mon Jan  1 10:00:00 PST 2024
  Newest: Mon Jan  1 12:00:00 PST 2024
```

## Log Structure

Each log file contains:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "unixTimestamp": 1704110400,
  "requestInfo": {
    "method": "POST",
    "url": "/istack-buddy/slack-integration/slack/events",
    "headers": {
      /* ALL request headers */
    },
    "rawBody": {
      /* Buffer object - original raw request body */
    },
    "rawBodyString": "{ \"type\": \"event_callback\", \"event\": { ... } }",
    "parsedBody": {
      /* Parsed JSON object */
    },
    "contentLength": "1234",
    "contentType": "application/json"
  },
  "eventAnalysis": {
    "eventType": "app_mention",
    "eventId": "Ev1234567890ABCDEF",
    "eventTime": 1704110400,
    "isChallenge": false,
    "isRetry": false
  },
  "eventDetails": {
    "user": "U1234567890",
    "channel": "C1234567890",
    "text": "@istackbuddy help with form 12345",
    "textPreview": "@istackbuddy help with form 12345"
  },
  "duplicateDetection": {
    "contentHash": "a1b2c3d4e5f6789012345678",
    "potentialEventIds": [
      "slack-event-Ev1234567890ABCDEF",
      "C1234567890-U1234567890-1704110400"
    ]
  }
}
```

## Debugging Duplicate Issues

### Step 1: Check for Duplicate Events

```bash
./docs-living/scripts/view-slack-logs.sh --duplicates
```

This will show:

- Content hashes (duplicates will have same hash)
- Event IDs (should be unique)

### Step 2: Compare Specific Events

```bash
# View first event
./docs-living/scripts/view-slack-logs.sh --file 1704110400.slack.log.json

# View second event
./docs-living/scripts/view-slack-logs.sh --file 1704110401.slack.log.json
```

### Step 3: Analyze Differences

Look for:

- Same `eventId` but different timestamps
- Same `contentHash` but different `eventId`
- `isRetry: true` indicating Slack retry
- Different `x-slack-request-timestamp` values

## Real-time Monitoring

Watch for new events in real-time:

```bash
./docs-living/scripts/view-slack-logs.sh --watch
```

This will show new events as they arrive:

```
👀 Watching for new Slack events...
Press Ctrl+C to stop

🆕 New Slack event: 1704110400.slack.log.json
   Type: app_mention
   User: U1234567890
   Message: @istackbuddy help with form 12345
```

## Integration with Existing System

The logging happens **before** any processing, so you'll see:

1. **All events** - including duplicates before deduplication
2. **Challenge responses** - URL verification events
3. **Retry attempts** - When Slack retries failed requests
4. **Unknown events** - Events your system doesn't handle

## Performance Impact

- **Minimal**: Logging adds ~1ms per event
- **Disk Usage**: ~5KB per event (varies by content)
- **Memory**: No additional memory usage (writes directly to disk)

## Security Notes

- **Sensitive Data**: Logs contain full request data - protect accordingly
- **Retention**: No automatic cleanup - monitor disk usage
- **Access Control**: Restrict access to log directory

## Troubleshooting

### Script Issues

If the script doesn't work:

1. **Check permissions**: `chmod +x docs-living/scripts/view-slack-logs.sh`
2. **Install jq**: `sudo apt-get install jq` (for JSON parsing)
3. **Check directory**: Ensure `docs-living/debug-logging/conversations/` exists

### Missing Logs

If logs aren't being created:

1. **Check server startup**: Look for "Created logging directory" message
2. **Test endpoint**: Send a test event to verify endpoint is working
3. **Check permissions**: Ensure write permissions to log directory

### Large Log Files

For managing disk space:

```bash
# Count total log files
ls -1 docs-living/debug-logging/conversations/*.slack.log.json | wc -l

# Check disk usage
du -h docs-living/debug-logging/conversations/

# Clean up old logs (careful!)
find docs-living/debug-logging/conversations/ -name "*.slack.log.json" -mtime +7 -delete
```

## Next Steps

1. **Monitor logs** after sending test Slack messages
2. **Use duplicate analysis** to verify deduplication is working
3. **Set up log rotation** if needed for production
4. **Create alerts** for unusual patterns or errors
