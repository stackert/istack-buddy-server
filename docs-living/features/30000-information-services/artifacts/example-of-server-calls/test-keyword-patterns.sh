#!/bin/bash

echo "Testing Predictable Keyword Patterns"
echo "===================================="

echo "Test 1: Keyword search for 'one' (should find conversation 1)..."
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/keyword-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "keywords": ["one"],

    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.SLACK[0] | {conversation_id, confidence, keywords}'

echo ""
echo "Test 2: Noun search for 'five' (should find conversation 5)..."
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/noun-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "keywords": ["five"],

    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.SLACK[0] | {conversation_id, confidence, nouns}'

echo ""
echo "Test 3: Domain search for 'ten' (should find conversation 10)..."
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/domain-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "keywords": ["ten"],

    "channelIds": ["SLACK:cx-formstack"],
    "limit": 1
  }' \
  | jq '.SLACK[0] | {conversation_id, confidence, domains}'

echo ""
echo "Predictable keyword testing completed!"
