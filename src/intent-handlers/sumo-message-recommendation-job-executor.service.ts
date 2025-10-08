import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { IntentData } from '../common/types/intent-parsing.types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotIntent } from '../common/types/intent-parsing.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as knownSumoMessages from '../../CONTEXT-DOCUMENTS/sumo-known-messages.json';

interface SumoKnownMessage {
  message: string;
  sumoEventText: string;
  phpConstantKey: string;
  fileReferences: string[];
  aiComments: string;
  domains: string[];
}

@Injectable()
export class SumoMessageRecommendationJobExecutor
  implements IntentHandler, OnModuleInit
{
  private readonly logger = new Logger(
    SumoMessageRecommendationJobExecutor.name,
  );
  private knownMessages: SumoKnownMessage[] = [];
  private robotPromptTemplate: string = '';

  constructor(private readonly chatManagerService: ChatManagerService) {}

  async onModuleInit() {
    try {
      // Load known messages data from imported JSON
      this.logger.log(
        `Raw imported JSON keys: ${Object.keys(knownSumoMessages as any)}`,
      );
      this.logger.log(
        `Imported JSON structure: ${JSON.stringify(Object.keys(knownSumoMessages as any))}`,
      );

      this.knownMessages = (knownSumoMessages as any).messages;
      this.logger.log(
        `Loaded ${this.knownMessages.length} known Sumo messages`,
      );

      // Load robot prompt template
      const promptPath = path.join(
        process.cwd(),
        'CONTEXT-DOCUMENTS',
        'SUMO_FIND_RELEVANT_MESSAGE.md',
      );
      this.robotPromptTemplate = await fs.readFile(promptPath, 'utf8');
      this.logger.log(
        'Sumo message recommendation robot prompt template loaded successfully',
      );
    } catch (error) {
      this.logger.error(
        `Failed to load Sumo message recommendation resources: ${error.message}`,
      );
      throw error;
    }
  }

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'recommendSumoMessages',
        description: 'Recommend Sumo messages based on user criteria',
        subIntents: ['findMessage', 'searchMessage', 'messageQuery'],
      },
    ];
  }

  async executeIntent(intentData: IntentData): Promise<void> {
    this.logger.log('Starting Sumo message recommendation workflow');

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
          type: 'text/markdown',
          payload: `🔍 **Searching known Sumo messages for:** "${originalPrompt}"`,
        },
      );

      // Add known messages as context document to conversation
      await this.addKnownMessagesContext(conversationId);

      // Prepare robot prompt with user request
      const robotPrompt = this.robotPromptTemplate.replace(
        '{{USER_REQUEST}}',
        originalPrompt,
      );

      this.logger.log(
        `Robot prompt template loaded: ${this.robotPromptTemplate.length} characters`,
      );
      this.logger.log(
        `Robot prompt with user request: ${robotPrompt.length} characters`,
      );

      // Request robot response with the prompt
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/plain',
          payload: robotPrompt,
        },
      );

      this.logger.log('Sumo message recommendation workflow completed');
    } catch (error) {
      this.logger.error(`Sumo message recommendation failed: ${error.message}`);

      // Send error to conversation
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `❌ **Sumo Message Recommendation Error**: ${error.message}`,
        },
      );
    }
  }

  private async addKnownMessagesContext(conversationId: string): Promise<void> {
    try {
      this.logger.log(
        `Loading known messages context, total messages: ${this.knownMessages.length}`,
      );

      const knownMessageContextDocument = `
# ALL KNOWN MESSAGES

These are all the 'known' messages. We have information about these messages. Other unknown messages exist and we will treat them as standard message, but little is known about them (likely unexpected error condition).

${JSON.stringify(knownSumoMessages, null, 2)}
`;

      this.logger.log(
        `Context document size: ${knownMessageContextDocument.length} characters`,
      );

      // Add as context document to conversation
      await this.chatManagerService.addMessageAsContext(conversationId, {
        type: 'context/document',
        payload: knownMessageContextDocument,
      });

      this.logger.log(`Added known Sumo messages context to conversation`);
    } catch (error) {
      this.logger.error(
        `Failed to add known messages context: ${error.message}`,
      );
      throw error;
    }
  }
}
