#!/bin/bash

# Test embedding consistency: search for exact same text that was used to create embeddings
KNOWN_CONVERSATION_ID="ff464021-553f-446e-8f10-8131e8950f88"
EXACT_TEXT="A user is having trouble with form submission. They get an error when clicking submit button. The form validation is working but the submit action fails."

echo "Testing Embedding Consistency"
echo "============================="
echo "Known Conversation ID: $KNOWN_CONVERSATION_ID"
echo "Searching for EXACT same text used to create the embedding..."
echo ""

# Search for the exact text that was embedded
curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"query\": \"$EXACT_TEXT\",
    \"channelIds\": [\"SLACK:cx-formstack\"],
    \"limit\": 5
  }" \
  | jq --arg conv_id "$KNOWN_CONVERSATION_ID" '
    .SLACK[] | 
    select(.conversation_id == $conv_id) | 
    {
      conversation_id: .conversation_id,
      confidence: .confidence,
      message: "This is the exact same text we embedded - should be very high similarity"
    }
  '

echo ""
echo "Expected: High confidence (0.9+) since this is identical text"
echo "Actual result shows how consistent OpenAI embeddings are for identical text"
