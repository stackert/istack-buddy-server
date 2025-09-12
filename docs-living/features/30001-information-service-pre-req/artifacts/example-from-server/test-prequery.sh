#!/bin/bash

# Script to test preQuery endpoint and then use response for context-documents call
# Make sure the server is running on localhost:3000

echo "🔍 Testing /information-services/knowledge-bases/preQuery endpoint..."
echo

# Store preQuery response
prequery_response=$(curl -s -X POST http://localhost:3000/information-services/knowledge-bases/preQuery \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "channelIds": ["SLACK:CX-FORMSTACK"],
    "keyWords": ["api", "authentication", "error"],
    "domains": ["API:V2:401-UNAUTHORIZED"],
    "originalQuery": "User getting 401 errors when trying to authenticate with API",
    "aiNormalizedQuery": "User experiencing API authentication issues with 401 errors during form submission"
  }')

echo "📋 PreQuery Response:"
echo "$prequery_response" | jq '.' 2>/dev/null || echo "$prequery_response"

echo
echo "📚 Testing /information-services/knowledge-bases/context-documents/ endpoint..."
echo

# Use the preQuery response to call context-documents endpoint
curl -X POST http://localhost:3000/information-services/knowledge-bases/context-documents/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "channelIds": ["CONTEXT-DOCUMENTS:CORE-FORMS-BE"],
    "keyWords": ["validation", "field", "form"],
    "domains": ["FORM-BUILDER:VALIDATION"],
    "originalQuery": "How to set up field validation in form builder",
    "aiNormalizedQuery": "Setting up field validation rules and requirements in form builder interface"
  }' \
  | jq '.' 2>/dev/null || cat

echo
echo "💬 Testing /information-services/knowledge-bases/slack/ endpoint with same preQuery data..."
echo

# Use the same preQuery data to call slack endpoint
curl -X POST http://localhost:3000/information-services/knowledge-bases/slack/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d '{
    "channelIds": ["SLACK:CX-FORMSTACK"],
    "keyWords": ["api", "authentication", "error"],
    "domains": ["API:V2:401-UNAUTHORIZED"],
    "originalQuery": "User getting 401 errors when trying to authenticate with API",
    "aiNormalizedQuery": "User experiencing API authentication issues with 401 errors during form submission"
  }' \
  | jq '.' 2>/dev/null || cat

echo
echo "✅ All three requests completed"
echo
echo "💡 Demonstrated workflow:"
echo "   1️⃣ preQuery → general search"
echo "   2️⃣ context-documents → documentation search"  
echo "   3️⃣ slack → conversation search with same query"
