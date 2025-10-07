#!/bin/bash

# Test script for submission report - verify existing queries work with /messages endpoint
# This tests that our endpoint selection logic works correctly for individual message queries

BEARER_TOKEN="istack-buddy-dev-token-2024"

echo "🔧 Testing Submission Report Query - Individual Message Records"
echo "=============================================================="

# Test parameters - using a known form ID
FORM_ID="6321476" # FORM-3545_authorize_net_bad_ip (personal use form)
SUBMISSION_ID=""

echo "Form ID: $FORM_ID"
echo "Submission ID: $SUBMISSION_ID"
echo ""

# Step 1: Submit the query
echo "📤 STEP 1: Submitting submissionCreatedForForm query..."

PAYLOAD=$(cat <<EOF
{
    "queryName": "submissionCreatedForForm",
    "subjects": {
        "formId": ["$FORM_ID"],
        "submissionId": ["$SUBMISSION_ID"]
    },
    "dateRange": {
        "startDate": "2025-10-06",
        "endDate": "2025-10-06"
    }
}
EOF
)

echo "📋 INPUT PAYLOAD (Pretty):"
echo "$PAYLOAD" | jq '.'

echo ""
echo "📤 SUBMISSION RESPONSE (Pretty):"

SUBMISSION_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -d "$PAYLOAD" \
  http://localhost:3505/information-services/context-sumo-report/query/submit)

echo "$SUBMISSION_RESPONSE" | jq '.'

# Extract job ID
JOB_ID=$(echo "$SUBMISSION_RESPONSE" | jq -r '.jobId')

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
    echo "❌ Failed to get job ID from response"
    exit 1
fi

echo ""
echo "✅ Job submitted successfully: $JOB_ID"

# Step 2: Poll until completion
echo ""
echo "⏳ STEP 2: Polling until completion..."

MAX_ATTEMPTS=20
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS:"
    
    STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $BEARER_TOKEN" "http://localhost:3505/information-services/context-sumo-report/query/$JOB_ID/status")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress // "N/A"')
    
    echo "   Status: $STATUS, Progress: $PROGRESS"
    
    if [ "$STATUS" = "completed" ]; then
        echo "🎉 Job completed successfully!"
        break
    elif [ "$STATUS" = "failed" ]; then
        echo "❌ Job failed!"
        echo "$STATUS_RESPONSE" | jq '.'
        exit 1
    fi
    
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ Job did not complete within expected time"
    exit 1
fi

# Step 3: Fetch results
echo ""
echo "📥 STEP 3: Fetching submission report results..."

RESULTS_RESPONSE=$(curl -s -H "Authorization: Bearer $BEARER_TOKEN" "http://localhost:3505/information-services/context-sumo-report/query/$JOB_ID/results")

echo ""
echo "📊 SUBMISSION REPORT RESULTS:"
echo "=============================="

# Show executed query
echo "🎯 EXECUTED QUERY:"
echo "$RESULTS_RESPONSE" | jq -r '.executedQuery // "N/A"'
echo ""

# Show results summary
RECORD_COUNT=$(echo "$RESULTS_RESPONSE" | jq -r '.messageCount // 0')
echo "📊 RESULTS SUMMARY: $RECORD_COUNT records found"
echo ""

if [ "$RECORD_COUNT" -gt 0 ]; then
    echo "📋 FIRST RECORD:"
    echo "$RESULTS_RESPONSE" | jq '.records[0] // "No records"'
    echo ""
    
    if [ "$RECORD_COUNT" -gt 1 ]; then
        echo "📊 Additional Records: $((RECORD_COUNT - 1)) more records found"
    fi
else
    echo "📭 No records found"
fi

echo ""
echo "📋 VALIDATION:"
echo "To validate results, run the executedQuery directly in Sumo Logic"
echo ""

# Summary
echo "📈 Summary:"
echo "   Job ID: $JOB_ID"
echo "   Form ID: $FORM_ID"
echo "   Submission ID: $SUBMISSION_ID"
echo "   Query: submissionCreatedForForm"
echo ""

echo "✅ Submission Report Query Test Complete!"
