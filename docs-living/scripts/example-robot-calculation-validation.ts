#!/usr/bin/env ts-node

// Load environment variables from .env file (if it exists)
import * as dotenv from 'dotenv';
dotenv.config();

// Import robot and types
import { AnthropicMarv } from '../../src/robots/AnthropicMarv';
import type { TConversationTextMessageEnvelope } from '../../src/robots/types';
import { marvToolSet } from '../../src/robots/tool-definitions/marv';

console.log(`
Robot Conversation Flow Example
===============================

REQUIRED ENVIRONMENT SETUP:
  export CORE_FORMS_API_V2_KEY="your-formstack-api-key"
  export ANTHROPIC_API_KEY="your-anthropic-api-key"

  Current environment check:
  - CORE_FORMS_API_V2_KEY is set: ${!!process.env.CORE_FORMS_API_V2_KEY}
  - ANTHROPIC_API_KEY is set: ${!!process.env.ANTHROPIC_API_KEY}
`);

// Form ID to analyze
const FORM_ID = '6201623'; // Has calculation errors for good demonstration

/**
 * Create a message envelope for the robot
 */
function createUserMessage(content: string): TConversationTextMessageEnvelope {
  return {
    messageId: `msg-${Date.now()}`,
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: `payload-${Date.now()}`,
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: content,
      },
      created_at: new Date().toISOString(),
      estimated_token_count: Math.ceil(content.length / 4),
    },
  };
}

/**
 * Monkey patch the marvToolSet to show tool calls clearly
 */
function addDebugToToolSet() {
  const originalExecuteToolCall = marvToolSet.executeToolCall;

  marvToolSet.executeToolCall = async function (toolName: string, args: any) {
    console.log(`\n🔧 ROBOT CALLING TOOL:`);
    console.log(`   Tool: ${toolName}`);
    console.log(`   Parameters: ${JSON.stringify(args, null, 2)}`);

    try {
      const result = await originalExecuteToolCall.call(this, toolName, args);

      console.log(`✅ TOOL CALL SUCCESSFUL:`);
      console.log(`   Success: ${result.isSuccess}`);
      if (result.isSuccess && result.response) {
        console.log(
          `   Found ${result.response.logItems?.length || 0} log items`,
        );
        console.log(`   Issues detected: ${result.response.isObservationTrue}`);
      }

      return result;
    } catch (error) {
      console.log(`❌ TOOL CALL FAILED:`);
      console.log(
        `   Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  };
}

/**
 * Monkey patch the robot to clean up tool result formatting
 */
function cleanupRobotToolResults(robot: AnthropicMarv) {
  // Access the private executeToolCall method
  const originalExecuteToolCall = (robot as any).executeToolCall;

  (robot as any).executeToolCall = async function (
    toolName: string,
    toolArgs: any,
  ) {
    try {
      // Call the original marvToolSet.executeToolCall
      const result = await marvToolSet.executeToolCall(toolName, toolArgs);

      // Format the result cleanly instead of dumping JSON
      if (result.isSuccess) {
        if (result.response && result.response.logItems) {
          const logItems = result.response.logItems;
          const issuesFound = result.response.isObservationTrue;

          // Create a clean summary
          let summary = `✅ ${toolName} completed successfully\n\n`;
          summary += `Analysis Summary:\n`;
          summary += `- Issues detected: ${issuesFound}\n`;
          summary += `- Total findings: ${logItems.length}\n`;

          if (issuesFound && logItems.length > 0) {
            summary += `\nKey Issues Found:\n`;
            // Show only the first few important issues
            const importantIssues = logItems.slice(0, 3);
            importantIssues.forEach((item: any, index: number) => {
              summary += `${index + 1}. ${item.messageSecondary}\n`;
            });

            if (logItems.length > 3) {
              summary += `... and ${logItems.length - 3} more issues\n`;
            }
          }

          return summary;
        } else {
          return `✅ ${toolName} completed successfully\n\nOperation completed with no detailed results.`;
        }
      } else {
        return `❌ ${toolName} failed\n\nErrors: ${result.errorItems?.join(', ') || 'Unknown error'}`;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return `❌ Error executing ${toolName}: ${errorMessage}`;
    }
  };
}

/**
 * Simple conversation example
 */
async function showConversationFlow() {
  console.log(`\n🚀 STARTING CONVERSATION FLOW EXAMPLE\n`);

  try {
    // Add debug logging to tool set
    addDebugToToolSet();

    // Create the robot instance
    const robot = new AnthropicMarv();

    // Clean up robot tool result formatting
    cleanupRobotToolResults(robot);

    // Create user message
    const userMessage = createUserMessage(
      `Please validate calculations for form ${FORM_ID} and tell me what issues you find.`,
    );

    console.log(`📤 USER SAYS TO ROBOT:`);
    console.log(`   "${userMessage.envelopePayload.content.payload}"`);
    console.log(`\n🤖 ROBOT PROCESSING...`);

    // Track the robot's response
    let robotResponse = '';

    // Send message with streaming to capture the response
    await robot.acceptMessageStreamResponse(userMessage, (chunk: string) => {
      robotResponse += chunk;
    });

    console.log(`\n🗣️  ROBOT RESPONDS TO USER:`);
    console.log(
      `═══════════════════════════════════════════════════════════════════════════════`,
    );
    console.log(robotResponse);
    console.log(
      `═══════════════════════════════════════════════════════════════════════════════`,
    );

    console.log(`\n✅ CONVERSATION FLOW COMPLETE!`);
    console.log(`\nSUMMARY OF WHAT HAPPENED:`);
    console.log(`1. User asked robot to validate form calculations`);
    console.log(`2. Robot decided to call formCalculationValidation tool`);
    console.log(`3. Tool made API call to Formstack and analyzed results`);
    console.log(
      `4. Robot received tool results and formatted response for user`,
    );
  } catch (error) {
    console.error(
      `\n❌ ERROR IN CONVERSATION: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    console.error(
      `\nThis error is expected if you don't have proper API credentials.`,
    );
  }
}

/**
 * Main execution function
 */
async function main() {
  // Check if we have the required environment variables
  if (!process.env.CORE_FORMS_API_V2_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.log(`\n⚠️  MISSING REQUIRED ENVIRONMENT VARIABLES!`);
    console.log(`\nTo run this example, you need:`);
    console.log(`1. CORE_FORMS_API_V2_KEY - Your Formstack API key`);
    console.log(`2. ANTHROPIC_API_KEY - Your Anthropic API key`);
    console.log(`\nSet them with:`);
    console.log(`  export CORE_FORMS_API_V2_KEY="your-formstack-key"`);
    console.log(`  export ANTHROPIC_API_KEY="your-anthropic-key"`);
    return;
  }

  await showConversationFlow();
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { showConversationFlow };
