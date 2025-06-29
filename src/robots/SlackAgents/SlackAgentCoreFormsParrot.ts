import { AbstractSlackRobotAgent } from './AbstractSlackRobotAgent';
import { TMessageEnvelope, TRobotMessage } from '../types';
import { TKnowledgeBase, TSlackAgentFunctionDescription } from './types';

/**
 * A concrete agent robot that parrots (repeats) task descriptions as it executes them
 */
class SlackAgentCoreFormsParrot extends AbstractSlackRobotAgent {
  // public readonly name: string = 'AgentRobotParrot';
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

  public getFunctionDescriptions(): TSlackAgentFunctionDescription[] {
    return [];
  }

  public get name(): string {
    return this.constructor.name;
  }

  public get knowledgeBase(): TKnowledgeBase {
    return this.getKnowledgeBase();
  }

  public getKnowledgeBase(): TKnowledgeBase {
    return {
      knowledgeBaseId: 'core:forms',
      name: 'Core Forms',
      descriptionShort: 'Core Forms',
      descriptionLong: 'Core Forms',
      channelId: '123',
      channelName: '#cx-formstack',
      // channelType: 'channel',
    };
  }

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  public acceptMessageImmediateResponse(
    messageEnvelope: TMessageEnvelope,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message;
    const respMessage: TRobotMessage = { ...recvMessage };
    messageEnvelope.message = respMessage;
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.message = `(${randomNumber}) ${recvMessage.message}`;

    return Promise.resolve(messageEnvelope);
  }

  public acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message;
    const respMessage: TRobotMessage = { ...recvMessage };
    messageEnvelope.message = respMessage;
    const randomNumber = Math.floor(Math.random() * 10000);

    respMessage.message = `(${randomNumber}) ${recvMessage.message}`;

    setTimeout(() => {
      respMessage.message = `(${randomNumber}) - complete: ${recvMessage.message}`;
      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(messageEnvelope);
      }
    }, 500);

    return Promise.resolve(messageEnvelope);
  }
}

export { SlackAgentCoreFormsParrot };
