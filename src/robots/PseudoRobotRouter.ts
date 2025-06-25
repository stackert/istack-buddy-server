import { AbstractRobot } from './AbstractRobot';
import { TMessageEnvelope, TRobotMessage } from './types';
import { PseudoRobotRouterSuggestions } from './PseudoRobotRouterSuggestions';
import { AgentRobotParrot } from './AgentRobotParrot';
import { ChatRobotParrot } from './ChatRobotParrot';

/**
 * A pseudo router that coordinates message distribution to multiple robots
 * based on suggestions from PseudoRobotRouterSuggestions
 */
export class PseudoRobotRouter extends AbstractRobot {
  public readonly name: string = 'PseudoRobotRouter';
  public readonly version: string = '1.0.0';
  public readonly LLModelName: string = 'pseudo-router';
  public readonly LLModelVersion: string = '1.0.0';
  public readonly contextWindowSizeInTokens: number = 8192;

  private suggestionRobot: PseudoRobotRouterSuggestions;
  private agentRobot: AgentRobotParrot;
  private chatRobot: ChatRobotParrot;

  static descriptionShort = `
    A pseudo router that orchestrates message distribution to multiple robots.
    Calls PseudoRobotRouterSuggestions for recommendations, then executes each suggested robot.
  `;

  static descriptionLong = `
    PseudoRobotRouter is a sophisticated pseudo robot that implements multi-robot orchestration
    and coordination. It serves as a central dispatcher that intelligently routes messages to
    the most appropriate robots based on dynamic analysis.
    
    This router works by:
    - Accepting incoming messages from clients
    - Consulting PseudoRobotRouterSuggestions for robot recommendations  
    - Executing each suggested robot in parallel or sequence
    - Aggregating and coordinating responses from multiple robots
    - Providing comprehensive multi-perspective responses to users
    
    Key capabilities:
    - Multi-robot coordination and orchestration
    - Intelligent task distribution based on robot capabilities
    - Response aggregation from multiple robot sources
    - Parallel execution for improved performance
    - Comprehensive error handling across robot interactions
    
    This pseudo implementation demonstrates advanced routing patterns without requiring
    complex AI decision-making, making it ideal for testing multi-robot architectures
    and orchestration workflows.
  `;

  constructor() {
    super();
    this.suggestionRobot = new PseudoRobotRouterSuggestions();
    this.agentRobot = new AgentRobotParrot();
    this.chatRobot = new ChatRobotParrot();
  }

  public estimateTokens(message: string): number {
    // Estimate tokens for multiple robot calls
    return Math.ceil(message.length / 4) * 3; // Multiply by number of robots involved
  }

  public async acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message || {};
    const incomingMessage = recvMessage.message || recvMessage.content || '';

    // Step 1: Provide immediate acknowledgment
    const routerResponse: TRobotMessage = {
      role: 'assistant',
      content: `PseudoRobotRouter activated. Processing request: "${incomingMessage}"
      
Phase 1: Consulting PseudoRobotRouterSuggestions for robot recommendations...`,
      message: `Router processing request and gathering suggestions...`,
      sender: this.name,
      receiver: recvMessage.sender || 'user',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const immediateResponse: TMessageEnvelope = {
      ...messageEnvelope,
      messageType: 'response',
      message: routerResponse,
    };

    // Step 2: Get suggestions and execute robots
    setTimeout(async () => {
      try {
        // Get suggestions (in real implementation, we'd parse the response)
        // For pseudo implementation, we know it returns AgentRobotParrot and ChatRobotParrot
        const suggestedRobots = [this.agentRobot, this.chatRobot];

        // Phase 2: Notify about suggestion results
        const suggestionsResponse: TRobotMessage = {
          role: 'assistant',
          content: `Phase 2: Received suggestions from PseudoRobotRouterSuggestions
          
Suggested robots: AgentRobotParrot, ChatRobotParrot

Phase 3: Executing suggested robots...`,
          message: `Executing AgentRobotParrot and ChatRobotParrot...`,
          sender: this.name,
          receiver: recvMessage.sender || 'user',
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const phase2Response: TMessageEnvelope = {
          ...messageEnvelope,
          messageType: 'response',
          message: suggestionsResponse,
        };

        if (delayedMessageCallback) {
          try {
            delayedMessageCallback(phase2Response);
          } catch (error) {
            // Continue execution even if callback throws an error
          }
        }

        // Step 3: Execute each suggested robot
        const robotResponses: string[] = [];

        for (const robot of suggestedRobots) {
          try {
            const robotEnvelope = { ...messageEnvelope };
            let robotResponse: TMessageEnvelope;

            if (robot instanceof AgentRobotParrot) {
              // Use multipart response for agent
              robotResponse = await robot.acceptMessageMultiPartResponse(
                robotEnvelope,
                (agentCallback) => {
                  robotResponses.push(
                    `${robot.name} (delayed): ${agentCallback.message?.message || agentCallback.message?.content}`,
                  );
                },
              );
              robotResponses.push(
                `${robot.name}: ${robotResponse.message?.message || robotResponse.message?.content}`,
              );
            } else if (robot instanceof ChatRobotParrot) {
              // Use immediate response for chat
              robotResponse =
                await robot.acceptMessageImmediateResponse(robotEnvelope);
              robotResponses.push(
                `${robot.name}: ${robotResponse.message?.message || robotResponse.message?.content}`,
              );
            }
          } catch (error) {
            robotResponses.push(`${robot.name}: Error - ${error.message}`);
          }
        }

        // Step 4: Provide final aggregated response
        setTimeout(() => {
          const finalResponse: TRobotMessage = {
            role: 'assistant',
            content: `Phase 4: Router execution complete!

Results from suggested robots:

${robotResponses.map((response, index) => `${index + 1}. ${response}`).join('\n')}

PseudoRobotRouter has successfully coordinated responses from ${suggestedRobots.length} robots.`,
            message: `Router complete - received ${robotResponses.length} responses from suggested robots`,
            sender: this.name,
            receiver: recvMessage.sender || 'user',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          const finalEnvelope: TMessageEnvelope = {
            ...messageEnvelope,
            messageType: 'response',
            message: finalResponse,
          };

          if (delayedMessageCallback) {
            try {
              delayedMessageCallback(finalEnvelope);
            } catch (error) {
              // Continue execution even if callback throws an error
            }
          }
        }, 2000);
      } catch (error) {
        const errorResponse: TRobotMessage = {
          role: 'assistant',
          content: `PseudoRobotRouter encountered an error: ${error.message}`,
          message: `Router error: ${error.message}`,
          sender: this.name,
          receiver: recvMessage.sender || 'user',
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const errorEnvelope: TMessageEnvelope = {
          ...messageEnvelope,
          messageType: 'response',
          message: errorResponse,
        };

        if (delayedMessageCallback) {
          try {
            delayedMessageCallback(errorEnvelope);
          } catch (error) {
            // Continue execution even if callback throws an error
          }
        }
      }
    }, 1500);

    return Promise.resolve(immediateResponse);
  }
}
