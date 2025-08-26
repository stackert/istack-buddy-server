#!/usr/bin/env ts-node

/**
 * Test Marv Session Creator (No Slack Required) - TypeScript Version
 * 
 * This script creates a marv-session directly without going through Slack,
 * allowing you to test the form-marv functionality independently.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration - adjust these as needed
const BASE_URL = process.env.BASE_URL || 'http://localhost:3500';

interface SessionData {
  sessionId: string;
  jwtToken: string;
  formId: string;
  sessionUrl: string;
}

/**
 * Create a temporary session using the debug-create endpoint
 */
async function createMarvSession(formId: string): Promise<SessionData> {
  try {
    console.log(`Creating Marv Session for testing - Form ID: ${formId}, Base URL: ${BASE_URL} - Using debug-create endpoint...`);
    const createResponse = await axios.get(`${BASE_URL}/public/form-marv/debug-create?formId=${formId}`);
    
    if (createResponse.data) {
      // Extract session info from HTML response
      const html = createResponse.data;
      const linkMatch = html.match(/href="([^"]+)"/);
      
      if (linkMatch) {
        const fullUrl = linkMatch[1];
        const urlParts = fullUrl.split('/');
        const sessionId = urlParts[urlParts.length - 3];
        const extractedFormId = urlParts[urlParts.length - 2];
        const jwtTokenMatch = fullUrl.match(/jwtToken=([^&]+)/);
        const jwtToken = jwtTokenMatch ? jwtTokenMatch[1] : '';
        
        console.log(`Session created successfully - Session ID: ${sessionId}, JWT Token: ${jwtToken.substring(0, 20)}..., Form ID: ${extractedFormId} - Frontend Link: ${fullUrl}`);
        
        return {
          sessionId,
          jwtToken,
          formId: extractedFormId,
          sessionUrl: fullUrl
        };
      } else {
        throw new Error('Could not extract session link from debug-create response');
      }
    } else {
      throw new Error('Empty response from debug-create endpoint');
    }
    
  } catch (error: any) {
    console.error(`Error creating session: ${error.message}`);
    if (error.response) {
      console.error(`Response Status: ${error.response.status}, Data:`, error.response.data);
    }
    console.error(`Debug info - Base URL: ${BASE_URL}, Form ID: ${formId}`);
    
    process.exit(1);
  }
}

/**
 * Test the session by making API calls to verify it works
 */
async function testSession(sessionData: SessionData): Promise<void> {
  try {
    console.log('Testing session...');
    const { sessionId, formId, jwtToken } = sessionData;
    
    // Test getting chat messages (should return empty array initially)
    const messagesResponse = await axios.get(
      `${BASE_URL}/public/form-marv/${sessionId}/${formId}/chat-messages`,
      {
        headers: {
          'Cookie': `jwtToken=${jwtToken}`
        }
      }
    );
    
    if (Array.isArray(messagesResponse.data)) {
      console.log(`Chat messages endpoint working (${messagesResponse.data.length} messages)`);
    }
    
    // Test posting a message to trigger the robot
    const testMessage = {
      content: "Hello, can you help me understand this form structure?"
    };
    
    const postResponse = await axios.post(
      `${BASE_URL}/public/form-marv/${sessionId}/${formId}/chat-messages`,
      testMessage,
      {
        headers: {
          'Cookie': `jwtToken=${jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (postResponse.data && postResponse.data.success) {
      console.log(`Message posting working (Message ID: ${postResponse.data.messageId}) - Robot response should be generated automatically`);
    }
    
    // Test form JSON endpoint
    try {
      const formJsonResponse = await axios.get(
        `${BASE_URL}/public/form-marv/${sessionId}/${formId}/formJson`,
        {
          headers: {
            'Cookie': `jwtToken=${jwtToken}`
          }
        }
      );
      
      if (formJsonResponse.data) {
        console.log(`Form JSON endpoint working (Form has ${Object.keys(formJsonResponse.data).length} properties)`);
      }
    } catch (formError: any) {
      console.log(`Form JSON endpoint had issues: ${formError.message}`);
    }
    
    console.log('Session is working correctly!');
    
  } catch (error: any) {
    console.log(`Session testing had issues: ${error.message} - But the session URL should still work in your browser.`);
  }
}

/**
 * Check session debug info
 */
async function checkSessionDebugInfo(sessionData: SessionData): Promise<void> {
  try {
    console.log('Checking session debug info...');
    const { sessionId } = sessionData;
    
    const debugResponse = await axios.get(
      `${BASE_URL}/public/form-marv/${sessionId}/debug-session`
    );
    
    if (debugResponse.data) {
      console.log(`Session Debug Info - Secret Key: ${debugResponse.data.secretKey}, Created At: ${debugResponse.data.sessionData?.createdAt}, Expires In: ${debugResponse.data.sessionData?.expiresInMs}ms`);
    }
    
  } catch (error: any) {
    console.log(`Debug info unavailable: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('MARV SESSION TESTER (NO SLACK REQUIRED)');
  
  // Get form ID from command line argument - required
  const formId = process.argv[2];
  
  if (!formId) {
    console.error('Error: Form ID is required - Usage: npx ts-node docs-living/scripts/test-marv-session-without-slack.ts <FORM_ID> - Example: npx ts-node docs-living/scripts/test-marv-session-without-slack.ts 6201623');
    process.exit(1);
  }
  
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npx ts-node docs-living/scripts/test-marv-session-without-slack.ts <FORM_ID> - Environment Variables: BASE_URL - Server URL (default: http://localhost:3500) - Examples: npx ts-node docs-living/scripts/test-marv-session-without-slack.ts 6201623 OR BASE_URL=http://localhost:3500 npx ts-node docs-living/scripts/test-marv-session-without-slack.ts 5375703');
    return;
  }
  
  const sessionData = await createMarvSession(formId);
  await testSession(sessionData);
  await checkSessionDebugInfo(sessionData);
  
  console.log('READY FOR TESTING! Open the link above in your browser to start testing. The session will remain active for several hours.');
}

main().catch(error => {
  console.error(`Script failed: ${error.message}`);
  process.exit(1);
});

export { createMarvSession, testSession };
