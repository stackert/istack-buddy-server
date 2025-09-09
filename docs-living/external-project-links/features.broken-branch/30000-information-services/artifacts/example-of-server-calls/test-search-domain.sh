#!/bin/bash

# Test script for keyword search endpoint
echo "Testing Keyword Search Across Knowledge Bases"
echo "============================================="

# Call keyword search endpoint with keywords from the processed conversation
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/domain-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "domains": ["one"],
    "channelIds": ["SLACK:cx-formstack"]
  }' \
  | jq '.' 2>/dev/null || echo "Response not valid JSON"
