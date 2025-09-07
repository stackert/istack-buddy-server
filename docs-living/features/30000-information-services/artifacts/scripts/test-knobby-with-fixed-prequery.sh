#!/bin/bash

# Test script using stored preQuery response to call top-results
# Uses the prequery-response.json file to test the second step of the workflow

set -e

# Configuration
INFO_SERVICES_URL="http://localhost:3505/information-services"
AUTH_TOKEN="istack-buddy-dev-token-2024"
PREQUERY_FILE="docs-living/features/30000-information-services/artifacts/scripts/prequery-response.json"

echo "KnobbySearch Top-Results Test"
echo "============================"
echo "Using stored preQuery response: $PREQUERY_FILE"
echo ""

# Check if preQuery response file exists
if [ ! -f "$PREQUERY_FILE" ]; then
    echo "ERROR: PreQuery response file not found: $PREQUERY_FILE"
    echo "Run a preQuery call first to generate this file"
    exit 1
fi

echo "PreQuery response content:"
cat "$PREQUERY_FILE" | jq 'del(.chunks[].chunk_embedding)' 2>/dev/null || echo "Could not parse preQuery file"
echo ""

echo "Calling top-results with stored preQuery data..."
echo "$(date): Starting top-results test..."

# Call top-results using the stored preQuery response
TOP_RESULTS_RESPONSE=$(curl -s -X POST "$INFO_SERVICES_URL/knowledge-bases/top-results" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d @"$PREQUERY_FILE")

# Check if request succeeded
if [ $? -ne 0 ]; then
    echo "ERROR: curl command failed"
    exit 1
fi

echo "$(date): Top-results completed"
echo ""

echo "Top-Results Response:"
echo "$TOP_RESULTS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print('Response type:', type(data))
    
    if isinstance(data, list):
        print(f'Response is a list with {len(data)} items')
        print('First item keys:', list(data[0].keys()) if data else 'Empty list')
    elif isinstance(data, dict):
        print(f'Response is a dict with keys: {list(data.keys())}')
        
        # Count total results if it's the expected structure
        total_docs = 0
        search_types = []
        
        for search_type, results in data.items():
            if search_type.startswith('search') and results:
                search_types.append(search_type)
                if isinstance(results, dict):
                    for knowledge_base, docs in results.items():
                        if isinstance(docs, list):
                            total_docs += len(docs)
        
        print(f'Total documents found: {total_docs}')
        print(f'Search types executed: {len(search_types)} - {search_types}')
    
    print('')
    print('Full response:')
    print(json.dumps(data, indent=2))
    
except Exception as e:
    print(f'Could not parse top-results response: {e}')
    print('Raw response text:')
    print(repr(sys.stdin.read()))
" || {
    echo "Python parsing failed. Raw response:"
    echo "$TOP_RESULTS_RESPONSE"
}

echo ""
echo "============================"
echo "Top-results test completed."
