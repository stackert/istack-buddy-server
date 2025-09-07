#!/bin/bash

# Script to process 100 slack conversations through dev-debug endpoint
# This will call cleanDirtySlackVectorGraphs() for each conversation
# Make sure the server is running on localhost:3505

echo "Processing 100 Slack Conversations for AI Technical Observation"
echo "=============================================================="
echo

# Array of 100 conversation IDs from database
CONVERSATION_IDS=(
  # "588519a6-0ccf-4292-a05e-0f4e80f57ee6"
  "6610e600-2c31-400f-95a1-07f5c80dcf93"
  "8591fe6f-c30e-444e-81a7-de3fa461a793"
  "f612787b-88e9-45db-97df-fc5622fc7e47"
  "55b63d5d-b6e3-4431-a59b-0c0d6aeb6ed7"
  "89721987-850a-4f14-bcfa-8740e1e0286e"
  "d1cc8acf-7623-4845-95bd-27cc26e6f5a7"
  "5c980f56-27a5-426b-be68-fe2c02abfe79"
  "d386db6f-0a17-45f9-bbef-85e9bbfc687c"
  "0a014c9e-ec7c-4aef-8515-96eadf4ec804"
  # "9fbc2025-5fef-4a7a-9def-7af5d0e96da1"
  # "eda45bad-aa6f-487d-bb26-2c3793b97637"
  # "a3f864eb-d2d8-464b-acff-a339ebb8dada"
  # "876614f5-a9f6-41e6-87f4-420016d2a62d"
  # "b65b542e-4fc8-487e-921e-0411e0ae7b58"
  # "33e947c1-cb77-455f-96e6-8f72d988334c"
  # "32f58d2d-8618-4f78-9f9d-10f03ade5bb1"
  # "739fa2ea-6785-4914-b932-bf0c5cb76f8a"
  # "2b27ce9b-483b-4b38-9503-26e1f3db2622"
  # "733be6bd-fd9c-421d-a96f-9d833340d8ed"
  # "a3de9162-680f-45c6-bb3f-6756e0f87562"
  # "25dbe8be-f5f9-4ae3-8f7e-d999c76467ea"
  # "e58fe6f1-0458-48e2-b500-8c7777f2ebd7"
  # "09d6d451-e90a-418d-96b4-643b43fee0d4"
  # "aee1c9b8-688f-4392-ba08-667289e62264"
  # "f498f1b6-a3d4-4b54-bd1f-03395ffafb38"
  # "1215707b-38bf-43ac-b398-5c55c46caf88"
  # "9d192acb-c3da-4bda-9879-6b1bbc51a313"
  # "519f5916-206b-4ecd-8555-3c6104c7540b"
  # "fd27782c-d750-4fed-b7f1-7afdddab8f3d"
  # "76904494-4f41-4d61-8d37-383430091ae1"
  # "3a85e454-a219-455f-894d-b51cc0f6da2b"
  # "822d5ff9-8341-4f49-aae2-417789491219"
  # "fdf79206-c2b8-4e10-8080-6d447dff7c57"
  # "34991226-8e6a-42a8-a8b3-72a4aa742ff4"
  # "16ae0dd1-fc11-470e-8ab0-e383c023a870"
  # "59872fe4-255d-44a6-8dd2-d69114bdc046"
  # "7f3de83e-7361-491e-99a3-937a77ed2b3b"
  # "de8ad6fb-75fe-4e38-be1f-161ff1b18576"
  # "0ea778c9-2f46-4acf-a8e7-6e70d7840243"
  # "2e9212f3-e363-4f11-b0b1-26314487aada"
  # "ce075c41-bd4c-42b7-a890-8758a43c3e0d"
  # "7e0058a4-d94f-41a2-963c-3b3b72b57e4b"
  # "bb0ccf48-cdbd-4241-b36d-b94ad5166415"
  # "94fe0ccc-c551-4cd6-acb3-a5ff6e3e594e"
  # "5bc5b193-3c33-4b77-a914-ac5a59fd4d34"
  # "17941527-ce2b-4f9c-a7f3-e8e0980a5061"
  # "f075a10d-a78a-4a61-b874-c628decd2868"
  # "fcbfbc87-27d5-455c-a209-031b6bb92a06"
  # "2c47e0fb-f92b-4479-b91e-9999179e9255"
  # "f0dc694b-30e9-4a12-8131-f9b67f645ee7"
  # "4c9b0f31-1762-4c30-b24f-db8cfc226734"
  # "5fbb6432-11be-4fd4-9840-9031d841f4f5"
  # "bda481fa-54f3-477f-a9eb-d0c10f660514"
  # "39c48cb2-8681-49f0-8651-ff982f0b72d5"
  # "b973ec6a-4a4e-46b2-be7e-fac506681576"
  # "f8228223-6656-4652-901f-6a967eee9885"
  # "b621133f-fb98-407a-b36a-6464431b9ee0"
  # "c3c884d9-30c1-4720-877e-6f8288ee27fc"
  # "2cb63306-cede-43d6-ae50-3d101d78ba9f"
  # "214d84aa-9627-4d52-a2c5-214a663eb95d"
  # "d3f6eed6-ee7d-4dff-a8e3-6588b2438a18"
  # "23bce3ff-10ff-4a8e-b1e8-d4c4f1f6b229"
  # "91d74341-1574-4a8b-90a2-8868972dc750"
  # "945bf153-cbf7-4d8b-8573-a68943dd0090"
  # "c7388f08-a85f-434c-b999-73ab11bf9c64"
  # "3b814436-0fa1-4ea5-867d-bf29be86d788"
  # "09b02f2c-057f-4e97-8746-60c10594c22a"
  # "2d60a5ba-d08e-43f1-b4a0-279d7c5f7954"
  # "dd8f6c8b-0994-41ed-b539-13d067d43346"
  # "54648e21-8c15-4e2b-b78a-758f5f6bfa74"
  # "1f18fd69-ae3a-4dfb-9ea5-2171d6ed55c6"
  # "321944d5-c17a-40ac-85ed-d6fea1ecf6e8"
  # "b28829c4-b79d-4501-80ca-7d38c33259c2"
  # "f75be923-bf2d-488c-b6f5-a2462238a2d9"
  # "684449a5-5a8c-494b-9862-b30cd3f66b58"
  # "f1ae9a8b-3eca-44da-b2f7-59bb372d6bca"
  # "b186bf5c-ce58-4036-ad8c-40eccc01c6ff"
  # "4dfd5eb0-e0c9-46f8-9b1a-b3633b38098d"
  # "fa764d7c-7da9-4fb1-b480-02a32b44c5ee"
  # "13fd986e-888a-428a-ad04-971c8d492ca3"
  # "2f4c3bc5-3100-4b95-a24c-6023d5f7538b"
  # "01d60d0e-d998-4ac8-aec3-c251b5164e5f"
  # "c7cfadfd-7cc0-4eb7-9204-0eb522cc5457"
  # "9584d604-5c14-49e9-a8d3-9a21e4b8f7ad"
  # "59cb3442-6f0e-44c8-bdf2-db69855b5d25"
  # "398b7037-4af3-48b4-97e9-be34a87fb279"
  # "22423dbd-9d66-4378-a01a-0f82f4727820"
  # "b8fdc147-7545-4a8b-a30e-cba329b5ed4b"
  # "8f763a72-8293-447a-85e6-fde390b93540"
  # "bfd19601-cbb9-4e0f-9766-a66bb114b87f"
  # "94706063-4383-4463-a29b-895b1eaf2acb"
  # "a933a9a8-5d7f-4a6b-87ef-723a49396b72"
  # "86b1f2a6-5f2f-4561-bb41-a36a7610c6e4"
  # "51e73a78-3b4b-490d-967e-624b67665447"
  # "52af2298-49e2-4dc0-9124-ee4e14e1e6b6"
  # "94ee385c-ef09-4288-bab2-d13c8841f1cc"
  # "ded1f146-ab1b-453e-abfb-a9c28a6ffa1e"
  # "607f2377-398b-45e8-82a6-522988e8ea9c"
)

