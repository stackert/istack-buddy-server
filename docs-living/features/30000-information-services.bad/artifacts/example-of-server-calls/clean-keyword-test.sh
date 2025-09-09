#!/bin/bash

# Clean keyword search test (no applicableKnowledgeBase)
echo "Testing Clean Keyword Search"
echo "============================"

curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/keyword-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "keywords": ["one"],
    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.'
