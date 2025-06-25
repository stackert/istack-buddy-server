import type { TMessageEnvelope } from './types';
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

  public abstract acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope>;

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
