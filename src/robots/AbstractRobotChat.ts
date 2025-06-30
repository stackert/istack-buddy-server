import { AbstractRobot } from './AbstractRobot';
import type { TConversationTextMessageEnvelope } from './types';

/**
 * Abstract chat robot class that extends the base robot functionality
 * with chat-specific capabilities
 */
export abstract class AbstractRobotChat extends AbstractRobot {
  // streaming response
  public abstract acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void>;

  // immediate response
  // immediate can be upto 120 seconds, perhaps more.
  // Some clients can't support streaming response.
  // so they will have to wait for completed response
  public abstract acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope>;
}
