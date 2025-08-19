import type { TConversationMessageContentString } from './types';
import type {
  IConversationMessage,
  IConversationMessageOpenAI,
} from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContent } from '../ConversationLists/types';
import { UserRole } from '../chat-manager/dto/create-message.dto';
/**
 * Abstract base class for all robot types
 */
export abstract class AbstractRobot {
  abstract readonly contextWindowSizeInTokens: number; //
  abstract readonly LLModelName: string; // 'openAi.4.3'; // real mode name(s) please
  abstract readonly LLModelVersion: string; // '4.3'; // real mode name(s) please

  abstract readonly name: string;
  abstract readonly version: string;

  // not really sure best way to do this so
  // we are going to use member hiding
  static descriptionShort = `
  
    This is an abstract robot class.  We should not see this description because 
    implementations should override this description.
    (short description)
  
  `; // 1-2 sentences
  static descriptionLong = `

    This is an abstract robot class.  We should not see this description because 
    implementations should override this description.
    (long description)
  
  `; // 1-2 paragraphs

  constructor() {}

  /**
   *
   * @param message
   * @param delayedMessageCallback
   * @description `message` will have the shape of IConversationMessage<TConversationMessageContentString>
   * with properties like id, conversationId, content, fromRole, etc.
   *
   * By convention, 'acceptMessage*' functions will return the content portion
   * since we can't generate message IDs
   */
  public abstract acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<TConversationMessageContentString>;

  get robotClass(): string {
    return this.constructor.name;
  }

  /**
   * Get the robot's name
   */
  public getName(): string {
    return this.name;
  }

  abstract estimateTokens(message: string): number;

  /**
   * Get the robot's version
   */
  public getVersion(): string {
    return this.version;
  }

  /**
   * Get the transformer function to convert conversation messages to the format expected by this robot
   * Default implementation uses OpenAI format, can be overridden by specific robot implementations
   */
  public getGetFromRobotToConversationTransformer(): (
    msg: IConversationMessage,
  ) => IConversationMessageOpenAI {
    return (msg) => ({
      role:
        msg.fromRole === UserRole.CUSTOMER || msg.fromRole === UserRole.AGENT
          ? 'user'
          : 'assistant',
      content: (msg.content as any).payload,
    });
  }
}
