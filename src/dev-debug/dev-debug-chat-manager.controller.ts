import { Body, Controller, Post, HttpCode, HttpStatus, Req, Logger } from '@nestjs/common';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import { isIntentParsingError } from '../common/types/intent-parsing.types';

@Controller('dev-debug/chat-manager')
export class DevDebugChatManagerController {
  private readonly logger = new Logger(DevDebugChatManagerController.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly intentParsingService: IntentParsingService,
  ) {}

  @Post('start-conversation')
  @HttpCode(HttpStatus.OK)
  async startConversation(@Req() req: any): Promise<any> {
    const startTime = new Date();
    this.logger.log('=== DEV DEBUG: Starting Test Conversation ===');
    
    try {
      const title = req.body?.title || 'Test Conversation';
      const description = req.body?.description || 'Dev/Debug test conversation';
      
      // Create a test conversation
      const conversation = await this.chatManagerService.startConversation({
        createdBy: 'dev-test-user',
        createdByRole: UserRole.CUSTOMER,
        title: title,
        description: description,
        initialParticipants: ['dev-test-user']
      });
      
      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        conversationId: conversation.id,
        title: title,
        description: description,
        duration: `${totalDuration}ms`,
        timestamp: endTime.toISOString()
      };

    } catch (error) {
      this.logger.error('Error starting conversation:', error);
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

  @Post('test-conversation-message')
  @HttpCode(HttpStatus.OK)
  async testConversationMessage(@Req() req: any): Promise<any> {
    const startTime = new Date();
    this.logger.log('=== DEV DEBUG: Testing Conversation Message ===');
    
    try {
      const testMessage = req.body?.message || "Default test message";
      const conversationId = req.body?.conversationId;
      
      if (!conversationId) {
        return {
          success: false,
          error: 'conversationId is required',
          timestamp: new Date().toISOString()
        };
      }
      
      this.logger.log(`Test message: ${testMessage}`);
      this.logger.log(`Conversation ID: ${conversationId}`);

      // Parse intent first to include in response
      this.logger.log('Parsing intent for test message...');
      const intentResult = await this.intentParsingService.parseIntent(testMessage);
      
      let intentParsing: any = {
        success: false,
        error: 'Unknown error'
      };
      
      if (!isIntentParsingError(intentResult)) {
        intentParsing = {
          success: true,
          robotName: intentResult.robotName,
          intent: intentResult.intent,
          subIntents: intentResult.intentData.subIntents || [],
          subjects: intentResult.intentData.subjects || {},
          originalUserPrompt: intentResult.intentData.originalUserPrompt
        };
      } else {
        intentParsing = {
          success: false,
          error: intentResult.error,
          reason: intentResult.reason
        };
      }

      // Mock Slack response callback
      const mockSlackCallback = async (content: { type: 'text'; payload: string }) => {
        this.logger.log('=== MOCK SLACK RESPONSE ===');
        this.logger.log(`Robot response: ${content.payload.substring(0, 100)}...`);
        return Promise.resolve();
      };

      // Send message through the addMessageFromSlack pathway (includes intent parsing)
      this.logger.log('Calling ChatManager.addMessageFromSlack...');
      const userMessage = await this.chatManagerService.addMessageFromSlack(
        conversationId,
        { type: 'text', payload: testMessage },
        mockSlackCallback
      );

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        testMessage: testMessage,
        conversationId: conversationId,
        userMessageId: userMessage.id,
        duration: `${totalDuration}ms`,
        timestamp: endTime.toISOString(),
        // Intent parsing results
        intentParsing: intentParsing,
        // Current robot from conversation
        conversationDetails: {
          currentRobot: (await this.chatManagerService.getConversations()).find(c => c.id === conversationId)?.currentRobot || 'unknown'
        }
      };

    } catch (error) {
      this.logger.error('Error in test conversation message:', error);
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

  @Post('test-slack-flow')
  @HttpCode(HttpStatus.OK)
  async testSlackFlow(@Req() req: any): Promise<any> {
    const startTime = new Date();
    this.logger.log('=== DEV DEBUG: Testing Slack Flow ===');
    
    try {
      // Get test message from request body
      const testMessage = req.body?.message || "Hello, I need help with form 12345. Can you check for errors?";
      this.logger.log(`Test message: ${testMessage}`);

      // Parse intent first to include in response
      this.logger.log('Parsing intent for test message...');
      const intentResult = await this.intentParsingService.parseIntent(testMessage);
      
      let intentParsing: any = {
        success: false,
        error: 'Unknown error'
      };
      
      if (!isIntentParsingError(intentResult)) {
        intentParsing = {
          success: true,
          robotName: intentResult.robotName,
          intent: intentResult.intent,
          subIntents: intentResult.intentData.subIntents || [],
          subjects: intentResult.intentData.subjects || {},
          originalUserPrompt: intentResult.intentData.originalUserPrompt
        };
      } else {
        intentParsing = {
          success: false,
          error: intentResult.error,
          reason: intentResult.reason
        };
      }

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
        // Intent parsing results
        intentParsing: intentParsing,
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
