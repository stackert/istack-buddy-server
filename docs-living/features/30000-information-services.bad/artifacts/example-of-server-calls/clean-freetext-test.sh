#!/bin/bash

# Clean free text search test (no applicableKnowledgeBase)
echo "Testing Clean Free Text Search"
echo "=============================="

curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/free-text-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "freeText": ["3455432"],
    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.'
