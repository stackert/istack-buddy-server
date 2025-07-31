import type { TConversationTextMessageEnvelope } from './types';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';
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
   * @param messageEnvelope
   * @param delayedMessageCallback
   * @description `messageEnvelope` will have properties
   * will have the shape of
   * {
   *   messageId: string;
   *   author_role: string
   *   content: any
   *   created_at: string
   * }
   *
   * By convention, 'acceptMessage*' functions will return the envelop replacing
   * author_role, content, created_at
   */
  public abstract acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
    getHistory?: () => IConversationMessage[],
  ): Promise<TConversationTextMessageEnvelope>;

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
}
