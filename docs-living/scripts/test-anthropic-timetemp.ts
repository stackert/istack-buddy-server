import { config } from 'dotenv';
import { AnthropicTimeTemp } from '../src/robots/AnthropicTimeTemp';
import { IConversationMessage } from '../src/chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from '../src/ConversationLists/types';
import {
  UserRole,
  MessageType,
} from '../src/chat-manager/dto/create-message.dto';

// Load environment variables from .env.live file (real keys for development/production)
config({ path: '.env.live' });

async function testAnthropicTimeTemp() {
  console.log(`Testing AnthropicTimeTemp Robot Demo
===============================================

This demo will test different function call patterns:
1. Single function call
2. Serial function calls
3. Parallel function calls
4. Zero function calls

`);

  const robot = new AnthropicTimeTemp();

  // Test cases
  const testCases = [
    // {
    //   name: 'Single Function Call',
    //   message: 'What time is it in New York?',
    //   description: 'Should call getTime once',
    // },
    {
      name: 'Serial Function Calls',
      message:
        'Get the time in Tokyo and then get temperature in Tokyo. Join the responses together. Very IMPORTANT call one then call the other',
      description:
        'Should call getTime first, then getTemp (demonstrating serial pattern)',
    },
    // {
    //   name: 'Parallel Function Calls',
    //   message: 'What is the time in London and the temperature in Paris?',
    //   description:
    //     'Should call both getTime and getTemp in parallel (independent calls)',
    // },
    // {
    //   name: 'Zero Function Calls',
    //   message: 'Hello! How are you today?',
    //   description:
    //     'Should respond conversationally without calling any functions',
    // },
    // {
    //   name: 'Multiple Cities Parallel',
    //   message: 'Get the time in Sydney and temperature in Berlin',
    //   description:
    //     'Should call both functions in parallel for different cities',
    // },
  ];

  for (const testCase of testCases) {
    console.log(`\n${testCase.name}
${'='.repeat(testCase.name.length)}
Description: ${testCase.description}
User Message: "${testCase.message}"

Robot Response:`);

    try {
      // Create a message object
      const message: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-message-' + Date.now(),
        conversationId: 'test-conversation',
        content: {
          type: 'text/plain',
          payload: testCase.message,
        },
        authorUserId: 'test-user',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
        messageType: MessageType.TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Get immediate response
      const response = await robot.acceptMessageImmediateResponse(message);

      console.log(response.content.payload);
    } catch (error) {
      console.log(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    console.log('\n' + '-'.repeat(50));
  }

  console.log(`
Demo completed!

The robot should have demonstrated:
- Single function calls (getTime or getTemp)
- Serial function calls (getTime then getTemp)
- Parallel function calls (both functions called simultaneously)
- Zero function calls (conversational responses)

Each response should include explanations of the function call patterns used.
`);
}

// Check if ANTHROPIC_API_KEY is set
if (!process.env.ANTHROPIC_API_KEY) {
  console.log(`
Error: ANTHROPIC_API_KEY environment variable is not set.

Please add your Anthropic API key to the .env.live file:
ANTHROPIC_API_KEY=your-api-key-here

The .env.live file should be in the project root directory.
`);
  process.exit(1);
}

testAnthropicTimeTemp().catch((error) => {
  console.log(
    `Demo failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
  );
  process.exit(1);
});
