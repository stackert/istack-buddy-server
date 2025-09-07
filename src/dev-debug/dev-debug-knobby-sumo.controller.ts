import {
  Controller,
  Post,
  HttpStatus,
  HttpCode,
  Req,
  Logger,
} from '@nestjs/common';
import { KnobbyOpenAiSumoReport } from '../robots/KnobbyOpenAiSumoReport';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContentString } from '../robots/types';

@Controller('dev-debug/knobby-sumo')
export class DevDebugKnobbySumoController {
  private readonly logger = new Logger(DevDebugKnobbySumoController.name);
  
  /**
   * POST /dev-debug/knobby-sumo/test-robot
   * Test the KnobbyOpenAiSumoReport robot
   */
  @Post('test-robot')
  @HttpCode(HttpStatus.OK)
  async testRobot(@Req() req: any): Promise<any> {
    console.log('🚨 SUMO CONTROLLER HIT - TEST ROBOT CALLED 🚨');
    console.log('Req.body:', JSON.stringify(req.body));
    
    this.logger.log('=== KNOBBY SUMO CONTROLLER TEST ROBOT START ===');
    
    try {
      const testMessage = req.body?.message || "Default test message for KnobbyOpenAiSumoReport";
      
      this.logger.log(`Using test message: ${testMessage.substring(0, 100)}...`);
      
      // Create robot instance
      const robot = new KnobbyOpenAiSumoReport();
      
      // Create mock message for testing
      const mockMessage: IConversationMessage<TConversationMessageContentString> = {
        id: 'sumo-test-msg-' + Date.now(),
        conversationId: 'sumo-test-conv-123',
        content: { type: 'text/plain', payload: testMessage },
        authorUserId: 'sumo-test-user',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
        messageType: MessageType.TEXT,
        threadId: 'sumo-test-thread',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.logger.log(`Mock message payload: ${mockMessage.content.payload.substring(0, 200)}...`);
      
      // Execute robot using streaming response
      this.logger.log('Calling robot.acceptMessageStreamResponse...');
      
      let finalResponse = '';
      
      const streamingCallbacks = {
        onStreamStart: (message: any) => {},
        onStreamChunkReceived: (chunk: string) => {
          finalResponse += chunk;
        },
        onStreamFinished: (message: any) => {},
        onFullMessageReceived: (message: any) => {},
        onError: (error: Error) => {
          this.logger.error(`Stream error: ${error.message}`);
        }
      };
      
      await robot.acceptMessageStreamResponse(mockMessage, streamingCallbacks);
      
      this.logger.log(`Final robot response: ${finalResponse.substring(0, 200)}...`);
      
      return {
        success: true,
        robot: robot.name,
        version: robot.version,
        input: testMessage,
        response: finalResponse || 'No response received',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        input: req.body?.message || 'hardcoded test message'
      };
    }
  }
}
