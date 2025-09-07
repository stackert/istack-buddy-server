import { Body, Controller, Post, HttpCode, HttpStatus, Req, Logger } from '@nestjs/common';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';

@Controller('dev-debug/chat-manager')
export class DevDebugChatManagerController {
  private readonly logger = new Logger(DevDebugChatManagerController.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
  ) {}

  @Post('test-slack-flow')
  @HttpCode(HttpStatus.OK)
  async testSlackFlow(@Req() req: any): Promise<any> {
    const startTime = new Date();
    this.logger.log('=== DEV DEBUG: Testing Slack Flow ===');
    
    try {
      // Get test message from request body
      const testMessage = req.body?.message || "Hello, I need help with form 12345. Can you check for errors?";
      this.logger.log(`Test message: ${testMessage}`);

      // Create a test conversation
      const conversation = await this.chatManagerService.startConversation({
        createdBy: 'dev-test-user',
        createdByRole: UserRole.CUSTOMER,
        title: 'Test Slack Flow Conversation',
        description: 'Dev/Debug test conversation for simulating Slack flow',
        initialParticipants: ['dev-test-user']
      });
      
      const testConversationId = conversation.id;

      // Mock Slack response callback
      const mockSlackCallback = async (content: { type: 'text'; payload: string }) => {
        const responseTime = new Date();
        const duration = responseTime.getTime() - startTime.getTime();
        
        this.logger.log('=== MOCK SLACK RESPONSE ===');
        this.logger.log(`Robot response (${duration}ms): ${content.payload}`);
        this.logger.log('=== END MOCK SLACK RESPONSE ===');
        
        return Promise.resolve();
      };

      // Simulate the full Slack flow by calling addMessageFromSlack
      this.logger.log('Calling ChatManager.addMessageFromSlack...');
      const userMessage = await this.chatManagerService.addMessageFromSlack(
        testConversationId,
        { type: 'text', payload: testMessage },
        mockSlackCallback
      );

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        testMessage: testMessage,
        conversationId: testConversationId,
        userMessageId: userMessage.id,
        duration: `${totalDuration}ms`,
        timestamp: endTime.toISOString(),
        note: 'Check server logs for robot response details',
        // Add more details from the conversation context
        conversationDetails: {
          currentRobot: (await this.chatManagerService.getConversations()).find(c => c.id === testConversationId)?.currentRobot || 'unknown'
        }
      };

    } catch (error) {
      this.logger.error('Error in test slack flow:', error);
      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();
      
      return {
        success: false,
        error: error.message,
        duration: `${totalDuration}ms`,
        timestamp: endTime.toISOString()
      };
    }
  }
}
