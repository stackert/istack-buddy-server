import { AbstractRobot } from './AbstractRobot';
import type {
  TConversationTextMessageEnvelope,
  TRobotResponseEnvelope,
  IStreamingCallbacks,
} from './types';
import type {
  IConversationMessage,
  IConversationMessageAnthropic,
} from '../chat-manager/interfaces/message.interface';
import { UserRole } from '../chat-manager/dto/create-message.dto';

/**
 * Abstract chat robot class that extends the base robot functionality
 * with chat-specific capabilities
 */
export abstract class AbstractRobotChat extends AbstractRobot {
  // streaming response
  public abstract acceptMessageStreamResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage[],
  ): Promise<void>;

  // immediate response
  // immediate can be upto 120 seconds, perhaps more.
  // Some clients can't support streaming response.
  // so they will have to wait for completed response
  public abstract acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    getHistory?: () => IConversationMessage[],
  ): Promise<TRobotResponseEnvelope>;

  /**
   * Override the transformer to use Anthropic format for all chat robots
   */
  public getGetFromRobotToConversationTransformer(): (
    msg: IConversationMessage,
  ) => IConversationMessageAnthropic {
    return (msg) => ({
      role:
        msg.fromRole === UserRole.CUSTOMER || msg.fromRole === UserRole.AGENT
          ? 'user'
          : 'assistant',
      content: (msg.content as any).payload,
    });
  }
}
