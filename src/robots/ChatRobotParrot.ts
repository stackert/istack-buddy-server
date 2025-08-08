import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  IStreamingCallbacks,
} from './types';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';

// Helper functions for the streaming pattern
const noOp = (...args: any[]) => {};

// Factory for creating message envelope with updated content
const createMessageEnvelopeWithContent = (
  originalEnvelope: TConversationTextMessageEnvelope,
  newContent: string,
): TConversationTextMessageEnvelope => ({
  ...originalEnvelope,
  envelopePayload: {
    ...originalEnvelope.envelopePayload,
    content: {
      ...originalEnvelope.envelopePayload.content,
      payload: newContent,
    },
  },
});

/**
 * A concrete chat robot that parrots (repeats) messages back to the user
 */
export class ChatRobotParrot extends AbstractRobotChat {
  public readonly name: string = 'ChatRobotParrot';
  public readonly version: string = '1.0.0';

  public readonly LLModelName: string = 'openAi.4.3';
  public readonly LLModelVersion: string = '4.3';

  public readonly contextWindowSizeInTokens: number = 4096;

  static descriptionShort = `
    A simple chat robot that repeats messages back to the user with a random number prefix.
    Perfect for testing chat functionality and message flow.
  `;

  static descriptionLong = `
    ChatRobotParrot is a testing and demonstration robot that implements both immediate and streaming 
    response patterns. It takes any incoming message and parrots it back with a random number prefix.
    
    This robot is ideal for:
    - Testing chat interfaces and message handling
    - Demonstrating streaming vs immediate response patterns  
    - Debugging message envelope structures
    - Basic conversational flow testing without AI costs
    
    The robot supports both immediate responses and streaming responses, breaking messages into 
    chunks for streaming demonstration purposes.
  `;

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  public acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    const recvMessage: TConversationTextMessage =
      messageEnvelope.envelopePayload;
    const respMessage: TConversationTextMessage = {
      ...recvMessage,
      messageId: '', // Will be set by conversation manager
    };
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.content.payload = `(${randomNumber}) ${recvMessage.content.payload}`;

    const responseEnvelope: TConversationTextMessageEnvelope = {
      messageId: '', // Will be set by conversation manager
      requestOrResponse: 'response',
      envelopePayload: respMessage,
    };

    return Promise.resolve(responseEnvelope);
  }

  // streaming response
  public acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
    getHistory?: () => IConversationMessage[],
  ): Promise<TConversationTextMessageEnvelope> {
    // For chat robots, we can implement multipart by using the immediate response
    // and then potentially sending additional responses via callback
    const immediateResponse =
      this.acceptMessageImmediateResponse(messageEnvelope);

    // Optionally send delayed additional responses
    setTimeout(() => {
      const delayedRespMessage: TConversationTextMessage = {
        ...messageEnvelope.envelopePayload,
        messageId: '', // Will be set by conversation manager
        content: {
          type: 'text/plain',
          payload: `Follow-up chat response for: ${messageEnvelope.envelopePayload.content.payload}`,
        },
        author_role: 'assistant',
        created_at: new Date().toISOString(),
      };

      const delayedMessage: TConversationTextMessageEnvelope = {
        messageId: '', // Will be set by conversation manager
        requestOrResponse: 'response',
        envelopePayload: delayedRespMessage,
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(delayedMessage);
      }
    }, 300);

    return immediateResponse;
  }

  public acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    const recvMessage: TConversationTextMessage =
      messageEnvelope.envelopePayload;

    const randomNumber = Math.floor(Math.random() * 10000);
    const response = `(${randomNumber}) ${recvMessage.content.payload}`;

    // Call onStreamStart if provided
    if (typeof callbacks.onStreamStart === 'function') {
      callbacks.onStreamStart(messageEnvelope);
    }

    // Break response into 5 chunks of similar size
    const chunkSize = Math.ceil(response.length / 5);
    const chunks: string[] = [];

    for (let i = 0; i < response.length; i += chunkSize) {
      chunks.push(response.slice(i, i + chunkSize));
    }

    return new Promise<void>((resolve) => {
      let chunkIndex = 0;

      const interval = setInterval(() => {
        try {
          if (chunkIndex < chunks.length) {
            if (typeof callbacks.onStreamChunkReceived === 'function') {
              callbacks.onStreamChunkReceived(chunks[chunkIndex]);
            }
            chunkIndex++;
          } else {
            clearInterval(interval);

            // Call onStreamFinished with minimal data
            if (typeof callbacks.onStreamFinished === 'function') {
              callbacks.onStreamFinished(response, 'assistant');
            }
            resolve();
          }
        } catch (error) {
          // Continue even if callback throws an error
          if (chunkIndex < chunks.length) {
            chunkIndex++;
          } else {
            clearInterval(interval);
            resolve();
          }
        }
      }, 500);
    });
  }
}
