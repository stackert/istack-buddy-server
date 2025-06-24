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

  constructor() {}

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
