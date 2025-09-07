#!/bin/bash

echo "Setting up predictable keyword test data"
echo "========================================"

# Get the 10 slack conversations where is_embedding_dirty = false
echo "Getting conversation IDs for non-dirty records..."

docker exec -it istack-buddy-postgres psql -U postgres -d istack_buddy_info_services -c "
WITH numbered_conversations AS (
  SELECT 
    conversation_id,
    ROW_NUMBER() OVER (ORDER BY conversation_id) as row_num
  FROM slack_conversations 
  WHERE is_embedding_dirty = false 
  LIMIT 10
)
SELECT 
  conversation_id,
  row_num,
  CASE row_num
    WHEN 1 THEN 'one'
    WHEN 2 THEN 'two' 
    WHEN 3 THEN 'three'
    WHEN 4 THEN 'four'
    WHEN 5 THEN 'five'
    WHEN 6 THEN 'six'
    WHEN 7 THEN 'seven'
    WHEN 8 THEN 'eight'
    WHEN 9 THEN 'nine'
    WHEN 10 THEN 'ten'
  END as word_value
FROM numbered_conversations
ORDER BY row_num;
" | tail -n +3 | head -n -2 | while IFS='|' read -r conv_id row_num word_value; do
  
  # Clean up whitespace
  conv_id=$(echo "$conv_id" | xargs)
  word_value=$(echo "$word_value" | xargs)
  
  echo "Updating conversation $row_num: $conv_id with word '$word_value'"
  
  # Update the record with the word in all JSONB fields
  docker exec -it istack-buddy-postgres psql -U postgres -d istack_buddy_info_services -c "
    UPDATE slack_conversations 
    SET 
      keywords = '[\"$word_value\"]',
      nouns = '[\"$word_value\"]', 
      proper_nouns = '[\"$word_value\"]',
      domains = '[\"$word_value\"]'
    WHERE conversation_id = '$conv_id';
  "
  
done

echo ""
echo "Test data setup complete!"
echo "Now you can test:"
echo "  - keyword search for 'one' should find conversation 1"
echo "  - noun search for 'five' should find conversation 5"
echo "  - domain search for 'ten' should find conversation 10"
echo "  - etc."
