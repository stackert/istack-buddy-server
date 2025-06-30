import { AbstractRobotAgent } from './AbstractRobotAgent';
import { TConversationTextMessageEnvelope, TConversationTextMessage } from './types';

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

  public acceptMessageImmediateResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    const recvMessage: TConversationTextMessage = messageEnvelope.envelopePayload;
    const respMessage: TConversationTextMessage = { ...recvMessage };
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.content.payload = `(${randomNumber}) ${recvMessage.content.payload}`;

    const responseEnvelope: TConversationTextMessageEnvelope = {
      messageId: `response-${Date.now()}`,
      envelopePayload: respMessage,
    };

    return Promise.resolve(responseEnvelope);
  }

  public acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (response: TConversationTextMessageEnvelope) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    const recvMessage: TConversationTextMessage = messageEnvelope.envelopePayload;
    const originalContent = recvMessage.content.payload;
    const randomNumber = Math.floor(Math.random() * 10000);

    // Send delayed response
    setTimeout(() => {
      const delayedRespMessage: TConversationTextMessage = {
        ...recvMessage,
        content: {
          type: 'text/plain',
          payload: `(${randomNumber}) - complete: ${originalContent}`,
        },
        author_role: 'assistant',
        created_at: new Date().toISOString(),
      };

      const delayedResponseEnvelope: TConversationTextMessageEnvelope = {
        messageId: `response-${Date.now()}-delayed`,
        envelopePayload: delayedRespMessage,
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(delayedResponseEnvelope);
      }
    }, 500);

    // Return immediate response
    const immediateRespMessage: TConversationTextMessage = {
      ...recvMessage,
      content: {
        type: 'text/plain',
        payload: `(${randomNumber}) ${originalContent}`,
      },
      author_role: 'assistant',
      created_at: new Date().toISOString(),
    };

    const immediateResponseEnvelope: TConversationTextMessageEnvelope = {
      messageId: `response-${Date.now()}`,
      envelopePayload: immediateRespMessage,
    };

    return Promise.resolve(immediateResponseEnvelope);
  }
}
