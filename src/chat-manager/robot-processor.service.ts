import { Injectable, Logger } from '@nestjs/common';
import { RobotService } from '../robots/robot.service';
import { SlackyAnthropicAgent } from '../robots/SlackyAnthropicAgent';
import { RobotChatAnthropic } from '../robots/RobotChatAnthropic';
import { ChatRobotParrot } from '../robots/ChatRobotParrot';
import { TConversationTextMessageEnvelope } from '../robots/types';
import { UserRole, MessageType } from './dto/create-message.dto';

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

  constructor(private readonly robotService: RobotService) {}

  /**
   * Process a message with appropriate robot
   * Returns the robot response without writing to any conversation
   */
  async processMessage(
    request: RobotProcessingRequest,
  ): Promise<RobotProcessingResponse> {
    this.logger.log(
      `🤖 Processing message for conversation ${request.conversationId}`,
    );
    this.logger.log(`📝 Content: "${request.content}"`);

    try {
      // Determine which robot to use based on content
      const robotInfo = this.selectRobot(request.content);

      this.logger.log(`🎯 Selected robot: ${robotInfo.name}`);

      if (!robotInfo.robot) {
        return {
          response: 'Robot service not available at this time.',
          robotName: robotInfo.name,
          processed: false,
          error: 'Robot not found',
        };
      }

      // Create message envelope for robot
      const messageEnvelope = this.createMessageEnvelope(request);

      // Process with robot
      let robotResponse: string;

      if (robotInfo.useMultiPart) {
        // For complex requests (like forms), use multi-part processing
        const response = await robotInfo.robot.acceptMessageMultiPartResponse(
          messageEnvelope,
          (delayedResponse: TConversationTextMessageEnvelope) => {
            // Handle delayed responses - could emit events here if needed
            this.logger.log(
              `📥 Received delayed response: ${delayedResponse.envelopePayload.content.payload.substring(0, 100)}...`,
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
        `✅ Robot response generated (${robotResponse.length} chars)`,
      );

      return {
        response: robotResponse,
        robotName: robotInfo.name,
        processed: true,
      };
    } catch (error) {
      this.logger.error(`❌ Error processing with robot:`, error);

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
  ): Promise<RobotProcessingResponse> {
    return this.processMessage({
      content,
      fromUserId,
      fromRole: UserRole.CUSTOMER,
      conversationId,
      messageType: MessageType.TEXT,
    });
  }

  // Private helper methods

  private selectRobot(content: string): {
    robot: any;
    name: string;
    useMultiPart: boolean;
  } {
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

    // For Slack mentions, use the specialized Slack robot
    if (this.isSlackContext(content)) {
      return {
        robot: this.robotService.getRobotByName<SlackyAnthropicAgent>(
          'SlackyAnthropicAgent',
        ),
        name: 'SlackyAnthropicAgent',
        useMultiPart: false,
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

  private createMessageEnvelope(
    request: RobotProcessingRequest,
  ): TConversationTextMessageEnvelope {
    return {
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
  }

  private estimateTokenCount(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }
}
