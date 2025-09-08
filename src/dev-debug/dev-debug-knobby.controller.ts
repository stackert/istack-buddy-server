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
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import { isIntentParsingError } from '../common/types/intent-parsing.types';

@Controller('dev-debug/knobby-search')
export class DevDebugKnobbyController {
  private readonly logger = new Logger(DevDebugKnobbyController.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly intentParsingService: IntentParsingService,
  ) {}

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
      receivedData: body,
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
      const testMessage =
        req.body?.message ||
        'Default test message: Find documentation about SAML authentication setup';

      this.logger.log(`Received body: ${JSON.stringify(req.body, null, 2)}`);
      this.logger.log(`Body type: ${typeof req.body}`);
      this.logger.log(`Body.message exists: ${!!req.body?.message}`);
      this.logger.log(`Body.message type: ${typeof req.body?.message}`);
      this.logger.log(
        `Body.message value: ${req.body?.message?.substring(0, 100)}...`,
      );
      this.logger.log(
        `Using test message: ${testMessage.substring(0, 100)}...`,
      );

      // Create robot instance
      const robot = new KnobbyOpenAiSearch();

      // Create mock message for testing
      const mockMessage: IConversationMessage<TConversationMessageContentString> =
        {
          id: 'test-msg-' + Date.now(),
          conversationId: 'test-conv-123',
          content: { type: 'text/plain', payload: testMessage },
          authorUserId: 'test-user',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
          threadId: 'test-thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

      this.logger.log(
        `Mock message payload: ${mockMessage.content.payload.substring(0, 200)}...`,
      );

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
        },
      };

      await robot.acceptMessageStreamResponse(mockMessage, streamingCallbacks);

      this.logger.log(
        `Final robot response: ${finalResponse.substring(0, 200)}...`,
      );

      return {
        success: true,
        robot: robot.name,
        version: robot.version,
        input: testMessage,
        response: finalResponse || 'No response received',
        toolLogs: toolExecutionLogs,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        input: req.body?.message || 'hardcoded test message',
      };
    }
  }

  /**
   * POST /dev-debug/knobby-search/test-intent
   * Test intent parsing and routing to KnobbyOpenAiSearch robot
   */
  @Post('test-intent')
  @HttpCode(HttpStatus.OK)
  async testIntentRouting(@Req() req: any): Promise<any> {
    this.logger.log('=== KNOBBY INTENT ROUTING TEST START ===');

    try {
      const testMessage =
        req.body?.message ||
        'Find documentation about SAML authentication setup';

      this.logger.log(`Testing intent routing with message: ${testMessage}`);

      // Step 1: Test intent parsing
      this.logger.log('[INTENT-TEST] Step 1: Parsing intent...');
      const intentResult =
        await this.intentParsingService.parseIntent(testMessage);

      let intentParsingResult: any = {};
      if (!isIntentParsingError(intentResult)) {
        intentParsingResult = {
          success: true,
          robotName: intentResult.robotName,
          intent: intentResult.intent,
          intentData: intentResult.intentData,
        };
        this.logger.log(
          `[INTENT-TEST] Intent parsing successful: ${intentResult.robotName}`,
        );
      } else {
        intentParsingResult = {
          success: false,
          error: intentResult.error,
          reason: intentResult.reason,
        };
        this.logger.warn(
          `[INTENT-TEST] Intent parsing failed: ${intentResult.error}`,
        );
      }

      // Step 2: Test robot routing (force KnobbyOpenAiSearch for this test)
      this.logger.log('[INTENT-TEST] Step 2: Testing robot routing...');
      const targetRobotName = 'KnobbyOpenAiSearch';

      // Step 3: Create a test conversation and send message through ChatManager
      this.logger.log('[INTENT-TEST] Step 3: Creating test conversation...');

      // Create conversation using the correct method
      const conversation = await this.chatManagerService.startConversation({
        createdBy: 'test-user',
        createdByRole: UserRole.CUSTOMER,
        title: 'Intent Routing Test',
        description: 'Test conversation for intent routing',
        initialParticipants: ['test-user'],
      });

      const testConversationId = conversation.id;
      this.logger.log(
        `[INTENT-TEST] Created test conversation: ${testConversationId}`,
      );

      // Step 4: Send message through ChatManager (this will trigger intent parsing and robot routing)
      this.logger.log(
        '[INTENT-TEST] Step 4: Sending message through ChatManager...',
      );
      const startTime = Date.now();

      const userMessage = await this.chatManagerService.addMessageFromSlack(
        testConversationId,
        { type: 'text', payload: testMessage },
        async (response) => {
          this.logger.log(
            `[INTENT-TEST] Robot response received: ${response.payload.substring(0, 100)}...`,
          );
        },
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.log(
        `[INTENT-TEST] Message processing completed in ${duration}ms`,
      );

      // Step 5: Get conversation messages to verify robot response
      this.logger.log(
        '[INTENT-TEST] Step 5: Retrieving conversation messages...',
      );
      const messages = await this.chatManagerService.getLastMessages(
        testConversationId,
        10,
      );

      const robotMessages = messages.filter(
        (msg) => msg.fromRole === UserRole.ROBOT,
      );
      const lastRobotMessage = robotMessages[robotMessages.length - 1];

      this.logger.log(
        `[INTENT-TEST] Found ${robotMessages.length} robot messages`,
      );

      return {
        success: true,
        testMessage,
        intentParsing: intentParsingResult,
        targetRobot: targetRobotName,
        conversationId: testConversationId,
        userMessageId: userMessage.id,
        robotResponseCount: robotMessages.length,
        lastRobotMessage: lastRobotMessage
          ? {
              id: lastRobotMessage.id,
              content:
                lastRobotMessage.content.payload.substring(0, 200) + '...',
              timestamp: lastRobotMessage.createdAt,
            }
          : null,
        processingTimeMs: duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Intent routing test failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
