#!/bin/bash

# Submit Action Report Test Script
# Downloads submitActionReport data for form 5894350 from live server
# 1. Submit query job
# 2. Poll status until complete
# 3. Download results file

set -e

# Configuration - LIVE SERVER
BASE_URL="http://192.168.1.4:3505/information-services"
AUTH_TOKEN="istack-buddy-dev-token-2024"


echo "Submit Action Report Test - Form 5894350"
echo "========================================"
echo "Downloading submitActionReport from live server"
echo ""

# Step 1: Submit submitActionReport job
echo "STEP 1: Submitting submitActionReport job for form 5894350..."
echo ""

JOB_PAYLOAD=$(cat << 'EOF'
{
  "queryName": "submitActionReport",
  "subject": {
    "formId": "5894350",
    "startDate": "2025-09-09",
    "endDate": "2025-09-10"
  }
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
echo ""

# Step 2: Poll job status until completion
echo "STEP 2: Polling job status until completion..."
MAX_ATTEMPTS=20
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "$(date): Polling attempt $ATTEMPT/$MAX_ATTEMPTS..."
    
    STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/context-sumo-report/query/$JOB_ID/status" \
      -H "Authorization: Bearer $AUTH_TOKEN")
    
    JOB_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
    
    echo "Status: $JOB_STATUS"
    
    if [ "$JOB_STATUS" = "completed" ]; then
        echo ""
        echo "✅ Job completed!"
        break
    elif [ "$JOB_STATUS" = "failed" ]; then
        echo "❌ Job failed!"
        echo "$STATUS_RESPONSE" | jq
        exit 1
    elif [ "$JOB_STATUS" = "running" ] || [ "$JOB_STATUS" = "queued" ]; then
        echo "⏳ Job still in progress..."
        sleep 15
        ATTEMPT=$((ATTEMPT + 1))
    else
        echo "⚠️ Unknown status: $JOB_STATUS"
        echo "Raw response: $STATUS_RESPONSE"
        sleep 10
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ Timeout: Job did not complete within expected time"
    exit 1
fi

# Step 3: Download the results file
echo ""
echo "STEP 3: Downloading results file..."

# Download the results directly using job ID
OUTPUT_FILE="test-data/live-submitActionReport-form-5894350.json"
echo "Downloading results to: $OUTPUT_FILE"

curl -s -X GET "$BASE_URL/context-sumo-report/query/$JOB_ID/results" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -o "$OUTPUT_FILE"

echo ""
echo "✅ Download completed!"
echo ""

# Verify the file
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(wc -c < "$OUTPUT_FILE")
    echo "File size: $FILE_SIZE bytes"
    
    # Check queryName to verify we got the right data
    QUERY_NAME=$(jq -r '.queryName' "$OUTPUT_FILE" 2>/dev/null || echo "unknown")
    echo "Query Name: $QUERY_NAME"
    
    # Check event types to verify data content
    EVENT_TYPES=$(jq -r '.results[].event' "$OUTPUT_FILE" 2>/dev/null | sort | uniq -c || echo "Could not parse events")
    echo "Event types found:"
    echo "$EVENT_TYPES"
    
    echo ""
    echo "✅ SUCCESS: submitActionReport data downloaded for form 5894350"
    echo "File saved to: $OUTPUT_FILE"
else
    echo "❌ ERROR: File was not created"
    exit 1
fi
