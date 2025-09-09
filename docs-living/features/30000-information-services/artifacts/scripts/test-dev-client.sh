#!/bin/bash

# Test Robot Router Dev Client
# Tests the complete flow: Session creation → Monitor → Chat functionality

set -e

# Configuration
BASE_URL="http://localhost:3500"
COOKIE_FILE="/tmp/dev-client-cookies.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🖥️  ROBOT ROUTER DEV CLIENT TEST${NC}"
echo "========================================"
echo "Tests: Session → Monitor → Chat → Intent Parsing → Robot Switching"
echo ""

# Step 1: Create dev session
echo -e "${YELLOW}🔐 Step 1: Creating dev session...${NC}"
SESSION_RESPONSE=$(curl -s -c "$COOKIE_FILE" "$BASE_URL/dev-debug/create-session")
echo "$SESSION_RESPONSE" | jq '.'

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId // empty')
if [ -z "$SESSION_ID" ]; then
    echo -e "${RED}❌ Failed to create dev session${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dev session created: ${SESSION_ID:0:16}...${NC}"
echo ""

# Step 2: Test monitor API
echo -e "${YELLOW}📺 Step 2: Testing monitor API...${NC}"
CONVERSATIONS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/dev-debug/api/conversations")
echo "Current conversations:"
echo "$CONVERSATIONS_RESPONSE" | jq '.'
echo ""

# Step 3: Create a test conversation and send messages
echo -e "${YELLOW}💬 Step 3: Creating test conversation...${NC}"
CONV_RESPONSE=$(curl -s -X POST "$BASE_URL/dev-debug/chat-manager/start-conversation" \
  -H "Content-Type: application/json" \
  -d '{"title":"Dev Client Test","description":"Testing robot router dev client"}')

CONVERSATION_ID=$(echo "$CONV_RESPONSE" | jq -r '.conversationId // empty')
if [ -z "$CONVERSATION_ID" ]; then
    echo -e "${RED}❌ Failed to create test conversation${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Test conversation created: ${CONVERSATION_ID:0:16}...${NC}"
echo ""

# Step 4: Send test messages to demonstrate robot switching
declare -a TEST_MESSAGES=(
    "Hello! I need help with form 12345 webhook integrations that are not working properly."
    "Actually, can you find me documentation about SAML authentication setup?"
    "What would you recommend for better form field validation?"
    "Can you search the logs for integration errors on form 12345?"
)

echo -e "${YELLOW}🤖 Step 4: Testing robot routing with multiple messages...${NC}"
PREVIOUS_ROBOT=""
MESSAGE_COUNT=1

for MESSAGE in "${TEST_MESSAGES[@]}"; do
    echo -e "${PURPLE}📨 Message ${MESSAGE_COUNT}: ${NC}"
    echo "\"$(echo "$MESSAGE" | head -c 60)...\""
    
    # Send message via dev client API
    SEND_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/dev-debug/api/conversation/$CONVERSATION_ID/send" \
      -H "Content-Type: application/json" \
      -d "{\"message\": \"$MESSAGE\"}")
    
    # Parse response
    SUCCESS=$(echo "$SEND_RESPONSE" | jq -r '.success // false')
    ROBOT_NAME=$(echo "$SEND_RESPONSE" | jq -r '.intentParsing.robotName // "unknown"')
    INTENT=$(echo "$SEND_RESPONSE" | jq -r '.intentParsing.intent // "unknown"')
    SUBINTENTS=$(echo "$SEND_RESPONSE" | jq -r '.intentParsing.subIntents // [] | join(", ")')
    
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}  ✅ Sent successfully${NC}"
        echo "    Robot: ${ROBOT_NAME}"
        echo "    Intent: ${INTENT}"
        echo "    SubIntents: [${SUBINTENTS}]"
        
        # Check for robot switch
        if [ "$PREVIOUS_ROBOT" != "" ] && [ "$ROBOT_NAME" != "$PREVIOUS_ROBOT" ]; then
            echo -e "    ${BLUE}🔄 Robot switched: ${PREVIOUS_ROBOT} → ${ROBOT_NAME}${NC}"
        fi
        
        PREVIOUS_ROBOT="$ROBOT_NAME"
    else
        echo -e "${RED}  ❌ Failed to send${NC}"
        ERROR_MSG=$(echo "$SEND_RESPONSE" | jq -r '.error // "Unknown error"')
        echo "    Error: $ERROR_MSG"
    fi
    
    echo ""
    MESSAGE_COUNT=$((MESSAGE_COUNT + 1))
    sleep 2  # Small delay between messages
done

# Step 5: Test chat page access
echo -e "${YELLOW}🌐 Step 5: Testing chat page access...${NC}"
CHAT_PAGE_STATUS=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}" "$BASE_URL/dev-debug/chat/$CONVERSATION_ID")

if [ "$CHAT_PAGE_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Chat page accessible${NC}"
else
    echo -e "${RED}❌ Chat page failed (HTTP $CHAT_PAGE_STATUS)${NC}"
fi

echo ""

# Step 6: Final conversation status
echo -e "${YELLOW}📊 Step 6: Final conversation status...${NC}"
FINAL_CONVERSATIONS=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/dev-debug/api/conversations")
echo "Updated conversations:"
echo "$FINAL_CONVERSATIONS" | jq '.conversations[] | {id: .id[0:16], messageCount, currentRobot, participants}'

echo ""
echo -e "${BLUE}🎉 DEV CLIENT TEST COMPLETE!${NC}"
echo ""
echo -e "${GREEN}🚀 Ready to use:${NC}"
echo "1. 📺 Monitor: http://localhost:3500/dev-debug/monitor"
echo "2. 💬 Chat: http://localhost:3500/dev-debug/chat/$CONVERSATION_ID"
echo ""
echo -e "${YELLOW}💡 Usage:${NC}"
echo "• Visit monitor page in browser to see live conversation activity"
echo "• Click conversations to join them and chat with robots"
echo "• Watch real-time intent parsing and robot switching"
echo "• Debug panel shows detailed routing decisions"

