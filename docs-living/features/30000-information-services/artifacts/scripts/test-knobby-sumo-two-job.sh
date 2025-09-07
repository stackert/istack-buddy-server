#!/bin/bash

# KnobbyOpenAiSumoReport Two-Job Test Script
# Job 1: Submit Sumo Logic query and wait for completion
# Job 2: Robot analyzes results (if small) or provides download link (if large)

set -e

# Configuration
BASE_URL="http://localhost:3505/information-services"
ROBOT_BASE_URL="http://localhost:3500"
AUTH_TOKEN="istack-buddy-dev-token-2024"
CONTEXT_WINDOW_SIZE=128000  # tokens
CONTEXT_THRESHOLD=$((CONTEXT_WINDOW_SIZE / 4))  # 25% of context window

echo "KnobbyOpenAiSumoReport Two-Job Workflow Test"
echo "==========================================="
echo "Job 1: Robot parses natural language → Submit Sumo query → Wait"
echo "Job 2: Robot analyzes results or provides download link"
echo ""

# Start timing
START_TIME=$(date +%s)

# ROBOT PARSING: Parse natural language into query JSON
echo "🤖 ROBOT PARSING: Converting natural language to query JSON..."
echo "$(date): Starting intent parsing..."

# I need a report of submit actions of form 1234999, from july 5, 2025 until july 10, 2025. All submit action not only webhooks
# Multi-line user prompt using here document
USER_PROMPT=$(cat << 'EOF'

__USER_PROMPT_START__
Can you check for calculation issues on my form 1234999?
__USER_PROMPT_END__

EOF
)

echo "User request: $USER_PROMPT"
echo ""

ROBOT_PARSE_PROMPT="Parse this user request into a Sumo Logic query JSON. Extract the queryName, submitActionType, formId, and date range. Return ONLY valid JSON in this exact format:

{
  \"queryName\": \"submitActionReport\",
  \"subject\": {
    \"submitActionType\": \"webhook\",
    \"startDate\": \"YYYY-MM-DD\",
    \"endDate\": \"YYYY-MM-DD\",
    \"formId\": \"12345\"
  },
  \"isValidationOnly\": false
}

User request: $USER_PROMPT"

ROBOT_PAYLOAD=$(jq -n --arg message "$ROBOT_PARSE_PROMPT" '{message: $message}')

ROBOT_PARSE_RESPONSE=$(curl -s -X POST "$ROBOT_BASE_URL/dev-debug/knobby-sumo/test-robot" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$ROBOT_PAYLOAD")

PARSE_TIME=$(date +%s)
PARSE_DURATION=$((PARSE_TIME - START_TIME))

echo "$(date): Intent parsing completed (${PARSE_DURATION}s)"
# Extract JSON from robot response (may be in markdown code blocks)
RAW_ROBOT_RESPONSE=$(echo "$ROBOT_PARSE_RESPONSE" | jq -r '.response')
echo "Raw robot response:"
echo "$RAW_ROBOT_RESPONSE"
echo ""

# Extract JSON from response (handle both pure JSON and markdown-wrapped)
if echo "$RAW_ROBOT_RESPONSE" | grep -q '```json'; then
    # Extract from markdown code block
    PARSED_JSON=$(echo "$RAW_ROBOT_RESPONSE" | sed -n '/```json/,/```/{/```json/d; /```/d; p;}')
elif echo "$RAW_ROBOT_RESPONSE" | grep -q '^[[:space:]]*{'; then
    # Pure JSON response
    PARSED_JSON="$RAW_ROBOT_RESPONSE"
else
    # Try to find JSON object anywhere in response
    PARSED_JSON=$(echo "$RAW_ROBOT_RESPONSE" | grep -oE '\{[^}]*"queryName"[^}]*\}.*' | head -1)
fi

echo "Robot parsed JSON:"
echo "$PARSED_JSON" | jq 2>/dev/null || {
    echo "❌ ROBOT FAILED TO PARSE INTENT!"
    echo "Robot response was not valid JSON:"
    echo "$PARSED_JSON" 
    echo ""
    echo "The robot must provide valid JSON or the test fails."
    echo "No hardcoded fallback will be used."
    exit 1
}

# Check if robot returned an error (no intent determined)
if echo "$PARSED_JSON" | jq -e '.error' >/dev/null 2>&1; then
    echo "❌ ROBOT COULD NOT DETERMINE INTENT!"
    echo "Robot error response:"
    echo "$PARSED_JSON" | jq
    echo ""
    echo "This is correct behavior when user prompt is unclear or missing."
    exit 1
fi

echo ""
echo "✅ Intent parsing successful! Parsed query:"
echo "$PARSED_JSON" | jq
echo ""

echo "🛑 STOPPING HERE - Intent parsing test complete."
echo "In real implementation, this JSON would be passed to async job system."
echo ""
echo "📊 TIMING SUMMARY:"
echo "  Robot Intent Parsing:  ${PARSE_DURATION}s"
echo ""
