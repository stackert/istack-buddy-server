#!/bin/bash

# Test script for vector search using preQuery + semantic search
#QUERY="Customer reports that they are unable to access the history of a specific form (Form ID: 5911745). The history option is greyed out despite the user being an organizational admin. The issue arose when the customer attempted to delete a section from the form, which resulted in the deletion of the entire form. Attempts to undo the deletion have been unsuccessful, as the option is greyed out. Troubleshooting steps taken include impersonating the user to check the form's history, which shows the last edit was made 11 months ago by another admin, and checking for deleted fields, which returned no results. The customer confirmed they are viewing the correct form."
QUERY="QQ. Hi Team, do we currently support lazy loading of custom JavaScript written on embed code field or on theme(CSS) style? the customer uses this script to validate entered email on the email field, they're are calling out their custom API from browser JavaScript, their API is exposed."


# conversation_id              | f612787b-88e9-45db-97df-fc5622fc7e47
# conversation_text_normalized | Customer reports that they are unable to access the history of a specific form (Form ID: 5911745). The history option is greyed out despite the user being an organizational admin. The issue arose when the customer attempted to delete a section from the form, which resulted in the deletion of the entire form. Attempts to undo the deletion have been unsuccessful, as the option is greyed out. Troubleshooting steps taken include impersonating the user to check the form's history, which shows the last edit was made 11 months ago by another admin, and checking for deleted fields, which returned no results. The customer confirmed they are viewing the correct form.


# conversation_id              | 588519a6-0ccf-4292-a05e-0f4e80f57ee6
# conversation_text_normalized | Customer reports that their clients are experiencing an issue where, upon submitting a form, they are not redirected to the thank you page but instead are returned to the blank form. This issue has been reported by users on both Safari and Chrome browsers. The customer is concerned that this could lead to duplicate submissions. The customer provided several submission IDs for reference. The support agent attempted to replicate the issue by copying the form but was unable to reproduce the problem. It was noted that the customer themselves are not experiencing the issue directly, but it is their clients who are affected. Further investigation revealed that this behavior on iOS mobile devices is by design to mitigate a caching issue that could result in duplicate submissions. A workaround suggested is to add a redirect to a custom thank you page.


# conversation_id              | 8591fe6f-c30e-444e-81a7-de3fa461a793
# conversation_text_normalized | A customer is inquiring whether it is possible to provide a summary of how many people viewed all forms created between July 1, 2024, and June 30, 2025. They mention that some of these forms have been deleted and are asking if there is any way to retrieve that information. The response indicates that there is no official report available for account-level form views, and typically, this information is referenced in Form Analytics on a form-by-form basis. However, an account-level query of form views can be run in Sumo for that specified date range, but it is noted that Sumo searches are limited to 90 days due to data purging policies.



echo "Testing Vector Search Pipeline"
echo "============================="
echo "Query: $QUERY"
echo ""

# Step 1: Call preQuery to analyze the query and get embeddings
echo "Step 1: Processing query with preQuery..."
echo "----------------------------------------"

PREQUERY_RESPONSE=$(curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/preQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"query\": \"$QUERY\"
  }")

echo "PreQuery Response (excluding embeddings):"
echo "$PREQUERY_RESPONSE" | jq 'del(.chunks[].chunk_embedding)' 2>/dev/null || echo "Response not valid JSON"
echo ""

# Step 2: Use semantic search with the same query for vector similarity
echo "Step 2: Performing semantic vector search..."
echo "--------------------------------------------"

curl -s -X POST "http://localhost:3505/information-services/knowledge-bases/semantic-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer istack-buddy-dev-token-2024" \
  -d "{
    \"userPromptText\": \"$QUERY\",
    \"channelIds\": [\"SLACK:cx-formstack\"],
    \"maxConfidence\": 1.0,
    \"limit\": 5
  }" \
  | jq '.' 2>/dev/null || echo "Response not valid JSON"

echo ""
echo "Vector search pipeline completed!"
