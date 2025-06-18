#!/bin/bash

# Authentication Example Script
# Tests the POST /auth/user endpoint with the all-permissions@example.com user

echo "🔐 Testing Authentication API"
echo "================================"

# Configuration
SERVER_URL="http://localhost:3000"
ENDPOINT="/auth/user"

# Note: In a real scenario, you would need to:
# 1. Get the actual user ID from the database after seeding
# 2. Use a real JWT token from your authentication provider
# 
# For this example, we're using placeholder values that match the 
# development setup described in the authentication module documentation.

# Test user credentials (from seed data)
USER_EMAIL="all-permissions@example.com"
USER_PASSWORD="any-password"  # Works with placeholder hash

echo "Testing with user: $USER_EMAIL"
echo "Server: $SERVER_URL$ENDPOINT"
echo ""

# Test 1: Valid authentication request
echo "📤 Sending authentication request..."
echo ""

curl -X POST "$SERVER_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "'$USER_EMAIL'",
    "password": "'$USER_PASSWORD'"
  }' \
  -w "\n\n📊 Response Status: %{http_code}\n" \
  -s

echo ""
echo "✅ Authentication test completed!"
echo ""
echo "Expected responses:"
echo "  200 - Success with user permissions list (22 permissions for all-permissions@example.com)"
echo "  401 - Authentication failed"
echo ""
echo "💡 How this works:"
echo "   - The endpoint now accepts email/password instead of userId/jwtToken"
echo "   - Email lookup is performed automatically by the service"
echo "   - For development, any password works with placeholder hash users"
echo "   - In production, proper password hashing (bcrypt) should be implemented" 