#!/bin/bash

# Re-embed all context documents using the dev-re-embed endpoint
set -e

BASE_URL="http://localhost:3505/information-services"
BEARER_TOKEN="istack-buddy-dev-token-2024"

echo "Re-embedding All Context Documents"
echo "================================="

# First test that we can connect to the endpoint
echo "Testing endpoint connection..."
curl -s -X GET "$BASE_URL/knowledge-bases/" -H "Authorization: Bearer $BEARER_TOKEN" > /dev/null
if [ $? -ne 0 ]; then
    echo "Error: Cannot connect to knowledge-bases endpoint"
    exit 1
fi
echo "Connection successful"
echo ""

# All 14 context document IDs
DOC_IDS=(
    "0b93e1af-d78a-4610-a215-a31925bc388b"
    "0fc7c512-1ba1-476a-8003-0de994852177" 
    "208da9ad-d1f0-4e2f-917a-5a2b6ec0300b"
    "314e7e8e-ad09-410d-9740-7b724f68743d"
    "3b085f5d-e613-474b-b1df-af6d49b8d8b3"
    "3e0e0fa1-ab7c-4c79-aa28-ae58d0ab78b1"
    "58a23c96-652f-4d66-a661-46ccbc69b99c"
    "5e9a97fe-0ee1-4f04-9410-a7bd83bb062d"
    "6bb0a2ec-2b25-4ce1-88ff-cbea26acc02c"
    "6d368b94-6980-4888-a89d-5bee08f21331"
    "85b92e54-e677-4e9e-8a97-fcc4642cc4b1"
    "b5840191-c9b5-4fd2-93af-0e07cdb09618"
    "e6594f83-3947-4043-a61f-440adbbc784d"
    "f67bccc3-14c7-4c52-802f-47ef4e98acc0"
)

echo "Processing ${#DOC_IDS[@]} context documents..."
echo ""

# Process each document
for i in "${!DOC_IDS[@]}"; do
    DOC_ID="${DOC_IDS[$i]}"
    
    echo "Processing $((i+1))/${#DOC_IDS[@]}: $DOC_ID"
    
    # Call dev-re-embed endpoint
    RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" -X GET "$BASE_URL/knowledge-bases/dev-re-embed?documentId=$DOC_ID" \
        -H "Authorization: Bearer $BEARER_TOKEN")
    
    # Extract HTTP code and body
    HTTP_CODE=$(echo "$RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')
    
    echo "  HTTP Status: $HTTP_CODE"
    
    # Parse and display results
    echo "$BODY" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    
    if '$HTTP_CODE' == '200' and 'message' in data and 'extractedTerms' in data:
        print(f'  Success: {data[\"message\"]}')
        
        # Show file path if available
        if 'filePath' in data:
            print(f'  File: {data[\"filePath\"]}')
        
        # Show extracted terms
        terms = data['extractedTerms']
        print(f'  Terms: {terms.get(\"keywords\", 0)} keywords, {terms.get(\"nouns\", 0)} nouns, {terms.get(\"properNouns\", 0)} properNouns, {terms.get(\"domains\", 0)} domains')
        
        # Show chunks created
        if 'chunksCreated' in data:
            print(f'  Chunks: {data[\"chunksCreated\"]} created')
    else:
        print(f'  Error: {data.get(\"message\", data.get(\"error\", \"Unknown error\"))}')
        if 'stack' in data:
            print(f'  Stack: {data[\"stack\"][:200]}...')
        
except json.JSONDecodeError:
    print('  Error: Invalid JSON response')
    print('  Raw response:', repr(sys.stdin.read()[:200]))
except Exception as e:
    print(f'  Error parsing response: {e}')
"
    echo ""
done

echo "Context document re-embedding complete!"
echo "All ${#DOC_IDS[@]} documents processed with fresh terms and embeddings"
