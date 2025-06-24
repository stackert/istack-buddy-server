import { AbstractRobotAgent } from './AbstractRobotAgent';
import { TMessageEnvelope, TRobotMessage } from './types';

/**
 * A concrete agent robot that parrots (repeats) task descriptions as it executes them
 */
export class AgentRobotParrot extends AbstractRobotAgent {
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

  public acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message;
    const respMessage: TRobotMessage = { ...recvMessage };
    messageEnvelope.message = respMessage;
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.message = `(${randomNumber}) ${recvMessage.message}`;

    setTimeout(() => {
      respMessage.message = `(${randomNumber}) - complete: ${recvMessage.message}`;
      delayedMessageCallback(messageEnvelope);
    }, 500);

    return Promise.resolve(messageEnvelope);
  }
}
