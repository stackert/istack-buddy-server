import { AbstractRobot } from './AbstractRobot';
import type {
  IStreamingCallbacks,
  TConversationMessageContentString,
} from './types';
import type {
  IConversationMessage,
  IConversationMessageAnthropic,
} from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import type { IntentData } from '../common/types/intent-parsing.types';

/**
 * Abstract chat robot class that extends the base robot functionality
 * with chat-specific capabilities
 */
export abstract class AbstractRobotChat extends AbstractRobot {
  // streaming response
  public abstract acceptMessageStreamResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<void>;

  // immediate response
  // immediate can be upto 120 seconds, perhaps more.
  // Some clients can't support streaming response.
  // so they will have to wait for completed response
  public abstract acceptMessageImmediateResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<
    Pick<IConversationMessage<TConversationMessageContentString>, 'content'>
  >;

  // NEW universal method for intent-based processing
  // ChatManager ONLY calls this method (not acceptMessage* methods)
  public abstract handleIntentWithTools(
    intentData: IntentData,
    message: IConversationMessage<TConversationMessageContentString>,
    callbacks: IStreamingCallbacks
  ): Promise<void>;

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
