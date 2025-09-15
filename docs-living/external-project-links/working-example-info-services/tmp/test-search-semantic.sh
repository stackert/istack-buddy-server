#!/bin/bash

# Test Knowledge Base Search - Configure search type below
# Usage: ./test-search-semantic.sh [base_url]
# This script performs the 2-step search workflow: preQuery + search endpoint

set -e  # Exit on error

# SEARCH TYPE CONFIGURATION - Uncomment the one you want to test
SEARCH_TYPE="semantic-search"
#SEARCH_TYPE="keyword-search"
#SEARCH_TYPE="noun-search"
#SEARCH_TYPE="proper-noun-search"
#SEARCH_TYPE="domain-search"
#SEARCH_TYPE="free-text-search"

# Configuration
BASE_URL=${1:-"http://localhost:3505"}
AUTH_TOKEN="istack-buddy-dev-token-2024"
API_BASE="$BASE_URL/information-services/knowledge-bases"

# Search Configuration - Customize these for your testing
MAX_CONFIDENCE=${MAX_CONFIDENCE:-1.0}
SEARCH_LIMIT=${SEARCH_LIMIT:-5}
DEBUG=${DEBUG:-false}

# User Query Configuration - Using here document for multiline support
USER_QUERY=$(cat << 'EOF'
Customer is concerned that the data is visible in the export but not visible on the submission table
EOF
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make requests
make_request() {
    local endpoint="$1"
    local data="$2"
    local description="$3"
    
    echo -e "${BLUE}🔍 Testing: $description${NC}"
    echo -e "${YELLOW}📍 Endpoint: $endpoint${NC}"
    
    if [ -n "$data" ]; then
        echo -e "${YELLOW}📝 Request Data:${NC}"
        if command -v jq &> /dev/null; then
            echo "$data" | jq '.'
        else
            echo "$data"
        fi
    fi
    
    echo -e "${YELLOW}⏳ Making request...${NC}"
    
    # Debug output if enabled
    if [ "$DEBUG" = "true" ]; then
        echo -e "${BLUE}[DEBUG] Full curl command:${NC}"
        echo "curl -s --max-time 30 --connect-timeout 10 -X POST"
        echo "  -H \"Content-Type: application/json\""
        echo "  -H \"Authorization: Bearer $AUTH_TOKEN\""
        echo "  ${data:+-d '$data'}"
        echo "  \"$endpoint\""
    fi
    
    # Make the curl request with timeout and capture both status and response
    response=$(curl -s --max-time 30 --connect-timeout 10 -w "\nHTTP_STATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        ${data:+-d "$data"} \
        "$endpoint" 2>/dev/null)
    
    # Check if curl succeeded
    curl_exit_code=$?
    if [ $curl_exit_code -ne 0 ]; then
        echo -e "${RED}❌ Curl request failed (exit code: $curl_exit_code)${NC}"
        case $curl_exit_code in
            28) echo -e "${YELLOW}💡 Request timed out after 30 seconds${NC}" ;;
            7) echo -e "${YELLOW}💡 Could not connect to server${NC}" ;;
            *) echo -e "${YELLOW}💡 Curl error occurred${NC}" ;;
        esac
        return 1
    fi
    
    # Extract HTTP status and response body
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    # Print results
    if [ "$http_status" = "200" ]; then
        echo -e "${GREEN}✅ Success (HTTP $http_status)${NC}"
    else
        echo -e "${RED}❌ Error (HTTP $http_status)${NC}"
    fi
    
    echo -e "${YELLOW}📄 Response:${NC}"
    if command -v jq &> /dev/null; then
        # Pretty print JSON if jq is available
        echo "$response_body" | jq '.'
    else
        # Just print raw response if jq not available
        echo "$response_body"
    fi
    
    echo -e "${BLUE}============================================================${NC}"
    echo
    
    # Return the response body for further processing
    echo "$response_body"
}

# Temporary file to store preQuery response
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

echo -e "${GREEN}🚀 Knowledge Base Search Test Script${NC}"
echo -e "${YELLOW}Search Type: $SEARCH_TYPE${NC}"
echo -e "${YELLOW}Base URL: $BASE_URL${NC}"
echo -e "${YELLOW}API Base: $API_BASE${NC}"
echo -e "${YELLOW}Auth Token: ${AUTH_TOKEN:0:10}...${NC}"
echo -e "${YELLOW}Search Limit: $SEARCH_LIMIT${NC}"
echo -e "${YELLOW}Max Confidence: $MAX_CONFIDENCE${NC}"
echo
echo -e "${YELLOW}🔍 User Query:${NC}"
echo "$USER_QUERY"
echo
echo -e "${BLUE}============================================================${NC}"
echo

