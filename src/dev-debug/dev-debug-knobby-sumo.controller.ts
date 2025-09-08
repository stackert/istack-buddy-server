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
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { IntentParsingService } from '../common/services/intent-parsing.service';
import { isIntentParsingError } from '../common/types/intent-parsing.types';

@Controller('dev-debug/knobby-sumo')
export class DevDebugKnobbySumoController {
  private readonly logger = new Logger(DevDebugKnobbySumoController.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly intentParsingService: IntentParsingService,
  ) {}

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
      const testMessage =
        req.body?.message || 'Default test message for KnobbyOpenAiSumoReport';

      this.logger.log(
        `Using test message: ${testMessage.substring(0, 100)}...`,
      );

      // Create robot instance
      const robot = new KnobbyOpenAiSumoReport();

      // Create mock message for testing
      const mockMessage: IConversationMessage<TConversationMessageContentString> =
        {
          id: 'sumo-test-msg-' + Date.now(),
          conversationId: 'sumo-test-conv-123',
          content: { type: 'text/plain', payload: testMessage },
          authorUserId: 'sumo-test-user',
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
          messageType: MessageType.TEXT,
          threadId: 'sumo-test-thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

      this.logger.log(
        `Mock message payload: ${mockMessage.content.payload.substring(0, 200)}...`,
      );

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
   * POST /dev-debug/knobby-sumo/test-intent
   * Test intent parsing and routing to KnobbyOpenAiSumoReport robot
   */
  @Post('test-intent')
  @HttpCode(HttpStatus.OK)
  async testIntentRouting(@Req() req: any): Promise<any> {
    this.logger.log('=== KNOBBY SUMO INTENT ROUTING TEST START ===');

    try {
      const testMessage =
        req.body?.message ||
        'Run me a submissions report for form 5627206 from September 1st to September 7th 2025';

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

      // Step 2: Test robot routing (force KnobbyOpenAiSumoReport for this test)
      this.logger.log('[INTENT-TEST] Step 2: Testing robot routing...');
      const targetRobotName = 'KnobbyOpenAiSumoReport';

      // Step 3: Create a test conversation and send message through ChatManager
      this.logger.log('[INTENT-TEST] Step 3: Creating test conversation...');

      // Create conversation using the correct method
      const conversation = await this.chatManagerService.startConversation({
        createdBy: 'test-user',
        createdByRole: UserRole.CUSTOMER,
        title: 'Sumo Intent Routing Test',
        description: 'Test conversation for Sumo intent routing',
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
      this.logger.error('Sumo intent routing test failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
