import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Req,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { KnobbySearchTestDto } from './dto/knobby-search-test.dto';
import { KnobbyOpenAiSearch } from '../robots/KnobbyOpenAiSearch';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';
import type { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import type { TConversationMessageContentString } from '../robots/types';

@Controller('dev-debug/knobby-search')
export class DevDebugKnobbyController {
  private readonly logger = new Logger(DevDebugKnobbyController.name);
  
  /**
   * POST /dev-debug/knobby-search/test-data
   * Test data reception (debug endpoint)
   */
  @Post('test-simple')
  @HttpCode(HttpStatus.OK)
  async testSimple(@Body() body: any) {
    this.logger.log(`=== SIMPLE TEST ===`);
    this.logger.log(`Simple body received: ${JSON.stringify(body, null, 2)}`);
    this.logger.log(`Body type: ${typeof body}`);
    
    return {
      success: true,
      receivedData: body
    };
  }

  /**
   * POST /dev-debug/knobby-search/test-robot
   * Test the KnobbyOpenAiSearch robot with a simple message
   */
  @Post('test-robot')
  @HttpCode(HttpStatus.OK)
  async testRobot(@Req() req: any) {
    console.log('🚨 CONTROLLER HIT - TEST ROBOT CALLED 🚨');
    console.log('Req.body:', JSON.stringify(req.body));
    
    this.logger.log('=== KNOBBY CONTROLLER TEST ROBOT START ===');
    this.logger.log(`Request URL: ${req.url}`);
    this.logger.log(`Request method: ${req.method}`);
    this.logger.log(`Request headers: ${JSON.stringify(req.headers, null, 2)}`);
    this.logger.log(`Raw body type: ${typeof req.body}`);
    this.logger.log(`Raw body: ${JSON.stringify(req.body)}`);
    
    try {
      // Use the actual message from the request body
      const testMessage = req.body?.message || "Default test message: Find documentation about SAML authentication setup";
      
      this.logger.log(`Received body: ${JSON.stringify(req.body, null, 2)}`);
      this.logger.log(`Body type: ${typeof req.body}`);
      this.logger.log(`Body.message exists: ${!!req.body?.message}`);
      this.logger.log(`Body.message type: ${typeof req.body?.message}`);
      this.logger.log(`Body.message value: ${req.body?.message?.substring(0, 100)}...`);
      this.logger.log(`Using test message: ${testMessage.substring(0, 100)}...`);
      
      // Create robot instance
      const robot = new KnobbyOpenAiSearch();
      
      // Create mock message for testing
      const mockMessage: IConversationMessage<TConversationMessageContentString> = {
        id: 'test-msg-' + Date.now(),
        conversationId: 'test-conv-123',
        content: { type: 'text/plain', payload: testMessage },
        authorUserId: 'test-user',
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.ROBOT,
        messageType: MessageType.TEXT,
        threadId: 'test-thread',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.logger.log(`Mock message payload: ${mockMessage.content.payload.substring(0, 200)}...`);
      
      // Execute robot using streaming response with logging
      this.logger.log('Calling robot.acceptMessageStreamResponse...');
      
      let finalResponse = '';
      let toolExecutionLogs: string[] = [];
      
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
        toolLogs: toolExecutionLogs
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
