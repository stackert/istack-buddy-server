#!/bin/bash

# Test script for free text search endpoint
echo "Testing Free Text Search with Phrases"
echo "====================================="

#    "freeText": ["would", "smtp", "submission", "export", "well"],

# Test 1: Search for multiple words with OR logic (like keyword search)
echo "Test 1: Searching for 'submission' OR 'error'..."
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/free-text-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "freeText": ["submission"],
    "channelIds": ["SLACK:cx-formstack"],
    "limit": 25
  }' \
  | jq '.'

# echo ""
# echo "Test 2: Search context documents for 'form' OR 'API'..."
# curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/free-text-search" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer istack-buddy-dev-token-2024" \
#   -d '{
#     "freeText": ["form", "API"],
#     "channelIds": ["CONTEXT-DOCUMENTS:CORE-FORMS-FE"],
#     "limit": 2
#   }' \
#   | jq '.'

# echo ""
# echo "Free text search testing completed!"
