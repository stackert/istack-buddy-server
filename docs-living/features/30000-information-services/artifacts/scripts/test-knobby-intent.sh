#!/bin/bash

# KnobbyOpenAiSearch Intent Routing Test Script
# Tests: Intent Parsing → Robot Selection → Robot Execution → API Calls → Response

set -e

# Configuration
BASE_URL="http://localhost:3500"
AUTH_TOKEN="istack-buddy-dev-token-2024"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 KNOBBY SUMO INTENT ROUTING TEST${NC}"
echo "=============================================="
echo "Tests: Intent Parsing → Robot Selection → API Calls → Response"
echo ""

# Test message - CHANGE THIS TO TEST DIFFERENT SCENARIOS
TEST_MESSAGE=$(cat << 'EOF'
Run me a submissions report for form 5627206 from September 1st to September 7th 2025
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

echo -e "${BLUE}🚀 Testing Intent Routing...${NC}"
echo "Endpoint: $BASE_URL/dev-debug/knobby-sumo/test-intent"
echo ""

# Make the request
RESPONSE=$(curl -s -X POST "$BASE_URL/dev-debug/knobby-sumo/test-intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$JSON_PAYLOAD")

# End timing
END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)

echo -e "${GREEN}📋 RESPONSE:${NC}"
echo "$RESPONSE" | jq '.'

echo ""
echo -e "${YELLOW}⏱️  TIMING:${NC}"
echo "Total script time: ${DURATION}s"

# Parse response for success/failure
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
    echo ""
    echo -e "${GREEN}✅ KNOBBY SUMO INTENT ROUTING TEST: SUCCESS${NC}"
    
    # Extract key information
    CONVERSATION_ID=$(echo "$RESPONSE" | jq -r '.conversationId // "unknown"')
    PROCESSING_TIME=$(echo "$RESPONSE" | jq -r '.processingTimeMs // "unknown"')
    ROBOT_RESPONSE_COUNT=$(echo "$RESPONSE" | jq -r '.robotResponseCount // 0')
    
    echo "Conversation ID: $CONVERSATION_ID"
    echo "Processing time: ${PROCESSING_TIME}ms"
    echo "Robot responses: $ROBOT_RESPONSE_COUNT"
    
    # Check intent parsing results
    INTENT_SUCCESS=$(echo "$RESPONSE" | jq -r '.intentParsing.success // false')
    if [ "$INTENT_SUCCESS" = "true" ]; then
        ROBOT_NAME=$(echo "$RESPONSE" | jq -r '.intentParsing.robotName // "unknown"')
        INTENT_TYPE=$(echo "$RESPONSE" | jq -r '.intentParsing.intent // "unknown"')
        echo -e "${GREEN}Intent Parsing: SUCCESS${NC}"
        echo "  Robot: $ROBOT_NAME"
        echo "  Intent: $INTENT_TYPE"
    else
        echo -e "${RED}Intent Parsing: FAILED${NC}"
        INTENT_ERROR=$(echo "$RESPONSE" | jq -r '.intentParsing.error // "unknown"')
        echo "  Error: $INTENT_ERROR"
    fi
    
    # Check robot response
    if [ "$ROBOT_RESPONSE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}Robot Response: SUCCESS${NC}"
        LAST_MESSAGE=$(echo "$RESPONSE" | jq -r '.lastRobotMessage.content // "none"')
        echo "  Response preview: $LAST_MESSAGE"
    else
        echo -e "${RED}Robot Response: NO RESPONSE${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📝 CHECK SERVER LOGS FOR:${NC}"
    echo "- [INTENT-PARSING] Intent parsing results"
    echo "- [ROBOT-ROUTING] Robot selection and retrieval"
    echo "- [ROBOT-EXECUTION] Robot method calls and completion"
    echo "- [KNOBBY-SEARCH] Robot internal processing"
    echo "- [KNOBBY-SEARCH-API] Information Services API calls"
    echo "- [INTENT-TEST] Test execution steps"
    
else
    echo ""
    echo -e "${RED}❌ INTENT ROUTING TEST: FAILED${NC}"
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    echo "Error: $ERROR_MSG"
fi

echo ""
echo -e "${BLUE}🔍 TESTING DIFFERENT SCENARIOS:${NC}"
echo "Modify the TEST_MESSAGE variable above to test:"
echo ""
echo "Report-related messages (should route to KnobbyOpenAiSumoReport):"
echo "  \"Run me a submissions report for form 5627206 from September 1st to September 7th 2025\""
echo "  \"Generate a report for form submissions last week\""
echo "  \"Show me webhook activity for form 12345\""
echo "  \"Create a report for form 999999 submissions between January 1st and January 31st 2025\""
echo ""
echo "Search-related messages (should route to KnobbyOpenAiSearch):"
echo "  \"Find documentation about SAML authentication\""
echo "  \"Search for webhook configuration guides\""
echo "  \"Help me find troubleshooting information for form validation\""
echo "  \"What are the best practices for form security?\""
echo ""
echo "Form-related messages (should route to AnthropicMarv):"
echo "  \"Help me troubleshoot form 12345 validation errors\""
echo "  \"Debug form logic for form ID 56789\""
echo ""
echo "General messages (should route to SlackyOpenAiAgent):"
echo "  \"What are the office hours?\""
echo "  \"How do I contact support?\""

echo ""
echo "=============================================="
echo "Intent routing test completed."
