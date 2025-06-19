#!/bin/bash

# Authentication Example Script
# Tests the POST /auth/user endpoint with the all-permissions@example.com user

echo "🔐 Testing Authentication API"
echo "================================"

# Configuration
SERVER_URL="http://localhost:3000"
AUTH_ENDPOINT="/auth/user"
PROFILE_ENDPOINT="/auth/profile/me"

# Test user credentials (from seed data)
USER_EMAIL="all-permissions@example.com"
USER_PASSWORD="any-password"  # Works with placeholder hash

echo "Testing with user: $USER_EMAIL"
echo "Server: $SERVER_URL"
echo ""

# Cookie jar to store authentication cookies
COOKIE_JAR="/tmp/auth_cookies.txt"
rm -f "$COOKIE_JAR"  # Clean up any existing cookies

# Test 1: Valid authentication request
echo "📤 Step 1: Authenticating user..."
echo ""

curl -X POST "$SERVER_URL$AUTH_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -c "$COOKIE_JAR" \
  -d '{
    "email": "'$USER_EMAIL'",
    "password": "'$USER_PASSWORD'"
  }' \
  -w "\n\n📊 Authentication Status: %{http_code}\n" \
  -s

echo ""
echo "🔍 Step 2: Retrieving user profile using auth cookie..."
echo ""

curl -X GET "$SERVER_URL$PROFILE_ENDPOINT" \
  -H "Accept: application/json" \
  -b "$COOKIE_JAR" \
  -w "\n\n📊 Profile Status: %{http_code}\n" \
  -s

echo ""
echo "🧪 Step 3: Testing profile access without authentication..."
echo ""

curl -X GET "$SERVER_URL$PROFILE_ENDPOINT" \
  -H "Accept: application/json" \
  -w "\n\n📊 Unauthorized Status: %{http_code}\n" \
  -s

# Clean up
rm -f "$COOKIE_JAR"

echo ""
echo "✅ Authentication and profile tests completed!"
echo ""
echo "Expected responses:"
echo "  Authentication (POST /auth/user):"
echo "    200 - Success with JWT token and permissions (sets auth-token cookie)"
echo "    401 - Authentication failed"
echo ""
echo "  Profile (GET /auth/profile/me):"
echo "    200 - Success with user profile and current permissions"
echo "    401 - No authentication token or token expired"
echo ""
echo "💡 How this works:"
echo "   - POST /auth/user: Authenticates with email/password, returns JWT + permissions, sets httpOnly cookie"
echo "   - GET /auth/profile/me: Requires auth-token cookie, returns current user profile"
echo "   - Cookie is httpOnly and secure for security"
echo "   - JWT token is stored in user_authentication_sessions table"
echo "   - Session validation checks token expiry (8 hours)"
echo "   - For development, any password works with placeholder hash users" 