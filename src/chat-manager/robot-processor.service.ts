import { Injectable, Logger } from '@nestjs/common';
import { RobotService } from '../robots/robot.service';
import { ChatManagerService } from './chat-manager.service';
import { SlackyAnthropicAgent } from '../robots/SlackyAnthropicAgent';
import { RobotChatAnthropic } from '../robots/RobotChatAnthropic';
import { ChatRobotParrot } from '../robots/ChatRobotParrot';
import { TConversationTextMessageEnvelope } from '../robots/types';
import { UserRole, MessageType } from './dto/create-message.dto';
import { Message } from './interfaces/message.interface';

export interface RobotProcessingRequest {
  content: string;
  fromUserId: string;
  fromRole: UserRole;
  conversationId: string;
  messageType?: MessageType;
}

export interface RobotProcessingResponse {
  response: string;
  robotName: string;
  processed: boolean;
  error?: string;
}

@Injectable()
export class RobotProcessorService {
  private readonly logger = new Logger(RobotProcessorService.name);
  private currentConversationHistory: Message[] = [];

  constructor(
    private readonly robotService: RobotService,
    private readonly chatManagerService: ChatManagerService,
  ) {}

  /**
   * Process a message with appropriate robot
   * Returns the robot response without writing to any conversation
   */
  async processMessage(
    request: RobotProcessingRequest,
  ): Promise<RobotProcessingResponse> {
    this.logger.log(
      `Processing message for conversation ${request.conversationId}`,
    );
    this.logger.log(`Content: "${request.content}"`);

    try {
      // Determine which robot to use based on content
      const robotInfo = this.selectRobot(request.content);

      this.logger.log(`Selected robot: ${robotInfo.name}`);

      if (!robotInfo.robot) {
        return {
          response: 'Robot service not available at this time.',
          robotName: robotInfo.name,
          processed: false,
          error: 'Robot not found',
        };
      }

      // Create message envelope with conversation history
      const messageEnvelope =
        await this.createMessageEnvelopeWithHistory(request);

      // Set conversation history for robots to use
      if (robotInfo.robot.setConversationHistory) {
        robotInfo.robot.setConversationHistory(this.currentConversationHistory);
      }

      // Process with robot
      let robotResponse: string;

      if (robotInfo.useMultiPart) {
        // For complex requests (like forms), use multi-part processing
        const response = await robotInfo.robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          (delayedResponse: TConversationTextMessageEnvelope) => {
            // Handle delayed responses - could emit events here if needed
            this.logger.log(
              `Received delayed response: ${delayedResponse.envelopePayload.content.payload.substring(0, 100)}...`,
            );
          },
        );
        robotResponse = response.envelopePayload.content.payload;
      } else {
        // For simple requests, use immediate response
        const response =
          await robotInfo.robot.acceptMessageImmediateResponse(messageEnvelope);
        robotResponse = response.envelopePayload.content.payload;
      }

      this.logger.log(
        `Robot response generated (${robotResponse.length} chars)`,
      );

      return {
        response: robotResponse,
        robotName: robotInfo.name,
        processed: true,
      };
    } catch (error) {
      this.logger.error(`Error processing with robot:`, error);

      return {
        response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        robotName: 'unknown',
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a message should be processed by a robot
   */
  shouldProcessMessage(content: string): boolean {
    // Process if message contains robot trigger words or patterns
    return (
      content.includes('@robot') ||
      content.toLowerCase().includes('help') ||
      content.toLowerCase().includes('form') ||
      content.toLowerCase().includes('sso') ||
      content.toLowerCase().includes('formstack') ||
      /(formId|form):\s*\{?\d+\}?/i.test(content)
    );
  }

  /**
   * Process specifically for Slack mentions
   * Slack mentions should always be processed
   */
  async processSlackMention(
    content: string,
    fromUserId: string,
    conversationId: string,
    delayedMessageCallback?: (
      response: RobotProcessingResponse,
    ) => Promise<void>,
  ): Promise<RobotProcessingResponse> {
    this.logger.log(
      `Processing Slack mention for conversation ${conversationId}`,
    );

    try {
      // Determine which robot to use based on content
      const robotInfo = this.selectRobot(content);

      this.logger.log(`Selected robot: ${robotInfo.name}`);

      if (!robotInfo.robot) {
        return {
          response: 'Robot service not available at this time.',
          robotName: robotInfo.name,
          processed: false,
          error: 'Robot not found',
        };
      }

      // Create message envelope with conversation history
      const messageEnvelope = await this.createMessageEnvelopeWithHistory({
        content,
        fromUserId,
        fromRole: UserRole.CUSTOMER,
        conversationId,
        messageType: MessageType.TEXT,
      });

      // Set conversation history for robots to use
      if (robotInfo.robot.setConversationHistory) {
        robotInfo.robot.setConversationHistory(this.currentConversationHistory);
      }

      // Process with robot using multi-part for enhanced responses
      if (robotInfo.useMultiPart && delayedMessageCallback) {
        const response = await robotInfo.robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          async (delayedResponse: TConversationTextMessageEnvelope) => {
            this.logger.log(
              `Received delayed response from ${robotInfo.name}: ${delayedResponse.envelopePayload.content.payload.substring(0, 100)}...`,
            );

            // Send delayed response back to Slack
            await delayedMessageCallback({
              response: delayedResponse.envelopePayload.content.payload,
              robotName: robotInfo.name,
              processed: true,
            });
          },
        );

        return {
          response: response.envelopePayload.content.payload,
          robotName: robotInfo.name,
          processed: true,
        };
      } else {
        // Fallback to immediate response
        const response =
          await robotInfo.robot.acceptMessageImmediateResponse(messageEnvelope);
        return {
          response: response.envelopePayload.content.payload,
          robotName: robotInfo.name,
          processed: true,
        };
      }
    } catch (error) {
      this.logger.error(`Error processing Slack mention:`, error);

      return {
        response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        robotName: 'SlackyAnthropicAgent',
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Private helper methods

  private selectRobot(content: string): {
    robot: any;
    name: string;
    useMultiPart: boolean;
  } {
    // For Slack mentions, ALWAYS use the specialized Slack robot with multi-part processing
    if (this.isSlackContext(content)) {
      return {
        robot: this.robotService.getRobotByName<SlackyAnthropicAgent>(
          'SlackyAnthropicAgent',
        ),
        name: 'SlackyAnthropicAgent',
        useMultiPart: true, // Enable multi-part to send tool results + analysis
      };
    }

    // Check for form-related content that needs multi-part processing
    const containsFormId = /(formId|form):\s*\{?\d+\}?/i.test(content);

    if (containsFormId) {
      return {
        robot:
          this.robotService.getRobotByName<RobotChatAnthropic>(
            'RobotChatAnthropic',
          ),
        name: 'RobotChatAnthropic',
        useMultiPart: true,
      };
    }

    // Default to parrot robot for simple cases
    return {
      robot:
        this.robotService.getRobotByName<ChatRobotParrot>('ChatRobotParrot'),
      name: 'ChatRobotParrot',
      useMultiPart: false,
    };
  }

  private isSlackContext(content: string): boolean {
    // Detect if this is from Slack context
    return (
      content.includes('<@U') || // Slack mention format
      content.includes('istackbuddy') ||
      content.includes('slacky')
    );
  }

  /**
   * Filter messages to only include those relevant to robot processing
   * Excludes short-circuit messages like tool responses, system messages
   */
  private filterRobotRelevantMessages(messages: Message[]): Message[] {
    return messages.filter((message) => {
      // Include human messages
      if (message.fromRole === UserRole.CUSTOMER) {
        return true;
      }

      // Include robot responses (but not tool responses)
      if (
        message.fromRole === UserRole.ROBOT &&
        message.messageType === MessageType.TEXT
      ) {
        // Exclude short-circuit tool responses (they usually start with raw JSON or tool identifiers)
        const content = message.content.trim();

        // Skip if it looks like a raw tool response (starts with { or contains tool execution markers)
        if (
          content.startsWith('{') ||
          content.includes('🔧 Executing') ||
          content.includes('**Tool:')
        ) {
          return false;
        }

        return true;
      }

      // Exclude system messages and other message types
      return false;
    });
  }

  /**
   * Create message envelope with full conversation history
   * This replaces the simple createMessageEnvelope method
   */
  private async createMessageEnvelopeWithHistory(
    request: RobotProcessingRequest,
  ): Promise<TConversationTextMessageEnvelope> {
    // Get conversation history - get last 20 messages to provide context
    const conversationHistory = await this.chatManagerService.getLastMessages(
      request.conversationId,
      20,
    );

    // Filter out short-circuit messages (tool responses, system messages)
    const filteredHistory =
      this.filterRobotRelevantMessages(conversationHistory);

    // Store filtered history for robots to use
    this.currentConversationHistory = filteredHistory;

    // Log conversation history for debugging
    this.logger.log(
      `Retrieved ${conversationHistory.length} messages, filtered to ${filteredHistory.length} relevant messages`,
    );

    // Log trimmed conversation history for dev/debug
    filteredHistory.forEach((msg, index) => {
      const trimmedContent = this.trimMessageForDebug(msg.content);
      this.logger.log(
        `Message ${index + 1}: [${msg.fromRole}] ${trimmedContent}`,
      );
    });

    // Create the envelope with the current message
    const messageEnvelope: TConversationTextMessageEnvelope = {
      messageId: `robot-request-${Date.now()}`,
      requestOrResponse: 'request',
      envelopePayload: {
        messageId: `msg-${Date.now()}`,
        author_role: request.fromUserId,
        content: {
          type: 'text/plain',
          payload: request.content,
        },
        created_at: new Date().toISOString(),
        estimated_token_count: this.estimateTokenCount(request.content),
      },
    };

    return messageEnvelope;
  }

  /**
   * Trim message content to 100 characters for dev/debug
   * NOTE: This is only for dev/debug purposes to keep logs readable
   */
  private trimMessageForDebug(content: string): string {
    if (content.length > 100) {
      return content.substring(0, 100) + '...';
    }
    return content;
  }

  private estimateTokenCount(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }
}
