import type { TMessageEnvelope, TRobotMessage } from './types';
import { AbstractRobotChat } from './AbstractRobotChat';

/**
 * A concrete chat robot that parrots (repeats) messages back to the user
 */
export class ChatRobotParrot extends AbstractRobotChat {
  public readonly name: string = 'AgentRobotParrot';
  public readonly version: string = '1.0.0';

  public readonly LLModelName: string = 'openAi.4.3';
  public readonly LLModelVersion: string = '4.3';

  public acceptMessageImmediateResponse(
    messageEnvelope: TMessageEnvelope,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message;
    const respMessage: TRobotMessage = { ...recvMessage };
    messageEnvelope.message = respMessage;
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.message = `(${randomNumber}) ${recvMessage.message}`;

    return Promise.resolve(messageEnvelope);
  }

  // streaming response
  public acceptMessageStreamResponse(
    messageEnvelope: TMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    const recvMessage: TRobotMessage = messageEnvelope.message;

    const randomNumber = Math.floor(Math.random() * 10000);
    const response = `(${randomNumber}) ${recvMessage.message}`;

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