# Step 1: Call preQuery to extract terms and enrich the query
echo -e "${GREEN}📋 Step 1: Extracting query terms with preQuery...${NC}"
prequery_data="{\"query\": $(echo "$USER_QUERY" | jq -R .)}"

echo -e "${YELLOW}🔄 Calling preQuery endpoint...${NC}"
prequery_response=$(make_request "$API_BASE/preQuery" "$prequery_data" "PreQuery - Extract Terms")
prequery_exit_code=$?

# Check if make_request succeeded and we got a response
if [ $prequery_exit_code -ne 0 ] || [ -z "$prequery_response" ]; then
    echo -e "${RED}❌ PreQuery request failed or returned no response${NC}"
    echo -e "${YELLOW}💡 Check if the server is running and accessible at $BASE_URL${NC}"
    exit 1
fi

# Save preQuery response to temp file
echo "$prequery_response" > "$TEMP_FILE"

# Show preQuery results (without large vector fields)
echo
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}📊 PREQUERY RESULTS (Step 1 - Term Extraction):${NC}"
echo -e "${BLUE}============================================================${NC}"
if command -v jq &> /dev/null; then
    echo "$prequery_response" | jq --indent 2 '
        {
            originalText: .originalText,
            userPromptText: .userPromptText,
            keywords: .keywords,
            nouns: .nouns,
            properNouns: .properNouns,
            domains: .domains,
            applicableKnowledgeBase: .applicableKnowledgeBase,
            chunk_count: (.chunks | length),
            chunks_preview: [.chunks[]? | {content: (.chunk_text[0:100] + "..."), token_count: .token_count}]
        }' 2>/dev/null || echo "$prequery_response"
else
    # Without jq, just show first 500 characters
    echo "$prequery_response" | head -c 500
    echo "..."
fi
echo

# Prepare search data by adding search parameters to preQuery response
echo -e "${GREEN}✅ PreQuery successful! Preparing data for $SEARCH_TYPE${NC}"

# Add search parameters to the preQuery response
search_data=$(echo "$prequery_response" | jq --arg maxConf "$MAX_CONFIDENCE" --arg limit "$SEARCH_LIMIT" '. + {maxConfidence: ($maxConf | tonumber), limit: ($limit | tonumber)}')

# Step 2: Call the specified search endpoint using full preQuery response
echo
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}🔍 SEARCH RESULTS (Step 2 - $(echo $SEARCH_TYPE | tr '-' ' ' | tr '[:lower:]' '[:upper:]')):${NC}"
echo -e "${BLUE}============================================================${NC}"

search_response=$(make_request "$API_BASE/$SEARCH_TYPE" "$search_data" "$(echo $SEARCH_TYPE | sed 's/-/ /g' | sed 's/\b\w/\U&/g')")
search_exit_code=$?

if [ $search_exit_code -ne 0 ] || [ -z "$search_response" ]; then
    echo -e "${RED}❌ Search request ($SEARCH_TYPE) failed or returned no response${NC}"
    echo -e "${YELLOW}💡 PreQuery data was saved to $TEMP_FILE for debugging${NC}"
    exit 1
fi

# Parse and display search results summary
result_count=$(echo "$search_response" | jq -r '.results | length' 2>/dev/null || echo "0")
if [ "$result_count" -gt 0 ]; then
    echo -e "${GREEN}🎉 Search ($SEARCH_TYPE) completed successfully!${NC}"
    echo -e "${YELLOW}📊 Found $result_count results${NC}"
    
    # Show search results summary (clean, no embeddings)
    if command -v jq &> /dev/null; then
        echo -e "${YELLOW}🔍 Search Results Summary:${NC}"
        echo "$search_response" | jq --indent 2 '
            {
                total_results: (.results | length),
                results: [.results[]? | {
                    knowledge_base,
                    channel_name,
                    confidence,
                    content_preview: (.content[0:150] + "..."),
                    document_name: .document_name,
                    timestamp: .timestamp
                }]
            }' 2>/dev/null || echo "Could not parse search results"
    fi
else
    echo -e "${YELLOW}⚠️ No results found for this search ($SEARCH_TYPE)${NC}"
fi

echo
echo -e "${YELLOW}💡 Tips:${NC}"
echo "  • Change SEARCH_TYPE at the top of this script to test different endpoints"
echo "  • Customize search parameters with environment variables:"
echo "    MAX_CONFIDENCE=0.8 SEARCH_LIMIT=10 ./test-search-semantic.sh"
echo "  • Enable debug mode for troubleshooting:"
echo "    DEBUG=true ./test-search-semantic.sh"
echo "  • Edit the USER_QUERY section at the top to test different queries"
echo "  • Test against different environments: ./test-search-semantic.sh https://your-server.com"
echo "  • Check the temp file for full preQuery response: cat $TEMP_FILE"
