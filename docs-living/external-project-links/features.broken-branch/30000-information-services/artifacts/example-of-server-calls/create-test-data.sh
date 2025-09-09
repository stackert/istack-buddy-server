#!/bin/bash

# Create test data for semantic search testing
TEST_TEXT="A user is having trouble with form submission. They get an error when clicking submit button. The form validation is working but the submit action fails."

echo "Creating test data for semantic search..."
echo "Test text: $TEST_TEXT"
echo ""

# Step 1: Run preQuery to get processed data and embeddings
echo "Step 1: Running preQuery to get embeddings..."
PREQUERY_RESPONSE=$(curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"query\": \"$TEST_TEXT\"
  }")

echo "PreQuery successful. Saving to preQuery.json..."
echo "$PREQUERY_RESPONSE" | jq '.' > docs-living/10000-embeddings/artifacts/scripts/preQuery.json

# Extract the normalized text and embedding for database insertion
NORMALIZED_TEXT=$(echo "$PREQUERY_RESPONSE" | jq -r '.normalizedText')
CHUNK_TEXT=$(echo "$PREQUERY_RESPONSE" | jq -r '.chunks[0].chunk_text')
# Format embedding properly for PostgreSQL vector type
CHUNK_EMBEDDING=$(echo "$PREQUERY_RESPONSE" | jq -r '.chunks[0].chunk_embedding | tostring')
echo "Embedding length: $(echo "$PREQUERY_RESPONSE" | jq -r '.chunks[0].chunk_embedding | length')"

echo ""
echo "Step 2: Inserting test conversation into database..."

# Generate a test conversation ID
TEST_CONVERSATION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "Generated conversation ID: $TEST_CONVERSATION_ID"

# Insert into slack_conversations
docker exec -it istack-buddy-postgres psql -U postgres -d istack_buddy_info_services -c "
INSERT INTO slack_conversations (
  conversation_id, 
  channel_id, 
  slack_original_message_id, 
  slack_original_message_link,
  conversation_text,
  conversation_text_normalized,
  is_embedding_dirty
) VALUES (
  '$TEST_CONVERSATION_ID',
  'SLACK:cx-formstack',
  'test-message-001',
  'https://test.slack.com/test-message',
  '$TEST_TEXT',
  '$NORMALIZED_TEXT',
  false
);"

# Insert into slack_conversation_chunks with embedding
CHUNK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "Generated chunk ID: $CHUNK_ID"

echo "Inserting chunk with embedding: ${CHUNK_EMBEDDING:0:50}..."

docker exec -it istack-buddy-postgres psql -U postgres -d istack_buddy_info_services -c "
INSERT INTO slack_conversation_chunks (
  chunk_id,
  conversation_id,
  chunk_index,
  chunk_normalized_text,
  chunk_tokens,
  chunk_embedding,
  model_name,
  model_version
) VALUES (
  '$CHUNK_ID',
  '$TEST_CONVERSATION_ID',
  0,
  \$\$${CHUNK_TEXT}\$\$,
  50,
  '${CHUNK_EMBEDDING}',
  'text-embedding-3-small',
  'v1'
);"

echo ""
echo "Test data created successfully!"
echo "Conversation ID: $TEST_CONVERSATION_ID"
echo "Chunk ID: $CHUNK_ID"
echo "PreQuery saved to: docs-living/10000-embeddings/artifacts/scripts/preQuery.json"
echo ""
echo "You can now test semantic search with this known data."
