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

async function debugToolCalls() {
  console.log(`Debug Tool Calls
===============

This will help us understand what's happening with the tool calls.

`);

  const robot = new AnthropicTimeTemp();

  const message: IConversationMessage<TConversationMessageContentString> = {
    id: 'test-message-' + Date.now(),
    conversationId: 'test-conversation',
    content: {
      type: 'text/plain',
      payload: 'Get the time in Tokyo, then get the temperature in Tokyo.',
    },
    authorUserId: 'test-user',
    fromRole: UserRole.CUSTOMER,
    toRole: UserRole.AGENT,
    messageType: MessageType.TEXT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    // Let's access the private method for debugging
    const client = (robot as any).getClient();
    const request = (robot as any).createAnthropicMessageRequest(message);

    console.log('Request being sent to Anthropic:');
    console.log(JSON.stringify(request, null, 2));

    const response = await client.messages.create({
      ...request,
      stream: false,
    });

    console.log('\nResponse from Anthropic:');
    console.log('Stop reason:', response.stop_reason);
    console.log('Content length:', response.content.length);

    for (let i = 0; i < response.content.length; i++) {
      const content = response.content[i];
      console.log(`\nContent ${i}:`);
      console.log('Type:', content.type);
      if (content.type === 'text') {
        console.log('Text:', content.text);
      } else if (content.type === 'tool_use') {
        console.log('Tool name:', content.name);
        console.log('Tool input:', content.input);
      }
    }
  } catch (error) {
    console.log(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
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

debugToolCalls().catch((error) => {
  console.log(
    `Debug failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
  );
  process.exit(1);
});
