import * as dotenv from 'dotenv';
import { RobotChatOpenAI } from '../../../src/robots/RobotChatOpenAI';
import {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
} from '../../../src/robots/types';
import {
  UserRole,
  MessageType,
} from '../../../src/chat-manager/dto/create-message.dto';
import { IConversationMessage } from '../../../src/chat-manager/interfaces/message.interface';

// Load environment variables from .env.live
dotenv.config({ path: '.env.live' });
const writeChunk = (chunk: string) => {
  process.stdout.write(`${chunk}`);
  // console.log(`${chunk}`);
};

async function testStreaming() {
  // Create a silent logger

  const robot = new RobotChatOpenAI();

  // First message
  const firstMessage: TConversationTextMessageEnvelope = {
    messageId: '1',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: '1',
      author_role: 'cx-customer',
      content: {
        type: 'text/plain',
        payload:
          'we are testing/debugging. Return a random number and a thought of the day',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 0,
    },
  };

  // Second message
  const secondMessage: TConversationTextMessageEnvelope = {
    messageId: '2',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: '2',
      author_role: 'cx-customer',
      content: {
        type: 'text/plain',
        payload:
          'Please use the fsRestrictedApiFormAndRelatedEntityOverview tool to get information about form 12345',
      },
      created_at: new Date().toISOString(),
      estimated_token_count: 0,
    },
  };

  // First streaming call
  // console.log('=== First Message ===');
  await robot.acceptMessageStreamResponse(firstMessage, writeChunk);

  // Build conversation history for second call
  const conversationHistory: IConversationMessage[] = [
    {
      id: '1',
      conversationId: 'test-conversation',
      fromUserId: 'test-user',
      fromRole: UserRole.CUSTOMER,
      toRole: UserRole.ROBOT,
      content:
        'we are testing/debugging. Return a random number and a thought of the day',
      messageType: MessageType.TEXT,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      conversationId: 'test-conversation',
      fromUserId: 'test-robot',
      fromRole: UserRole.ROBOT,
      toRole: UserRole.CUSTOMER,
      content:
        'Here is a random number: 42. And here is a thought of the day: The best time to plant a tree was 20 years ago. The second best time is now.',
      messageType: MessageType.TEXT,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Second streaming call with conversation history
  // console.log('\n=== Second Message ===');
  await robot.acceptMessageStreamResponse(
    secondMessage,
    writeChunk,
    () => conversationHistory,
  );
}

testStreaming().catch(console.error);
