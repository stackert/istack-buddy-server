#!/bin/bash

# Test semantic search with the conversation we just created
TEST_QUERY="A user is having trouble with form submission. They get an error when clicking submit button."

echo "Testing semantic search with known inserted conversation"
echo "======================================================"
echo "Query: $TEST_QUERY"
echo "Expected to find conversation: ff464021-553f-446e-8f10-8131e8950f88"
echo ""

curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"userPromptText\": \"$TEST_QUERY\",
    \"channelIds\": [\"SLACK:cx-formstack\"],
    \"maxConfidence\": 1.0,
    \"limit\": 5
  }" \
  | jq '.'

echo ""
echo "If this returns empty results, the issue is in our semantic search implementation."
