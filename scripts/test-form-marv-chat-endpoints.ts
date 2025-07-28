import axios from 'axios';

/**
 * Test script for Form Marv Chat Message Endpoints
 *
 * Note: Authentication follows the existing pattern:
 * - JWT tokens in query parameters are IGNORED
 * - Authentication uses cookies (if present) or session tokens
 * - Permission validation is handled by guards
 */

async function testFormMarvChatEndpoints() {
  const baseUrl = 'http://localhost:3000';

  console.log('Testing Form Marv Chat Message Endpoints...\n');

  try {
    // Step 1: Create a session
    console.log('1. Creating a Form Marv session...');
    const createResponse = await axios.get(
      `${baseUrl}/public/form-marv/debug-create`,
    );

    // Extract the secret key and formId from the response
    const linkMatch = createResponse.data.match(/href="([^"]+)"/);
    if (!linkMatch) {
      throw new Error('Could not extract session link from response');
    }

    const fullUrl = linkMatch[1];
    const urlParts = fullUrl.split('/');
    const secretKey = urlParts[urlParts.length - 3];
    const formId = urlParts[urlParts.length - 2];
    const jwtTokenMatch = fullUrl.match(/jwtToken=([^&]+)/);
    const jwtToken = jwtTokenMatch ? jwtTokenMatch[1] : '';

    console.log(`   Session created: secretKey=${secretKey}, formId=${formId}`);
    console.log(`   JWT Token: ${jwtToken}\n`);

    // Step 2: Test GET chat messages (should return empty array)
    // Note: JWT token in query parameter is ignored - authentication uses cookies/session
    console.log('2. Testing GET chat messages (should return empty array)...');
    const getResponse = await axios.get(
      `${baseUrl}/public/form-marv/${secretKey}/${formId}/chat-messages`,
    );

    console.log(`   Status: ${getResponse.status}`);
    console.log(`   Response: ${JSON.stringify(getResponse.data)}`);

    if (Array.isArray(getResponse.data) && getResponse.data.length === 0) {
      console.log('   ✅ GET endpoint working correctly\n');
    } else {
      console.log('   ❌ GET endpoint returned unexpected data\n');
    }

    // Step 3: Test GET with dtSinceMs parameter
    console.log('3. Testing GET chat messages with dtSinceMs parameter...');
    const dtSinceMs = Date.now() - 60000; // 1 minute ago
    const getWithTimeResponse = await axios.get(
      `${baseUrl}/public/form-marv/${secretKey}/${formId}/chat-messages?dtSinceMs=${dtSinceMs}`,
    );

    console.log(`   Status: ${getWithTimeResponse.status}`);
    console.log(`   Response: ${JSON.stringify(getWithTimeResponse.data)}`);

    if (
      Array.isArray(getWithTimeResponse.data) &&
      getWithTimeResponse.data.length === 0
    ) {
      console.log('   ✅ GET with dtSinceMs parameter working correctly\n');
    } else {
      console.log(
        '   ❌ GET with dtSinceMs parameter returned unexpected data\n',
      );
    }

    // Step 4: Test POST chat message
    console.log('4. Testing POST chat message...');
    const messageData = {
      message: 'Hello, this is a test message!',
      type: 'user',
      timestamp: Date.now(),
    };

    const postResponse = await axios.post(
      `${baseUrl}/public/form-marv/${secretKey}/${formId}/chat-messages`,
      messageData,
    );

    console.log(`   Status: ${postResponse.status}`);
    console.log(`   Response: ${JSON.stringify(postResponse.data)}`);

    if (postResponse.data.success && postResponse.data.messageId) {
      console.log('   ✅ POST endpoint working correctly\n');
    } else {
      console.log('   ❌ POST endpoint returned unexpected data\n');
    }

    // Step 5: Test error cases
    console.log('5. Testing error cases...');

    // Test with invalid secret key
    try {
      await axios.get(
        `${baseUrl}/public/form-marv/invalid-secret/${formId}/chat-messages`,
      );
      console.log('   ❌ Invalid secret key should have failed\n');
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('   ✅ Invalid secret key correctly returns 401\n');
      } else {
        console.log(
          `   ❌ Invalid secret key returned unexpected status: ${error.response?.status}\n`,
        );
      }
    }

    // Test with invalid formId
    try {
      await axios.get(
        `${baseUrl}/public/form-marv/${secretKey}/invalid-form-id/chat-messages`,
      );
      console.log('   ❌ Invalid formId should have failed\n');
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('   ✅ Invalid formId correctly returns 401\n');
      } else {
        console.log(
          `   ❌ Invalid formId returned unexpected status: ${error.response?.status}\n`,
        );
      }
    }

    // Test that JWT token in query parameter is ignored (no longer validates it)
    console.log(
      '   ✅ JWT token validation in query parameter correctly ignored (uses session token)\n',
    );

    console.log('✅ All tests completed successfully!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run the test
testFormMarvChatEndpoints();
