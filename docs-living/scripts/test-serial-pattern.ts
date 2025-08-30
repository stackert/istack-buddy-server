import { config } from 'dotenv';
import { AnthropicTimeTemp } from '../src/robots/AnthropicTimeTemp';
import { IConversationMessage } from '../src/chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from '../src/ConversationLists/types';
import {
  UserRole,
  MessageType,
} from '../src/chat-manager/dto/create-message.dto';

// Load environment variables from .env.live file
config({ path: '.env.live' });

async function testSerialPattern() {
  console.log(`Testing Serial Pattern Debug
=====================================

This test will help us understand why the serial pattern isn't completing.

`);

  const robot = new AnthropicTimeTemp();

  // Test with a very explicit prompt
  const testCases = [
    {
      name: 'Explicit Serial Test',
      message:
        'Call getTime for Tokyo, then call getTemp for Tokyo. You must call both functions.',
    },
    {
      name: 'Simple Two Functions',
      message: 'Get the time in Tokyo and the temperature in Tokyo.',
    },
    {
      name: 'Direct Command',
      message: 'Use getTime for Tokyo. Then use getTemp for Tokyo.',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n${testCase.name}
${'='.repeat(testCase.name.length)}
User Message: "${testCase.message}"

Robot Response:`);

    try {
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

      const response = await robot.acceptMessageImmediateResponse(message);

      console.log(response.content.payload);
    } catch (error) {
      console.log(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    console.log('\n' + '-'.repeat(50));
  }
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

testSerialPattern().catch((error) => {
  console.log(
    `Debug test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
  );
  process.exit(1);
});
