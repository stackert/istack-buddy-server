#!/bin/bash

# Simple Search Flow Example
# Uses 'form' as search query to demonstrate the two-step search process
# 1. Get preQuery object
# 2. Use preQuery to get comprehensive search results

echo "Example Search Flow - Using query: 'form'"
echo "========================================"
echo

SEARCH_QUERY="form"
SERVER_URL="http://localhost:3505"
AUTH_TOKEN="istack-buddy-dev-token-2024"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: Get preQuery object
echo "Step 1: Getting preQuery object..."
prequery_result=$(curl -s -X POST "${SERVER_URL}/information-services/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$(printf '{"query": "%s"}' "$SEARCH_QUERY")")

# Check if preQuery was successful
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to get preQuery results"
  exit 1
fi

# Save preQuery results
echo "$prequery_result" > "${SCRIPT_DIR}/pre-query-results.json"
echo "✓ PreQuery results saved to: pre-query-results.json"

# Step 2: Use preQuery object to get comprehensive search results
echo "Step 2: Getting comprehensive search results..."
search_result=$(curl -s -X POST "${SERVER_URL}/information-services/knowledge-bases/top-results" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$prequery_result")

# Check if search was successful
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to get search results"
  exit 1
fi

# Save search results
echo "$search_result" > "${SCRIPT_DIR}/search-results.json"
echo "✓ Search results saved to: search-results.json"

echo
echo "Search flow completed successfully!"
echo "Files generated:"
echo "  - ${SCRIPT_DIR}/pre-query-results.json"
echo "  - ${SCRIPT_DIR}/search-results.json"
