d#!/bin/bash

# Test semantic search using known preQuery data
echo "Testing semantic search with known data..."
echo "=========================================="

if [ ! -f "docs-living/10000-embeddings/artifacts/scripts/preQuery.json" ]; then
    echo "ERROR: preQuery.json not found. Run create-test-data.sh first."
    exit 1
fi

# Extract the original query from preQuery.json
ORIGINAL_QUERY=$(cat docs-living/10000-embeddings/artifacts/scripts/preQuery.json | jq -r '.originalText')
echo "Testing with query: $ORIGINAL_QUERY"
echo ""

# Test 1: Semantic search with exact text
echo "Test 1: Semantic search with exact original text"
echo "------------------------------------------------"
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"userPromptText\": \"$ORIGINAL_QUERY\",
    \"channelIds\": [\"SLACK:cx-formstack\"],
    \"maxConfidence\": 1.0,
    \"limit\": 5
  }" \
  | jq '.'

echo ""

# Test 2: Semantic search with normalized text
NORMALIZED_QUERY=$(cat docs-living/10000-embeddings/artifacts/scripts/preQuery.json | jq -r '.normalizedText')
echo "Test 2: Semantic search with normalized text"
echo "---------------------------------------------"
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"userPromptText\": \"$NORMALIZED_QUERY\",
    \"channelIds\": [\"SLACK:cx-formstack\"],
    \"maxConfidence\": 1.0,
    \"limit\": 5
  }" \
  | jq '.'

echo ""

# Test 3: Similar but not identical text
echo "Test 3: Semantic search with similar text"
echo "------------------------------------------"
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"userPromptText\": \"User has form submission problems and gets errors\",
    \"channelIds\": [\"SLACK:cx-formstack\"],
    \"maxConfidence\": 1.0,
    \"limit\": 5
  }" \
  | jq '.'

echo ""
echo "Testing completed!"
