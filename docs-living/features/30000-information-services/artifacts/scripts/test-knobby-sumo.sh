#!/bin/bash

# KnobbyOpenAiSumoReport Test Script
# Tests the asynchronous Sumo Logic reporting workflow:
# 1. Submit query job
# 2. Wait and poll status 
# 3. Fetch results when complete

set -e

# Configuration
BASE_URL="http://localhost:3505/information-services"
AUTH_TOKEN="istack-buddy-dev-token-2024"

echo "KnobbyOpenAiSumoReport Test"
echo "=========================="
echo "Testing asynchronous Sumo Logic reporting workflow"
echo ""

# Step 1: Submit a Sumo Logic query job
echo "STEP 1: Submitting Sumo Logic query job..."
echo "Query: submitActionReport for recent webhook issues"
echo ""

JOB_PAYLOAD=$(cat << 'EOF'
{
  "queryName": "submitActionReport",
  "subject": {
    "submitActionType": "webhook",
    "startDate": "2025-09-05",
    "endDate": "2025-09-06",
    "formId": "4533939"
  },
  "isValidationOnly": false
}
EOF
)

echo "Job payload:"
echo "$JOB_PAYLOAD" | jq
echo ""

SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/context-sumo-report/query/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$JOB_PAYLOAD")

echo "Job submission response:"
echo "$SUBMIT_RESPONSE" | jq 2>/dev/null || echo "Response not valid JSON"

# Extract job ID
JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.jobId' 2>/dev/null || echo "")

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
    echo "ERROR: No job ID received from submission"
    echo "Raw response: $SUBMIT_RESPONSE"
    exit 1
fi

echo ""
echo "Job ID: $JOB_ID"
echo "Status URL: /context-sumo-report/query/$JOB_ID/status"
echo ""

# Step 2: Wait and poll job status
echo "STEP 2: Waiting 30 seconds then polling job status..."
echo "$(date): Waiting..."
sleep 30

echo "$(date): Checking job status..."
STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/context-sumo-report/query/$JOB_ID/status" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "Job status:"
echo "$STATUS_RESPONSE" | jq 2>/dev/null || echo "Response not valid JSON"

# Check if job is complete
JOB_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
echo ""
echo "Job Status: $JOB_STATUS"

if [ "$JOB_STATUS" = "completed" ]; then
    echo ""
    echo "STEP 3: Job completed! Fetching results..."
    
    RESULTS_RESPONSE=$(curl -s -X GET "$BASE_URL/context-sumo-report/query/$JOB_ID/results" \
      -H "Authorization: Bearer $AUTH_TOKEN")
    
    echo "Job results:"
    echo "$RESULTS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(f'Executed Query: {data.get(\"executedQuery\", \"N/A\")}')
    print(f'Record Count: {len(data.get(\"records\", []))}')
    print('')
    print('Full Results:')
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f'Could not parse results: {e}')
    sys.stdin.seek(0)
    print(sys.stdin.read())
" || echo "Results parsing failed"

elif [ "$JOB_STATUS" = "running" ] || [ "$JOB_STATUS" = "queued" ]; then
    echo "Job still in progress. In a real robot, would continue polling..."
    echo "Status: $JOB_STATUS"
    
elif [ "$JOB_STATUS" = "failed" ]; then
    echo "Job failed! Check error details:"
    echo "$STATUS_RESPONSE" | jq
    
else
    echo "Unknown job status: $JOB_STATUS"
    echo "Raw status response: $STATUS_RESPONSE"
fi

echo ""
echo "=========================="
echo "Sumo Logic workflow test completed."
echo ""
echo "This demonstrates the asynchronous pattern that KnobbyOpenAiSumoReport should use:"
echo "1. Submit job with query parameters"
echo "2. Get job ID and estimated duration" 
echo "3. Poll status until completion"
echo "4. Fetch and format results"
