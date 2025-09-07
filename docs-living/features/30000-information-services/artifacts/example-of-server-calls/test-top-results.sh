#!/bin/bash

# Test Knowledge Base Complete Workflow: USER_QUERY → preQuery → topResults
set -e

BASE_URL="http://localhost:3505/information-services"
BEARER_TOKEN="istack-buddy-dev-token-2024"

USER_QUERY="A customer is reporting an issue with the Formstack platform where the configured Submit Actions (Integrations | Webhooks) are not executing as expected after form submissions. The customer has indicated that while the form is successfully receiving submissions, the associated Webhooks are failing to trigger. This situation may indicate a potential connectivity or configuration issue that requires further investigation to ensure that the integrations are functioning correctly."

echo "Knowledge Base Complete Workflow Test"
echo "===================================="
echo "USER_QUERY → preQuery → topResults"
echo ""

# Step 1: Call preQuery to analyze the user query
echo "STEP 1: Analyzing user query with preQuery..."
echo "Query: ${USER_QUERY:0:100}..."
echo ""

PREQUERY_PAYLOAD=$(cat << EOF
{
  "query": "$USER_QUERY"
}
EOF
)

PREQUERY_RESPONSE=$(curl -s -X POST "$BASE_URL/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -d "$PREQUERY_PAYLOAD")

echo "PREQUERY RESULTS (excluding chunk_embeddings):"
echo "$PREQUERY_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    # Remove chunk_embeddings to make output readable
    if 'chunks' in data and data['chunks']:
        for chunk in data['chunks']:
            if 'chunk_embedding' in chunk:
                chunk['chunk_embedding'] = f\"[{len(chunk['chunk_embedding'])} embedding values hidden]\"
    print(json.dumps(data, indent=2))
except:
    print('Could not parse preQuery response')
"
echo ""

# Step 2: Use preQuery results for topResults mega search
echo "STEP 2: Running ALL search types with top-results..."
echo ""

TOP_RESULTS_RESPONSE=$(curl -s -X POST "$BASE_URL/knowledge-bases/top-results" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -d "$PREQUERY_RESPONSE")

echo "TOP RESULTS (All Search Types):"
echo "$TOP_RESULTS_RESPONSE" | python3 -m json.tool

echo ""
echo "Complete workflow test finished!"