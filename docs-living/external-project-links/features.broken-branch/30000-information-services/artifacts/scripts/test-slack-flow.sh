#!/bin/bash

# Test Slack Flow: Simulate full message routing without Slack
# Tests: Slack Event → ChatManager → Intent Parsing → Robot Selection → Robot Response

set -e

# Configuration
BASE_URL="http://localhost:3500"
AUTH_TOKEN="your-jwt-token-here"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 SLACK FLOW TEST${NC}"
echo "========================================"
echo "Simulates: Slack → ChatManager → Intent Parsing → Robot Selection → Response"
echo ""

# Test message - CHANGE THIS TO TEST DIFFERENT SCENARIOS
TEST_MESSAGE=$(cat << 'EOF'

Can you make a recommendation for logic strategy.

EOF
)

echo -e "${YELLOW}📝 Test Message:${NC}"
echo "\"$TEST_MESSAGE\""
echo ""

# Prepare JSON payload
echo -e "${BLUE}🔧 Preparing request...${NC}"
JSON_PAYLOAD=$(jq -n --arg message "$TEST_MESSAGE" '{message: $message}')

# Start timing
START_TIME=$(date +%s.%N)

echo -e "${BLUE}🚀 Sending to ChatManager (simulating Slack flow)...${NC}"
echo "Endpoint: $BASE_URL/dev-debug/chat-manager/test-slack-flow"

# Make the request
RESPONSE=$(curl -s -X POST "$BASE_URL/dev-debug/chat-manager/test-slack-flow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$JSON_PAYLOAD")

# End timing
END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)

echo ""
echo -e "${GREEN}📋 RESPONSE:${NC}"
echo "$RESPONSE" | jq '.'

echo ""
echo -e "${YELLOW}⏱️  TIMING:${NC}"
echo "Total script time: ${DURATION}s"

# Parse response for success/failure
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
    echo ""
    echo -e "${GREEN}✅ SLACK FLOW TEST: SUCCESS${NC}"
    
    CONVERSATION_ID=$(echo "$RESPONSE" | jq -r '.conversationId // "unknown"')
    SERVER_DURATION=$(echo "$RESPONSE" | jq -r '.duration // "unknown"')
    
    echo "Conversation ID: $CONVERSATION_ID"
    echo "Server processing time: $SERVER_DURATION"
    echo ""
    echo -e "${BLUE}📝 CHECK SERVER LOGS FOR:${NC}"
    echo "- Intent parsing results"
    echo "- Robot selection logic"
    echo "- Robot response content"
    echo "- Full conversation flow details"
else
    echo ""
    echo -e "${RED}❌ SLACK FLOW TEST: FAILED${NC}"
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    echo "Error: $ERROR_MSG"
fi

echo ""
echo -e "${BLUE}🔍 TESTING DIFFERENT SCENARIOS:${NC}"
echo "Modify the TEST_MESSAGE variable above to test:"
echo "- Different robot routing (AnthropicMarv vs KnobbyOpenAiSearch vs SlackyOpenAiAgent)"
echo "- Various intent parsing scenarios"
echo "- Error handling and fallback behavior"
echo "- Follow-up conversation handling"
echo ""
echo "Example test messages:"
echo "  \"Find SAML authentication documentation\""
echo "  \"Generate sumo report for form 123 webhooks last week\""
echo "  \"Help me troubleshoot form validation errors\""
echo "  \"What are the best practices for form security?\""
