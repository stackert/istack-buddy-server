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
import { CustomLoggerService } from '../../../src/common/logger/custom-logger.service';

// Load environment variables from .env.live
dotenv.config({ path: '.env.live' });
process.env.NODE_ENV = 'test';

// Configuration - set to 'chunks' to see streaming chunks, 'messages' to see complete messages
const OUTPUT_MODE: 'chunks' | 'messages' = 'messages';

async function testStreaming() {
  // Create a silent logger
  const silentLogger = new CustomLoggerService('RobotChatOpenAI');
  silentLogger.debug = () => {};
  silentLogger.log = () => {};
  silentLogger.error = () => {};
  silentLogger.warn = () => {};
  silentLogger.verbose = () => {};

  // Temporarily redirect stdout to filter out ALL logs
  const originalStdout = process.stdout.write;
  process.stdout.write = (chunk: any, ...args: any[]) => {
    const message = chunk.toString();
    if (
      message.includes('[Nest]') ||
      message.includes('DEBUG') ||
      message.includes('MarvToolCall')
    ) {
      return true;
    }
    return originalStdout.call(process.stdout, chunk, ...args);
  };

  const robot = new RobotChatOpenAI();
  const messages: TConversationTextMessageEnvelope[] = [];

  // Message 1 (User)
  const message1: TConversationTextMessageEnvelope = {
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

  // Message 3 (User)
  const message3: TConversationTextMessageEnvelope = {
    messageId: '3',
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: '3',
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

  console.log('=== Conversation Flow ===');

  // First streaming call
  console.log('user> message 1');
  await robot.acceptMessageStreamResponse(message1, {
    onStreamStart: (message) => {
      if (true || OUTPUT_MODE === 'messages') {
        console.log(`robot> message 2 (response message 1) <-- stream open`);
        console.log(
          `Message 2: ${JSON.stringify(message.envelopePayload, null, 2)}`,
        );
      } else {
        console.log(`Stream started for message: ${message.messageId}`);
      }
    },
    onChunkReceived: (chunk) => {
      if (true || OUTPUT_MODE === 'chunks') {
        console.log(`chunk: ${chunk}`);
      }
    },
    onStreamFinished: (message) => {
      if (true || OUTPUT_MODE === 'messages') {
        console.log(`robot> message 2 (response message 1) <-- stream close`);
        console.log(
          `Message 2: ${JSON.stringify(message.envelopePayload, null, 2)}`,
        );
      } else {
        console.log(`Stream finished for message: ${message.messageId}`);
      }
      messages.push(message); // Store the complete response
    },
    onError: (error) => {
      console.error('Stream error:', error);
    },
  });

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
        messages[0]?.envelopePayload.content.payload || 'Response from robot',
      messageType: MessageType.TEXT,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Second streaming call with conversation history
  console.log('user> message 3');
  await robot.acceptMessageStreamResponse(
    message3,
    {
      onStreamStart: (message) => {
        if (true || OUTPUT_MODE === 'messages') {
          console.log(`robot> message 4 (response message 3) <-- stream open`);
          console.log(
            `Message 4: ${JSON.stringify(message.envelopePayload, null, 2)}`,
          );
        } else {
          console.log(`Stream started for message: ${message.messageId}`);
        }
      },
      onChunkReceived: (chunk) => {
        if (true || OUTPUT_MODE === 'chunks') {
          console.log(`chunk: ${chunk}`);
        }
      },
      onStreamFinished: (message) => {
        if (true || OUTPUT_MODE === 'messages') {
          console.log(`robot> message 4 (response message 3) <-- stream close`);
          console.log(
            `Message 4: ${JSON.stringify(message.envelopePayload, null, 2)}`,
          );
        } else {
          console.log(`Stream finished for message: ${message.messageId}`);
        }
        messages.push(message); // Store the complete response
      },
      onError: (error) => {
        console.error('Stream error:', error);
      },
    },
    () => conversationHistory,
  );
}

testStreaming().catch(console.error);
