#!/bin/bash

# Test script for dev-debug runSumoReport endpoint
# Tests the complete Sumo Logic workflow: submit -> poll -> results

set -e

# Configuration
BASE_URL="http://localhost:3505"
ENDPOINT="/dev-debug/run-sumo-report"

echo "Testing Sumo Report Workflow"
echo "============================"
echo "Endpoint: POST $BASE_URL$ENDPOINT"
echo ""

# Call the endpoint
echo "Starting Sumo report workflow..."
RESPONSE=$(curl -s -X POST "$BASE_URL$ENDPOINT" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$RESPONSE" | jq 2>/dev/null || echo "$RESPONSE"

echo ""
echo "Test completed."
