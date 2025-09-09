#!/bin/bash

# Comprehensive test of all search types
echo "Testing All Search Types"
echo "======================="

echo "1. Keyword Search (existing)..."
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/keyword-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "keywords": ["submission"],

    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.SLACK[0] | {conversation_id, confidence}'

echo ""
echo "3. Semantic Search (new)..."
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "query": "form submission problem",
    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.SLACK[0] | {conversation_id, confidence}'

echo ""
echo "All search types completed!"
