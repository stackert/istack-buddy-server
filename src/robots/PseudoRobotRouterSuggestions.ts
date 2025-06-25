import { AbstractRobot } from './AbstractRobot';
import { TMessageEnvelope, TRobotMessage } from './types';
import { AgentRobotParrot } from './AgentRobotParrot';
import { ChatRobotParrot } from './ChatRobotParrot';

/**
 * A pseudo robot that analyzes available robots and suggests the best matches
 * for a given task or message context
 */
export class PseudoRobotRouterSuggestions extends AbstractRobot {
  public readonly name: string = 'PseudoRobotRouterSuggestions';
  public readonly version: string = '1.0.0';
  public readonly LLModelName: string = 'pseudo-router-suggestions';
  public readonly LLModelVersion: string = '1.0.0';
  public readonly contextWindowSizeInTokens: number = 4096;

  static descriptionShort = `
    A pseudo router that analyzes available robots and suggests the best matches for a given task.
    Always returns AgentRobotParrot and ChatRobotParrot for pseudo implementation.
  `;

  static descriptionLong = `
    PseudoRobotRouterSuggestions is a pseudo robot that simulates intelligent robot selection
    by analyzing the static descriptionLong fields of available robots to determine their
    capabilities and purposes.
    
    This robot is designed to:
    - Analyze incoming messages to understand the task requirements
    - Review available robots' descriptions to assess their suitability
    - Return a list of recommended robots for handling the specific task
    - Provide reasoning for robot selection decisions
    
    In this pseudo implementation, it always returns [AgentRobotParrot, ChatRobotParrot] to
    demonstrate the suggestion mechanism without requiring actual AI analysis. In a full
    implementation, this would use NLP to match task requirements with robot capabilities.
    
    This robot serves as the brain for intelligent task routing and robot orchestration.
  `;

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  public async acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message || {};
    const incomingMessage = recvMessage.message || recvMessage.content || '';

    // Simulate analyzing the message and available robots
    const analysisResponse: TRobotMessage = {
      role: 'assistant',
      content: `Analyzing request: "${incomingMessage}"
      
Reviewing available robots:
- AgentRobotParrot: ${AgentRobotParrot.descriptionShort?.trim()}
- ChatRobotParrot: ${ChatRobotParrot.descriptionShort?.trim()}

Based on the request analysis, I recommend the following robots:`,
      message: `Analyzing request and reviewing robot capabilities...`,
      sender: this.name,
      receiver: recvMessage.sender || 'user',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const immediateResponse: TMessageEnvelope = {
      ...messageEnvelope,
      messageType: 'response',
      message: analysisResponse,
    };

    // Provide delayed response with suggestions
    setTimeout(() => {
      const suggestions = ['AgentRobotParrot', 'ChatRobotParrot'];
      const suggestionsResponse: TRobotMessage = {
        role: 'assistant',
        content: `Robot Suggestions:

1. AgentRobotParrot - Recommended for task-based interactions that require multi-part responses and delayed callbacks
2. ChatRobotParrot - Recommended for conversational interactions that benefit from streaming or immediate responses

Reasoning: Both robots provide complementary capabilities for comprehensive message handling. AgentRobotParrot handles complex task workflows while ChatRobotParrot manages conversational flow.

Suggested robots: ${suggestions.join(', ')}`,
        message: `Suggestions: ${suggestions.join(', ')}`,
        sender: this.name,
        receiver: recvMessage.sender || 'user',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const delayedResponse: TMessageEnvelope = {
        ...messageEnvelope,
        messageType: 'response',
        message: suggestionsResponse,
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        try {
          delayedMessageCallback(delayedResponse);
        } catch (error) {
          // Continue execution even if callback throws an error
        }
      }
    }, 1000);

    return Promise.resolve(immediateResponse);
  }
}
