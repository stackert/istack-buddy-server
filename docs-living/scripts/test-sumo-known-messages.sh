#!/bin/bash

BASE_URL="http://192.168.1.3:3505/information-services"
BEARER_TOKEN="istack-buddy-dev-token-2024"

curl -s \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  "$BASE_URL/context-sumo-report/known-messages" | jq .
