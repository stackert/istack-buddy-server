import { AbstractRobotChat } from './AbstractRobotChat';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContent } from '../ConversationLists/types';

// Helper functions for the streaming pattern
const noOp = (...args: any[]) => {};

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
    - Debugging message structures
    - Basic conversational flow testing without AI costs
    
    The robot supports both immediate responses and streaming responses, breaking messages into 
    chunks for streaming demonstration purposes.
  `;

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  public acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  > {
    const randomNumber = Math.floor(Math.random() * 10000);

    return Promise.resolve({
      content: {
        type: 'text/plain',
        payload: `(${randomNumber}) ${message.content.payload}`,
      },
    });
  }

  // streaming response
  public async acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<TConversationMessageContentString> {
    // For chat robots, we can implement multipart by using the immediate response
    // and then potentially sending additional responses via callback
    const immediateResponse =
      await this.acceptMessageImmediateResponse(message);

    // Optionally send delayed additional responses
    setTimeout(() => {
      const delayedMessage: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      > = {
        content: {
          type: 'text/plain',
          payload: `Follow-up chat response for: ${message.content.payload}`,
        },
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(delayedMessage);
      }
    }, 300);

    return immediateResponse.content;
  }

  public acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<void> {
    const randomNumber = Math.floor(Math.random() * 10000);
    const response = `(${randomNumber}) ${message.content.payload}`;

    // Call onStreamStart if provided
    if (typeof callbacks.onStreamStart === 'function') {
      callbacks.onStreamStart(message);
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
              callbacks.onStreamFinished(message);
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
