#!/bin/bash

# Test script for context-dynamic form-fields-observations-source endpoint
echo "Testing Context Dynamic Form Fields Observations Source Endpoint"
echo "================================================================="

# Call form-fields-observations-source endpoint
curl -s -X POST "http://192.168.1.4:3505/information-services/context-dynamic/form-fields-observations-source" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "formId": 5375703
  }' \
  | jq '.' 2>/dev/null || echo "Response not valid JSON"
