import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { IntentData } from '../common/types/intent-parsing.types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotIntent } from '../common/types/intent-parsing.types';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AssistUserJobExecutor implements IntentHandler, OnModuleInit {
  private readonly logger = new Logger(AssistUserJobExecutor.name);
  private robotPromptTemplate: string = '';

  constructor(private readonly chatManagerService: ChatManagerService) {}

  async onModuleInit() {
    try {
      const promptPath = path.join(
        process.cwd(),
        'CONTEXT-DOCUMENTS',
        'GENERAL_ASSISTANT.md',
      );
      this.robotPromptTemplate = await fs.readFile(promptPath, 'utf8');
      this.logger.log(
        'General assistant robot prompt template loaded successfully',
      );
    } catch (error) {
      this.logger.error(
        `Failed to load general assistant prompt template: ${error.message}`,
      );
      throw error; // Fail to start if we can't load the prompt
    }
  }

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'assistUser',
        description: 'General user assistance using SlackyOpenAiAgent',
        subIntents: ['generalAssistance'],
      },
    ];
  }

  async executeIntent(intentData: IntentData): Promise<void> {
    this.logger.log('Starting general assistance workflow');

    const conversationId = intentData.conversationId;
    if (!conversationId) {
      throw new Error('conversationId is required in intentData');
    }

    const originalPrompt = intentData.originalUserPrompt;
    if (!originalPrompt) {
      throw new Error('originalUserPrompt is required but was not provided');
    }

    try {
      // Send immediate acknowledgment
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `🔄 **General Assistance Request Received**\n\nProcessing: ${originalPrompt}\nGetting assistance...`,
        },
      );

      // Request robot response with the general assistant prompt
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/plain',
          payload: this.robotPromptTemplate,
        },
      );

      this.logger.log('General assistance workflow completed');
    } catch (error) {
      this.logger.error(`General assistance failed: ${error.message}`);

      // Send error to conversation
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `❌ **General Assistance Error**: ${error.message}`,
        },
      );
    }
  }
}
