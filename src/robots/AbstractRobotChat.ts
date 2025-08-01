import { AbstractRobot } from './AbstractRobot';
import type { TConversationTextMessageEnvelope } from './types';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';

/**
 * Abstract chat robot class that extends the base robot functionality
 * with chat-specific capabilities
 */
export abstract class AbstractRobotChat extends AbstractRobot {
  // streaming response
  public abstract acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    callbacks: {
      onChunkReceived: (chunk: string) => void;
      onStreamStart?: (message: TConversationTextMessageEnvelope) => void;
      onStreamFinished?: (message: TConversationTextMessageEnvelope) => void;
      onError?: (error: any) => void;
    },
    getHistory?: () => IConversationMessage[],
  ): Promise<void>;

  // immediate response
  // immediate can be upto 120 seconds, perhaps more.
  // Some clients can't support streaming response.
  // so they will have to wait for completed response
  public abstract acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    getHistory?: () => IConversationMessage[],
  ): Promise<TConversationTextMessageEnvelope>;
}
