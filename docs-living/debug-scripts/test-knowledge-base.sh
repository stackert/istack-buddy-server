#!/bin/bash

# Test knowledge base search - preQuery then top-results search

set -e

# Load environment variables from .env.live
source .env.live
USER_QUERY=" what is a sumo report?"
echo "=== Knowledge Base Search Test ==="
echo "Query: '$USER_QUERY'"
echo ""

# Step 1: Submit preQuery
echo "STEP 1: Submitting preQuery..."
prequery_response=$(curl -s -X POST "$ISTACK_INFO_SERVICE_BASE_URL/information-services/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ISTACK_INFO_SERVICE_API_KEY" \
  -d "{
    \"query\": \"$USER_QUERY\",
    \"minConfidence\": 0.7,
    \"pageSize\": 10
  }")

echo "PreQuery Response:"
echo "$prequery_response" | jq 2>/dev/null || echo "$prequery_response"
echo ""

# Step 2: Submit top-results search using preQuery response
echo "STEP 2: Submitting top-results search..."
search_response=$(curl -s -X POST "$ISTACK_INFO_SERVICE_BASE_URL/information-services/knowledge-bases/top-results" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ISTACK_INFO_SERVICE_API_KEY" \
  -d "$prequery_response")

echo "Search Response:"
echo "$search_response" | jq 2>/dev/null || echo "$search_response"
