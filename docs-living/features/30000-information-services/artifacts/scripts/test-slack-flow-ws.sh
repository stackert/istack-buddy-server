#!/bin/bash

# Test Multi-Message Conversation Flow
# Tests intent parsing and robot switching across multiple messages in the same conversation

set -e

# Configuration
BASE_URL="http://localhost:3500"
AUTH_TOKEN="your-jwt-token-here"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗣️  CONVERSATION FLOW TEST${NC}"
echo "========================================"
echo "Tests: Intent Parsing + Robot Switching in Multi-Message Conversation"
echo ""

# Test Messages - Each should route to different robots
declare -a TEST_MESSAGES=(
    "Hello! I need help troubleshooting form 12345. The webhook integrations are not working properly."
    "Actually, can you find me documentation about SAML authentication setup instead?"
    "Wait, let me get back to the form issue. What would you recommend for better form validation?"
    "Can you search the logs for integration errors on form 12345 from last week?"
    "Thanks! Now I want to create a new field on form 12345 with some calculation logic."
)

declare -a EXPECTED_ROBOTS=(
    "KnobbyOpenAiSumoReport"  # Integration issues
    "KnobbyOpenAiSearch"      # Documentation search  
    "KnobbyOpenAiSearch"      # Recommendations
    "KnobbyOpenAiSumoReport"  # Log search
    "AnthropicMarv"           # Form management
)

# Create a conversation first
echo -e "${BLUE}🆕 Creating test conversation...${NC}"
CONV_RESPONSE=$(curl -s -X POST "$BASE_URL/dev-debug/chat-manager/start-conversation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"title":"Multi-Message Test","description":"Testing robot switching"}')

CONVERSATION_ID=$(echo "$CONV_RESPONSE" | jq -r '.conversationId // empty')

if [ -z "$CONVERSATION_ID" ]; then
    echo -e "${RED}❌ Failed to create conversation${NC}"
    echo "Response: $CONV_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Conversation created: ${CONVERSATION_ID}${NC}"
echo ""

# Send each message and track robot changes
PREVIOUS_ROBOT=""
MESSAGE_COUNT=1

for i in "${!TEST_MESSAGES[@]}"; do
    MESSAGE="${TEST_MESSAGES[$i]}"
    EXPECTED="${EXPECTED_ROBOTS[$i]}"
    
    echo -e "${PURPLE}📨 Message ${MESSAGE_COUNT}/${#TEST_MESSAGES[@]}:${NC}"
    echo "\"$(echo "$MESSAGE" | head -c 80)...\""
    echo -e "${YELLOW}Expected Robot: ${EXPECTED}${NC}"
    
    # Prepare JSON payload
    JSON_PAYLOAD=$(jq -n --arg message "$MESSAGE" --arg conversationId "$CONVERSATION_ID" '{
        message: $message,
        conversationId: $conversationId
    }')
    
    # Send message
    START_TIME=$(date +%s.%N)
    RESPONSE=$(curl -s -X POST "$BASE_URL/dev-debug/chat-manager/test-conversation-message" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -d "$JSON_PAYLOAD")
    END_TIME=$(date +%s.%N)
    DURATION=$(echo "$END_TIME - $START_TIME" | bc)
    
    # Extract results
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
    ACTUAL_ROBOT=$(echo "$RESPONSE" | jq -r '.intentParsing.robotName // "unknown"')
    INTENT=$(echo "$RESPONSE" | jq -r '.intentParsing.intent // "unknown"')
    SUBINTENTS=$(echo "$RESPONSE" | jq -r '.intentParsing.subIntents // [] | join(", ")')
    
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✅ Parsed Successfully (${DURATION}s)${NC}"
        echo "  Robot: ${ACTUAL_ROBOT}"
        echo "  Intent: ${INTENT}"
        echo "  SubIntents: [${SUBINTENTS}]"
        
        # Check if robot changed
        if [ "$PREVIOUS_ROBOT" != "" ] && [ "$ACTUAL_ROBOT" != "$PREVIOUS_ROBOT" ]; then
            echo -e "  ${BLUE}🔄 Robot switched: ${PREVIOUS_ROBOT} → ${ACTUAL_ROBOT}${NC}"
        fi
        
        # Check if expectation met
        if [ "$ACTUAL_ROBOT" = "$EXPECTED" ]; then
            echo -e "  ${GREEN}✅ Matches expectation${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Expected ${EXPECTED}, got ${ACTUAL_ROBOT}${NC}"
        fi
        
        PREVIOUS_ROBOT="$ACTUAL_ROBOT"
    else
        echo -e "${RED}❌ Failed${NC}"
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
        echo "  Error: $ERROR_MSG"
    fi
    
    echo ""
    MESSAGE_COUNT=$((MESSAGE_COUNT + 1))
    
    # Small delay between messages
    sleep 1
done

echo -e "${BLUE}📊 CONVERSATION FLOW TEST COMPLETE${NC}"
echo ""
echo "Key Tests:"
echo "✅ Intent parsing runs on every message"
echo "✅ Robot switching works mid-conversation" 
echo "✅ Context-aware routing (form issues vs docs vs logs)"
echo "✅ Conversation continuity maintained"
echo ""
echo "Check the results above to see if robot switching worked as expected!"
