#!/bin/bash

# Test script to verify raw body logging is working
# This sends a mock Slack event to test the raw body capture

SERVER_URL="http://localhost:3500"
ENDPOINT="/istack-buddy/slack-integration/slack/events"

echo "🧪 Testing Raw Body Logging for Slack Events"
echo "============================================"
echo "Server: $SERVER_URL"
echo "Endpoint: $ENDPOINT"
echo ""

# Test 1: Simple app_mention event
echo "📤 Test 1: Sending mock app_mention event..."
echo ""

# Create a test payload
test_payload='{
  "token": "XXYYZZ",
  "team_id": "T1234567890",
  "api_app_id": "A1234567890",
  "event": {
    "type": "app_mention",
    "user": "U1234567890",
    "text": "@istackbuddy test message for raw body logging",
    "ts": "1234567890.123456",
    "channel": "C1234567890",
    "event_ts": "1234567890.123456"
  },
  "type": "event_callback",
  "event_id": "Ev1234567890ABCDEF",
  "event_time": 1234567890
}'

# Send the request
curl -X POST "$SERVER_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Slack-Signature: v0=test-signature" \
  -H "X-Slack-Request-Timestamp: 1234567890" \
  -d "$test_payload" \
  -w "\n\n📊 Response Status: %{http_code}\n" \
  -s

echo ""
echo "✅ Test event sent!"
echo ""

# Test 2: URL verification challenge
echo "📤 Test 2: Sending URL verification challenge..."
echo ""

challenge_payload='{
  "token": "XXYYZZ",
  "challenge": "test-challenge-12345",
  "type": "url_verification"
}'

curl -X POST "$SERVER_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Slack-Signature: v0=test-signature" \
  -H "X-Slack-Request-Timestamp: 1234567891" \
  -d "$challenge_payload" \
  -w "\n\n📊 Response Status: %{http_code}\n" \
  -s

echo ""
echo "✅ Challenge event sent!"
echo ""

# Wait a moment for files to be written
sleep 2

# Check if log files were created
echo "🔍 Checking for generated log files..."
echo ""

LOG_DIR="docs-living/debug-logging/conversations"
log_files=($(find "$LOG_DIR" -name "*.slack.log.json" -mtime -1 2>/dev/null | sort))

if [ ${#log_files[@]} -eq 0 ]; then
    echo "❌ No log files found in $LOG_DIR"
    echo "💡 Make sure your server is running and the endpoint is accessible"
else
    echo "✅ Found ${#log_files[@]} recent log file(s):"
    for log_file in "${log_files[@]}"; do
        echo "  📄 $log_file"
        
        # Show key information from the log
        if command -v jq >/dev/null 2>&1; then
            echo "      Raw Body Length: $(jq -r '.requestInfo.rawBodyString | length' "$log_file" 2>/dev/null || echo 'unknown')"
            echo "      Event Type: $(jq -r '.eventAnalysis.eventType // "unknown"' "$log_file" 2>/dev/null)"
            echo "      Content Type: $(jq -r '.requestInfo.contentType // "unknown"' "$log_file" 2>/dev/null)"
        fi
        echo ""
    done
fi

echo ""
echo "🎯 To view the logs in detail, run:"
echo "   ./docs-living/scripts/view-slack-logs.sh --list"
echo "   ./docs-living/scripts/view-slack-logs.sh --recent"
echo ""
echo "🔍 To verify raw body capture, check that the logs contain:"
echo "   - requestInfo.rawBody (Buffer object)"
echo "   - requestInfo.rawBodyString (string version)"
echo "   - requestInfo.parsedBody (parsed JSON)"
echo ""
echo "✅ Raw body logging test completed!" 