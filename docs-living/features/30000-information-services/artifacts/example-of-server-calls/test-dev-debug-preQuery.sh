#!/bin/bash

# Test script for preQuery endpoint with multi-line query
echo "Testing PreQuery Enhancement"
echo "============================"

# Multi-line query using here document
QUERY="Customer is complaining that their webhook is not firing for form 3028442. They say the form submissions are coming through fine but the webhook integration to Salesforce is not working. The customer tried to test it manually but could not reproduce the issue. They need help troubleshooting this submit action problem."

# Call preQuery endpoint and filter out chunks
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{\"query\": \"$QUERY\"}" \
  | jq 'del(.chunks)' 2>/dev/null || echo "Response not valid JSON"
