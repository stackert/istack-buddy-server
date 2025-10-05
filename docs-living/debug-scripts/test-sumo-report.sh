#!/bin/bash

# Test Sumo Report error conditions - submit query without required parameters to probe error handling

set -e

# Load environment variables from .env.live
source .env.live

curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ISTACK_INFO_SERVICE_API_KEY" \
    -d '{"queryName": "submissionCreatedForForm"}' \
    "$ISTACK_INFO_SERVICE_BASE_URL/information-services/context-sumo-report/query/submit"