TOTAL=${#CONVERSATION_IDS[@]}
SUCCESS_COUNT=0
ERROR_COUNT=0
START_TIME=$(date +%s)

echo "📊 Processing $TOTAL conversations..."
echo

for i in "${!CONVERSATION_IDS[@]}"; do
  CONVERSATION_ID="${CONVERSATION_IDS[$i]}"
  CURRENT=$((i + 1))
  
  echo "🔄 [$CURRENT/$TOTAL] Processing conversation: $CONVERSATION_ID"
  
  # Call the endpoint and capture response (resetIsDirty=true to force processing)
  RESPONSE=$(curl -s -X GET "http://localhost:3505/information-services/knowledge-bases/dev-debug?conversationId=$CONVERSATION_ID&resetIsDirty=true" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer istack-buddy-dev-token-2024")
  
  # Check if response is valid JSON and successful
  if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "✅ [$CURRENT/$TOTAL] Success"
  else
    ERROR_COUNT=$((ERROR_COUNT + 1))
    echo "❌ [$CURRENT/$TOTAL] Error: $RESPONSE"
  fi
  
  # Progress summary every 10 items
  if [ $((CURRENT % 10)) -eq 0 ] || [ $CURRENT -eq $TOTAL ]; then
    ELAPSED=$(($(date +%s) - START_TIME))
    RATE=$(echo "scale=1; $CURRENT / $ELAPSED" | bc -l 2>/dev/null || echo "0")
    REMAINING=$((TOTAL - CURRENT))
    ETA=$(echo "scale=0; $REMAINING / $RATE" | bc -l 2>/dev/null || echo "0")
    
    echo
    echo "📊 Progress: $CURRENT/$TOTAL ($(echo "scale=1; $CURRENT * 100 / $TOTAL" | bc -l)%) | Success: $SUCCESS_COUNT | Errors: $ERROR_COUNT | Rate: ${RATE}/sec | ETA: ${ETA}s"
    echo
  fi
  
  # Small delay to prevent overwhelming the server
  sleep 1
done

echo
echo "🎉 Batch Processing Complete!"
echo "📊 Final Results:"
echo "   • Total processed: $TOTAL"
echo "   • Successful: $SUCCESS_COUNT"
echo "   • Errors: $ERROR_COUNT"
echo "   • Total time: $ELAPSED seconds"
echo "   • Average rate: $RATE conversations/sec"