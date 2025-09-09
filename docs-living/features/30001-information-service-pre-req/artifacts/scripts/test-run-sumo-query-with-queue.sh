#!/bin/bash

# Test script for dev-debug runSumoReport endpoint
# Tests the complete Sumo Logic workflow: submit -> poll -> results

set -e

# Configuration
BASE_URL="http://localhost:3500"
ENDPOINT="/dev-debug/run-sumo-report"

echo "Testing Sumo Report Workflow"
echo "============================"
echo "Endpoint: POST $BASE_URL$ENDPOINT"
echo ""

# Call the endpoint
echo "Starting Sumo report workflow..."
echo "Calling: curl -X POST $BASE_URL$ENDPOINT"
echo ""

RESPONSE=$(curl -v -X POST "$BASE_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -w "HTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}s\n" 2>&1)

echo "Full curl output:"
echo "$RESPONSE"
echo ""

# Extract just the JSON response if possible
JSON_RESPONSE=$(echo "$RESPONSE" | grep -E '^\{.*\}$' | tail -1)
if [ ! -z "$JSON_RESPONSE" ]; then
    echo "JSON Response:"
    echo "$JSON_RESPONSE" | jq 2>/dev/null || echo "$JSON_RESPONSE"
else
    echo "No JSON response found in output above"
fi

echo ""
echo "Test completed."
