#!/bin/bash

# Test Context Dynamic Endpoints with Databricks Backend
# Usage: ./test-context-dynamic.sh [base_url] [auth_token]
# Environment Variables: ACCOUNT_ID, AUTH_PROVIDER_ID, FORM_ID (defaults to 1)

set -e  # Exit on error

# Configuration
BASE_URL=${1:-"http://localhost:3505"}
AUTH_TOKEN="istack-buddy-dev-token-2024"
API_BASE="$BASE_URL/information-services/context-dynamic"

# Test Data Configuration - Customize these IDs for your testing
FORM_ID=6289211
FORM_ID=5375703
ACCOUNT_ID=886227
AUTH_PROVIDER_ID=2175

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
        echo -e "${YELLOW}📝 Request Data: $data${NC}"
    fi
    
    echo -e "${YELLOW}⏳ Making request...${NC}"
    
    # Make the curl request and capture both status and response
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        ${data:+-d "$data"} \
        "$endpoint")
    
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
}

echo -e "${GREEN}🚀 Context Dynamic API Test Script${NC}"
echo -e "${YELLOW}Base URL: $BASE_URL${NC}"
echo -e "${YELLOW}API Base: $API_BASE${NC}"
echo -e "${YELLOW}Auth Token: ${AUTH_TOKEN:0:10}...${NC}"
echo
echo -e "${BLUE}============================================================${NC}"
echo

# Test 1: Health Check
make_request "$API_BASE/health" "" "Health Check"

# Test 2: Get Account (using account ID $ACCOUNT_ID)
make_request "$API_BASE/account" "{\"accountId\": $ACCOUNT_ID}" "Get Account (ID: $ACCOUNT_ID)"

# Test 3: Get Auth Provider (using auth provider ID $AUTH_PROVIDER_ID)  
make_request "$API_BASE/auth-provider" "{\"authProviderId\": $AUTH_PROVIDER_ID}" "Get Auth Provider (ID: $AUTH_PROVIDER_ID)"

# Test 4: Get Form (using form ID $FORM_ID)
make_request "$API_BASE/form" "{\"formId\": $FORM_ID}" "Get Form (ID: $FORM_ID)"

echo -e "${GREEN}🎉 All Context Dynamic tests completed!${NC}"
echo
echo -e "${YELLOW}💡 Tips:${NC}"
echo "  • Install jq for better JSON formatting: brew install jq"
echo "  • Customize test IDs with environment variables:"
echo "    ACCOUNT_ID=123 AUTH_PROVIDER_ID=456 FORM_ID=789 ./test-context-dynamic.sh"
echo "  • Use different auth tokens: ./test-context-dynamic.sh http://localhost:3000 your-token"
echo "  • Test against different environments: ./test-context-dynamic.sh https://your-server.com"
