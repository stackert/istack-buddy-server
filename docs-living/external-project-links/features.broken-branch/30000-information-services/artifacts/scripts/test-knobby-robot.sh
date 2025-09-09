#!/bin/bash

# KnobbyOpenAiSearch Robot Test Script
# Tests the robot implementation via dev/debug endpoint

set -e

# Configuration
BASE_URL="http://localhost:3500"
AUTH_TOKEN="istack-buddy-dev-token-2024"

# Multi-line test query using here document
TEST_QUERY=$(cat << 'EOF'
A customer is reporting an issue with the Formstack platform where the 
configured Submit Actions (Integrations | Webhooks) are not executing as expected after form submissions. 
The customer has indicated that while the form is successfully receiving submissions, the associated Webhooks are 
failing to trigger. This situation may indicate a potential connectivity or configuration issue that requires 
further investigation to ensure that the integrations are functioning correctly.


I need you to search the knowledge base. Review any relevant documents and return the most relevant information.
Your response needs to 
include the number of documents you reviewed and any document id that may be relevant.

I need you to give a list of ALL the records return from the knowledge base.  
Indicate something identifying and list the confidence. 

Please make a suggestion from the documentation and the above concern.  Base your suggestions for "next best path forward"
based on the material you have reviewed.

EOF
)

echo "KnobbyOpenAiSearch Robot Test"
echo "============================="
echo "Testing robot via: POST $BASE_URL/dev-debug/knobby-search/test-robot"
echo ""
echo "Test Message:"
echo "$TEST_QUERY"
echo ""

# Call the robot through dev/debug endpoint
echo "Calling KnobbyOpenAiSearch robot..."
echo "$(date): Starting robot test..."

# Create properly escaped JSON payload using jq
JSON_PAYLOAD=$(jq -n --arg message "$TEST_QUERY" '{message: $message}')

# Add timeout to prevent hanging
ROBOT_RESPONSE=$(curl --max-time 60 -s -X POST "$BASE_URL/dev-debug/knobby-search/test-robot" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$JSON_PAYLOAD")

# Check if request succeeded
if [ $? -ne 0 ]; then
    echo "ERROR: curl command failed"
    exit 1
fi

# Check if we got a response
if [ -z "$ROBOT_RESPONSE" ]; then
    echo "ERROR: Empty response from robot"
    exit 1
fi

echo "Robot Response:"
echo "$(date): Robot completed processing"
echo ""

# Try to format the JSON response, fallback to raw output if parsing fails
echo "$ROBOT_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        print('✅ Robot Test: SUCCESS')
        print(f\"Robot: {data.get('robot', 'unknown')} v{data.get('version', 'unknown')}\")
        print(f\"Input: {data.get('input', '')[:50]}...\")
        print('')
        print('Robot Response:')
        print(data.get('response', 'No response content'))
    else:
        print('❌ Robot Test: FAILED')
        print(f\"Error: {data.get('error', 'Unknown error')}\")
        print(f\"Input: {data.get('input', 'Unknown input')}\")
except Exception as e:
    print(f'Could not parse robot response as JSON: {e}')
    print('')
    print('Raw Response:')
    sys.stdin.seek(0)
    print(sys.stdin.read())
" 2>/dev/null || {
    echo "Python JSON parsing failed. Raw response:"
    echo "$ROBOT_RESPONSE"
}

echo ""
echo "============================="
echo "Robot test completed."