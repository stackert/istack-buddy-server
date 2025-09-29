#!/bin/bash

# Test script for context document fetch endpoint
# Usage: ./test-context-document-fetch.sh [document-id]

DOCUMENT_ID=${1:-"6c59e5c4-825a-4127-8208-be3fdfc8cd29"}
BEARER_TOKEN="istack-buddy-dev-token-2024"
BASE_URL="http://192.168.1.4:3505/information-services"

echo "Testing context document fetch for ID: $DOCUMENT_ID"
curl -v \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  "$BASE_URL/knowledge-bases/context-documents/$DOCUMENT_ID"
