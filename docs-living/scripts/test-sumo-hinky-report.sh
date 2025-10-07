#!/bin/bash

# Test The Hinky Report Query - Dynamic Message Counting
# Tests: Message counting across multiple entities (form, account, submit action type, etc.)

set -e

BASE_URL="http://localhost:3505/information-services"
BEARER_TOKEN="istack-buddy-dev-token-2024"
#FORM_ID="6072193"
FORM_ID="6321476" # FORM-3545_authorize_net_bad_ip (personal use form)
ACCOUNT_ID=""
#ACCOUNT_ID="886227"
#SUBMIT_ACTION_TYPE="webhook"
SUBMIT_ACTION_TYPE=""

echo "🔧 Testing The Hinky Report Query - Dynamic Message Counting"
echo "=========================================================="
echo "Form ID: $FORM_ID"
echo "Account ID: $ACCOUNT_ID"
echo "Submit Action Type: $SUBMIT_ACTION_TYPE"
echo ""

# The Hinky Report Query Test
echo "📤 STEP 1: Submitting theHinkyReport query..."

PAYLOAD='{
  "queryName": "theHinkyReport",
  "subjects": {
    "submitActionId": [],
    "submitActionType": ["'$SUBMIT_ACTION_TYPE'"],
    "formId": ["'$FORM_ID'"],
    "accountId": ["'$ACCOUNT_ID'"],
    "submissionId": [],
    "authProviderId": []
  },
  "dateRange": {
    "startDate": "2025-10-06",
    "endDate": "2025-10-06"
  }
}'

echo "📋 INPUT PAYLOAD (Pretty):"
echo "$PAYLOAD" | python3 -m json.tool
echo ""

SUBMIT_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/context-sumo-report/query/submit" \
  -d "$PAYLOAD")

echo "📤 SUBMISSION RESPONSE (Pretty):"
echo "$SUBMIT_RESPONSE" | python3 -m json.tool
echo ""

# Extract job ID
JOB_ID=$(echo "$SUBMIT_RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "❌ ERROR: Could not extract job ID from response"
  exit 1
fi

echo "✅ Job submitted successfully: $JOB_ID"
echo ""

# Poll for completion
echo "⏳ STEP 2: Polling until completion..."

MAX_ATTEMPTS=20
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo -n "   Attempt $ATTEMPT/$MAX_ATTEMPTS: "
  
  STATUS_RESPONSE=$(curl -s \
    -H "Authorization: Bearer $BEARER_TOKEN" \
    "$BASE_URL/context-sumo-report/query/$JOB_ID/status")
  
  STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"progress":[0-9]*' | cut -d':' -f2)
  
  echo "Status: $STATUS, Progress: ${PROGRESS:-0}%"
  
  if [ "$STATUS" = "completed" ]; then
    echo "🎉 Job completed successfully!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Job failed!"
    echo "Full status: $STATUS_RESPONSE"
    exit 1
  fi
  
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$STATUS" != "completed" ]; then
  echo "⏰ Job did not complete within $MAX_ATTEMPTS attempts"
  exit 1
fi

echo ""

# Get results
echo "📥 STEP 3: Fetching hinky report results..."

RESULTS_RESPONSE=$(curl -s \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  "$BASE_URL/context-sumo-report/query/$JOB_ID/results")

echo ""
echo "📊 HINKY REPORT RESULTS:"
echo "======================="

# Check if JSON is valid and show appropriate output
if echo "$RESULTS_RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
  # Valid JSON - parse and display
  echo "$RESULTS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)

print('🎯 EXECUTED QUERY:')
print(data.get('executedQuery', 'N/A'))
print()

records = data.get('records', [])
print(f'📊 RESULTS SUMMARY: {len(records)} records found')
print()

if records:
    print('📋 FIRST RECORD (Count Result):')
    print(json.dumps(records[0], indent=2))
    if len(records) > 1:
        print(f'')
        print(f'📊 Additional Records: {len(records) - 1} more records found')
        # Show total count if multiple records
        total_count = sum(record.get('count', 0) for record in records)
        print(f'📊 TOTAL MESSAGE COUNT: {total_count}')
else:
    print('📭 No records found')
print()

print('📋 VALIDATION:')
print(data.get('validationNote', 'N/A'))
"
else
  echo "❌ JSON PARSING FAILED - Raw Response:"
  echo "Length: ${#RESULTS_RESPONSE} characters"
  echo ""
  echo "Last 100 characters:"
  echo "$RESULTS_RESPONSE" | tail -c 100
  echo ""
  echo "First 200 characters:"  
  echo "$RESULTS_RESPONSE" | head -c 200
  echo ""
fi

echo ""
echo "📈 Summary:"
echo "   Job ID: $JOB_ID"
echo "   Form ID: $FORM_ID" 
echo "   Account ID: $ACCOUNT_ID"
echo "   Submit Action Type: $SUBMIT_ACTION_TYPE"
echo "   Query: theHinkyReport"
echo ""
echo "✅ The Hinky Report Query Test Complete!"