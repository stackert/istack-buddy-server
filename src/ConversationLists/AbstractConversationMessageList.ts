import { v4 as uuidv4 } from 'uuid';
import type {
  TConversationMessageEnvelope,
  TConversationMixedMessageEnvelope,
} from './types';

// Container type that wraps envelopes with metadata
type TEnvelopeContainer<
  T extends TConversationMessageEnvelope = TConversationMessageEnvelope,
> = {
  envelopeId: string;
  addedAtMs: number;
  envelope: T;
};

/**
 * Abstract class for managing conversation message envelopes
 * Supports mixed content types through generic typing
 *
 * @template T - The message envelope type, defaults to support mixed content
 */
class AbstractConversationMessageList<
  T extends TConversationMessageEnvelope = TConversationMixedMessageEnvelope,
> {
  private _messages: Record<string, TEnvelopeContainer<T>> = {};

  constructor() {}

  /**
   * Add a message envelope to the list
   * @param messageEnvelope - The message envelope to add
   * @returns The unique ID assigned to the envelope
   */
  public addMessageEnvelope(messageEnvelope: T): string {
    const uniqueMessageEnvelopeId = this.getUniqueMessageEnvelopeId();
    this._messages[uniqueMessageEnvelopeId] = {
      envelopeId: uniqueMessageEnvelopeId,
      addedAtMs: Date.now(),
      envelope: messageEnvelope,
    };
    return uniqueMessageEnvelopeId;
  }

  /**
   * Get all message envelopes sorted by most recent first
   * @returns Array of envelope containers sorted by addedAtMs (descending)
   */
  public getLastAddedEnvelopes(): TEnvelopeContainer<T>[] {
    return Object.values(this._messages).sort(
      (a, b) => b.addedAtMs - a.addedAtMs,
    );
  }

  /**
   * Get the first (oldest) added envelope
   * @returns The envelope container with the earliest addedAtMs timestamp
   */
  public getFirstAddedEnvelope(): TEnvelopeContainer<T> {
    return Object.values(this._messages).sort(
      (a, b) => a.addedAtMs - b.addedAtMs,
    )[0];
  }

  /**
   * Get a specific message envelope by its ID
   * @param messageEnvelopeId - The unique ID of the envelope
   * @returns The envelope container or undefined if not found
   */
  public getMessageEnvelopeById(
    messageEnvelopeId: string,
  ): TEnvelopeContainer<T> | undefined {
    return this._messages[messageEnvelopeId];
  }

  /**
   * Get the count of message envelopes
   * @returns Number of envelopes in the list
   */
  public getMessageCount(): number {
    return Object.keys(this._messages).length;
  }

  /**
   * Check if a message envelope exists
   * @param messageEnvelopeId - The unique ID to check
   * @returns True if the envelope exists, false otherwise
   */
  public hasMessageEnvelope(messageEnvelopeId: string): boolean {
    return messageEnvelopeId in this._messages;
  }

  /**
   * Remove a message envelope by ID
   * @param messageEnvelopeId - The unique ID of the envelope to remove
   * @returns True if the envelope was removed, false if it didn't exist
   */
  public removeMessageEnvelope(messageEnvelopeId: string): boolean {
    if (this.hasMessageEnvelope(messageEnvelopeId)) {
      delete this._messages[messageEnvelopeId];
      return true;
    }
    return false;
  }

  /**
   * Get all message envelope IDs
   * @returns Array of all envelope IDs
   */
  public getAllMessageEnvelopeIds(): string[] {
    return Object.keys(this._messages);
  }

  /**
   * Clear all message envelopes
   */
  public clearAllMessages(): void {
    this._messages = {};
  }

  /**
   * Generate a unique message envelope ID
   * @returns A unique UUID string
   */
  private getUniqueMessageEnvelopeId(): string {
    return uuidv4();
  }
}

export { AbstractConversationMessageList };
export type { TEnvelopeContainer };
