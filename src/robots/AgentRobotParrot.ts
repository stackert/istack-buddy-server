import { AbstractRobotAgent } from './AbstractRobotAgent';
import type { TConversationMessageContentString } from './types';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContent } from '../ConversationLists/types';

/**
 * A concrete agent robot that parrots (repeats) task descriptions as it executes them
 */
export class AgentRobotParrot extends AbstractRobotAgent {
  public readonly name: string = 'AgentRobotParrot';
  public readonly version: string = '1.0.0';
  public readonly LLModelName: string = 'openAi.4.3';
  public readonly LLModelVersion: string = '4.3';

  public readonly contextWindowSizeInTokens: number = 4096;

  static descriptionShort = `
    An agent robot that parrots task descriptions and provides delayed multi-part responses.
    Useful for testing autonomous agent workflows and task execution patterns.
  `;

  static descriptionLong = `
    AgentRobotParrot is a testing and demonstration robot that implements the multi-part response 
    pattern typical of autonomous agents. It accepts tasks, provides immediate acknowledgment, 
    and then delivers delayed completion responses.
    
    This robot is ideal for:
    - Testing autonomous agent workflows and task delegation
    - Demonstrating multi-part response patterns with callbacks
    - Simulating long-running tasks with progress updates
    - Testing agent coordination and task management systems
    - Debugging delayed response handling without AI processing overhead
    
    The robot provides both immediate responses and delayed callbacks, simulating the behavior
    of agents that need time to complete complex tasks or coordinate with external systems.  
  `;

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  public acceptMessageMultiPartResponse(
    message: IConversationMessage<TConversationMessageContentString>,
    delayedMessageCallback: (
      response: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      >,
    ) => void,
    getHistory?: () => IConversationMessage<TConversationMessageContent>[],
  ): Promise<TConversationMessageContentString> {
    const originalContent = message.content.payload;
    const randomNumber = Math.floor(Math.random() * 10000);

    // Send delayed response
    setTimeout(() => {
      const delayedMessage: Pick<
        IConversationMessage<TConversationMessageContentString>,
        'content'
      > = {
        content: {
          type: 'text/plain',
          payload: `(${randomNumber}) - complete: ${originalContent}`,
        },
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(delayedMessage);
      }
    }, 500);

    // Return immediate response
    return Promise.resolve({
      type: 'text/plain',
      payload: `(${randomNumber}) ${originalContent}`,
    });
  }
}
