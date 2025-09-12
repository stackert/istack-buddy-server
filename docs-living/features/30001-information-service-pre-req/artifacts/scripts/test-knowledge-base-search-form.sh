#!/bin/bash

# Knowledge Base Search Test Script
# Downloads knowledge base search data for 'form' from live server
# 1. Submit preQuery for 'form'
# 2. Submit top-results search
# 3. Download results

set -e

# Configuration - LIVE SERVER
BASE_URL="http://192.168.1.4:3505/information-services"
AUTH_TOKEN="istack-buddy-dev-token-2024"

echo "Knowledge Base Search Test - Query: 'form'"
echo "=========================================="
echo "Downloading knowledge base search results from live server"
echo ""

# Step 1: Submit preQuery for analysis
echo "STEP 1: Submitting preQuery for 'form'..."
echo ""

PREQUERY_PAYLOAD=$(cat << 'EOF'
{
  "query": "form",
  "minConfidence": 0.7,
  "pageSize": 10
}
EOF
)

echo "PreQuery payload:"
echo "$PREQUERY_PAYLOAD" | jq
echo ""

PREQUERY_RESPONSE=$(curl -s -X POST "$BASE_URL/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$PREQUERY_PAYLOAD")

echo "PreQuery response:"
echo "$PREQUERY_RESPONSE" | jq 2>/dev/null || echo "Response not valid JSON"
echo ""

# Step 2: Submit top-results search using preQuery response
echo "STEP 2: Submitting top-results search with full preQuery data..."
echo ""

echo "Using preQuery response for top-results search..."

SEARCH_RESPONSE=$(curl -s -X POST "$BASE_URL/knowledge-bases/top-results" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$PREQUERY_RESPONSE")

echo "Search response:"
echo "$SEARCH_RESPONSE" | jq 2>/dev/null || echo "Response not valid JSON"

# Step 3: Save results to file
OUTPUT_FILE="test-data/live-knowledgeBaseSearch-form.json"
echo ""
echo "STEP 3: Saving results to: $OUTPUT_FILE"

echo "$SEARCH_RESPONSE" > "$OUTPUT_FILE"

echo ""
echo "✅ Download completed!"
echo ""

# Verify the file
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(wc -c < "$OUTPUT_FILE")
    echo "File size: $FILE_SIZE bytes"
    
    # Check if we have search results
    SEARCH_TYPES=$(echo "$SEARCH_RESPONSE" | jq -r 'keys[]' 2>/dev/null | grep -v null | head -5 || echo "Could not parse search types")
    echo "Search types found:"
    echo "$SEARCH_TYPES"
    
    echo ""
    echo "✅ SUCCESS: Knowledge base search data downloaded for 'form'"
    echo "File saved to: $OUTPUT_FILE"
else
    echo "❌ ERROR: File was not created"
    exit 1
fi
