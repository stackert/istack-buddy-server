#!/bin/bash

# Script to test preQuery functionality only
# Make sure the server is running on localhost:3000

echo "Testing preQuery Functionality"
echo "============================="
echo

# Multi-line query support - add/edit lines between HERE_DOC markers
xQUERY=$(cat << 'HERE_DOC'
I am trying to figure out why my submit actions are not working correctly.
We get form submission but the webhooks fire but the salesforce integration does not fire.
Is this a configuration issue or an authentication problem?
HERE_DOC
)

x1QUERY=$(cat << 'HERE_DOC'
The form will not render.  I see only a blank page. formId:12303
HERE_DOC
)

# QUERY=$(cat << 'HERE_DOC'
# I can not export my data.  I click the button and nothing happens.
# HERE_DOC
# )

pQUERY=$(cat << 'HERE_DOC'
submission webhook report form 123033
HERE_DOC
)

QUERY=$(cat << 'HERE_DOC'
 can you give me a form context for form 123033
HERE_DOC
)



echo "Testing preQuery with: '$QUERY'"
echo

# Use jq to safely build JSON (handles quotes and special characters)
prequery_result=$(curl -s -X POST http://localhost:3505/information-services/knowledge-bases/preQuery \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "$(jq -n --arg q "$QUERY" '{"query": $q}')")

echo "preQuery Response (chunks hidden for readability):"
echo "$prequery_result" | jq 'del(.chunks) | . + {"chunks": "[\((.chunks | length)) chunks with embeddings hidden]"}' 2>/dev/null || echo "$prequery_result"
