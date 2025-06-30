import type { TMessageEnvelope, TRobotMessage } from './types';
import { AbstractRobotChat } from './AbstractRobotChat';

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
    messageEnvelope: TMessageEnvelope,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.envelopePayload;
    const respMessage: TRobotMessage = { ...recvMessage };
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.content.payload = `(${randomNumber}) ${recvMessage.content.payload}`;

    const responseEnvelope: TMessageEnvelope = {
      messageId: `response-${Date.now()}`,
      envelopePayload: respMessage,
    };

    return Promise.resolve(responseEnvelope);
  }

  // streaming response
  public acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    // For chat robots, we can implement multipart by using the immediate response
    // and then potentially sending additional responses via callback
    const immediateResponse =
      this.acceptMessageImmediateResponse(messageEnvelope);

    // Optionally send delayed additional responses
    setTimeout(() => {
      const delayedRespMessage: TRobotMessage = {
        ...messageEnvelope.envelopePayload,
        content: {
          type: 'text/plain',
          payload: `Follow-up chat response for: ${messageEnvelope.envelopePayload.content.payload}`,
        },
        author_role: 'assistant',
        created_at: new Date().toISOString(),
      };

      const delayedMessage: TMessageEnvelope = {
        messageId: `response-${Date.now()}-delayed`,
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
    messageEnvelope: TMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    const recvMessage: TRobotMessage = messageEnvelope.envelopePayload;

    const randomNumber = Math.floor(Math.random() * 10000);
    const response = `(${randomNumber}) ${recvMessage.content.payload}`;

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
            chunkCallback(chunks[chunkIndex]);
            chunkIndex++;
          } else {
            // Send null after all chunks are sent
            chunkCallback(null as any);
            clearInterval(interval);
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
