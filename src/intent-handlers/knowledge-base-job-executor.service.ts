import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RobotService } from '../robots/robot.service';
import { IStreamingCallbacks } from '../robots/types';
import { RobotName, UserRole } from '../chat-manager/dto/create-message.dto';
import { TConversationMessageContentMarkdown } from '../ConversationLists/types';

@Injectable()
export class KnowledgeBaseJobExecutor implements IntentHandler, OnModuleInit {
  private readonly logger = new Logger(KnowledgeBaseJobExecutor.name);
  private robotPromptTemplate: string = '';
  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
    private readonly iStackInfoService: IStackInfoService,
  ) {}

  async onModuleInit() {
    await this.loadRobotPromptTemplate();
  }

  private async loadRobotPromptTemplate(): Promise<void> {
    try {
      const promptPath = path.join(
        process.cwd(),
        'CONTEXT-DOCUMENTS',
        'search-results',
        'top-search-pre-prompty.md',
      );
      this.robotPromptTemplate = await fs.readFile(promptPath, 'utf8');
      this.logger.log(
        'Knowledge base robot prompt template loaded successfully',
      );
    } catch (error) {
      this.logger.error(
        `Failed to load robot prompt template: ${error.message}`,
      );
      throw error; // Fail to start if we can't load the prompt
    }
  }

  /**
   * Get the base URL for generating links with proper fallbacks
   */
  private getBaseUrl(): string {
    // Priority 1: NGROK_URL environment variable
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 2: HOST_URL environment variable
    if (process.env.HOST_URL) {
      return process.env.HOST_URL.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 3: PORT environment variable
    if (process.env.PORT) {
      return `http://localhost:${process.env.PORT}`;
    }

    // Fallback to default
    return 'http://localhost:3000';
  }

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'searchKnowledgeBase',
        subIntents: [
          'semanticSearch',
          'keywordSearch',
          'nounSearch',
          'properNounSearch',
          'domainSearch',
          'freeTextSearch',
          'topResults',
        ],
        description: 'Execute knowledge base searches and return results',
      },
    ];
  }

  async executeIntent(intentData: any): Promise<void> {
    this.logger.log('Starting knowledge base search workflow');

    const conversationId = intentData.conversationId;
    if (!conversationId) {
      throw new Error('conversationId is required in intentData');
    }

    try {
      // Send immediate acknowledgment
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `**Knowledge Base Search Request Received**\n\n**Searching normalized text:** "${intentData.originalUserPrompt}"\nProcessing query...`,
        },
      );

      // 1. Fetch preQuery using service wrapper
      const query = intentData.originalUserPrompt;
      if (!query) {
        throw new Error('originalUserPrompt is required but was not provided');
      }

      const preQuery =
        await this.iStackInfoService.knowledgeBase.preQuery(query);

      // 2. Fetch search results using the specific sub-intent
      const subIntent = intentData.subIntents?.[0] || 'topResults';
      const searchResults = await this.fetchSearchResults(preQuery, subIntent);

      // Log search results to file
      await this.logSearchResults(
        conversationId,
        query,
        preQuery,
        subIntent,
        searchResults,
      );

      // 3. Send initial status message
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `**Searching knowledge base...**\n\nProcessing your query: "${preQuery.userPromptText || 'knowledge base search'}"\n\nThis may take a moment while we search through documentation and conversations.`,
        },
      );

      // 4. Format search results into robot context
      const robotContext = await this.formatSearchResultsIntoRobotContext(
        searchResults,
        preQuery,
        conversationId,
      );

      // 5. Add robot context to conversation
      await this.chatManagerService.addMessageAsContext(conversationId, {
        type: 'context/document',
        payload: robotContext,
      });

      // 6. Request robot response with the new context
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/plain',
          payload: this.robotPromptTemplate,
        },
      );

      this.logger.log('Knowledge base search workflow completed');
    } catch (error) {
      this.logger.error(`Knowledge base search failed: ${error.message}`);

      // Send error to conversation
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `❌ **Knowledge Base Search Error**: ${error.message}`,
        },
      );
    }
  }

  private async logSearchResults(
    conversationId: string,
    query: string,
    preQuery: any,
    subIntent: string,
    searchResults: any,
  ): Promise<void> {
    console.log('LOGGING SEARCH RESULTS - CALLED');
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const logData = {
        timestamp,
        conversationId,
        originalQuery: query,
        preQuery,
        searchResults: {
          subIntent,
          results: searchResults,
        },
      };

      const filename = `${timestamp}.search-results.json`;
      const filepath = path.join(
        process.cwd(),
        'logs',
        'search-results',
        filename,
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });

      await fs.writeFile(filepath, JSON.stringify(logData, null, 2));
      this.logger.log(`Search results logged to ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to log search results: ${error.message}`);
    }
  }

  private buildSearchRequest(preQuery: any, subIntent: string): any {
    switch (subIntent) {
      case 'semanticSearch':
        return {
          userPromptText: preQuery.userPromptText,
          maxConfidence: 1.0,
          limit: 10,
        };

      case 'keywordSearch':
        return {
          keywords: preQuery.keywords || [],
          maxConfidence: 1.0,
          limit: 10,
        };

      case 'nounSearch':
        return {
          nouns: preQuery.nouns || [],
          maxConfidence: 1.0,
          limit: 10,
        };

      case 'properNounSearch':
        return {
          properNouns: preQuery.properNouns || [],
          maxConfidence: 1.0,
          limit: 10,
        };

      case 'domainSearch':
        return {
          domains: preQuery.domains || [],
          maxConfidence: 1.0,
          limit: 10,
        };

      case 'freeTextSearch':
        return {
          freeText: preQuery.freeText ||
            preQuery.keywords || ['text', 'search'],
          maxConfidence: 1.0,
          limit: 10,
        };

      case 'topResults':
      default:
        return preQuery;
    }
  }

  private async fetchSearchResults(
    preQuery: any,
    subIntent: string,
  ): Promise<any> {
    this.logger.log(
      `Fetching search results using preQuery data for subIntent: ${subIntent}`,
    );

    switch (subIntent) {
      case 'semanticSearch':
        return await this.iStackInfoService.knowledgeBase.semanticSearch({
          userPromptText: preQuery.userPromptText,
          maxConfidence: 1.0,
          limit: 10,
        });

      case 'keywordSearch':
        return await this.iStackInfoService.knowledgeBase.keywordSearch({
          keywords: preQuery.keywords || [],
          maxConfidence: 1.0,
          limit: 10,
        });

      case 'nounSearch':
        return await this.iStackInfoService.knowledgeBase.nounSearch({
          nouns: preQuery.nouns || [],
          maxConfidence: 1.0,
          limit: 10,
        });

      case 'properNounSearch':
        return await this.iStackInfoService.knowledgeBase.properNounSearch({
          properNouns: preQuery.properNouns || [],
          maxConfidence: 1.0,
          limit: 10,
        });

      case 'domainSearch':
        return await this.iStackInfoService.knowledgeBase.domainSearch({
          domains: preQuery.domains || [],
          maxConfidence: 1.0,
          limit: 10,
        });

      case 'freeTextSearch':
        return await this.iStackInfoService.knowledgeBase.freeTextSearch({
          freeText: preQuery.freeText ||
            preQuery.keywords || ['text', 'search'],
          maxConfidence: 1.0,
          limit: 10,
        });

      case 'topResults':
      default:
        // The /top-results endpoint expects the FULL PreQueryDto object as input
        return await this.iStackInfoService.knowledgeBase.topResults(preQuery);
    }
  }

  private async formatSearchResultsIntoRobotContext(
    searchResults: any,
    preQuery: any,
    conversationId: string,
  ): Promise<string> {
    const searchTypesExecuted = searchResults.searchTypesExecuted || [];

    // Reload template to get latest changes
    await this.loadRobotPromptTemplate();

    // Get base URL for generating proper links
    const baseUrl = this.getBaseUrl();

    // Use the template from the file and replace placeholders
    let prompt = this.robotPromptTemplate
      .replace('{base-url}', baseUrl)
      .replace('{conversation-id}', conversationId);

    // Extract key information from search results - handle both formats
    if (searchTypesExecuted.length > 0) {
      // This is from topResults - handle multiple search types
      for (const searchType of searchTypesExecuted) {
        const results = searchResults[searchType];
        if (results) {
          Object.keys(results).forEach((knowledgeBase) => {
            const kbResults = results[knowledgeBase];
            if (Array.isArray(kbResults) && kbResults.length > 0) {
              // Process each result (but limit to first few for prompt size)
              kbResults.slice(0, 2).forEach((result, index) => {
                prompt += `__${searchType}.${knowledgeBase}[${index}]_START__

conversationTextNormalized
${result.conversationTextNormalized || result.contextDocumentTextNormalized || 'No description available'}

aiTechnicalObservation
${result.aiTechnicalObservation || 'No technical observation available'}

channelId: ${result.channelId || 'Unknown'}
confidence: ${result.confidence || 'Unknown'}
citations: {
  text: "${result.citations?.text || ''}"
  conversation: "${result.citations?.conversation || ''}"
  link: "${result.citations?.link || ''}"
}

__${searchType}.${knowledgeBase}[${index}]_END__

`;
              });
            }
          });
        }
      }
    } else {
      // This is from individual search method - handle single SearchResults
      Object.keys(searchResults).forEach((knowledgeBase) => {
        const kbResults = searchResults[knowledgeBase];
        if (Array.isArray(kbResults) && kbResults.length > 0) {
          // Process each result (but limit to first few for prompt size)
          kbResults.slice(0, 3).forEach((result, index) => {
            prompt += `__individualSearch.${knowledgeBase}[${index}]_START__

conversationTextNormalized
${result.conversationTextNormalized || result.contextDocumentTextNormalized || 'No description available'}

aiTechnicalObservation
${result.aiTechnicalObservation || 'No technical observation available'}

channelId: ${result.channelId || 'Unknown'}
confidence: ${result.confidence || 'Unknown'}
citations: {
  text: "${result.citations?.text || ''}"
  conversation: "${result.citations?.conversation || ''}"
  link: "${result.citations?.link || ''}"
}

__individualSearch.${knowledgeBase}[${index}]_END__

`;
          });
        }
      });
    }

    prompt += `___SEARCH_RESULTS_END__

`;

    return prompt;
  }

  private formatUserOriginalQuery(preQuery: any): string {
    return `__USER_ORIGINAL_QUERY_START__
${preQuery.originalText || 'No original query available'}
__USER_ORIGINAL_QUERY_END__

__USER_NORMALIZED_QUERY_START__
${preQuery.normalizedText || 'No normalized query available'}
__USER_NORMALIZED_QUERY_END__

`;
  }

  private createSearchResultsSummary(
    searchResults: any,
    originalPrompt: string,
  ): string {
    let summary = `🔍 **Knowledge Base Search Results**\n\n`;
    summary += `**Query:** ${originalPrompt}\n\n`;

    // Check if this is a TopResultsResponse (multiple search types) or individual SearchResults
    if (searchResults.searchTypesExecuted) {
      // This is from topResults - handle multiple search types
      const searchTypesExecuted = searchResults.searchTypesExecuted || [];
      const totalSearchTypes = searchResults.totalSearchTypes || 0;

      summary += `**Search Types Executed:** ${totalSearchTypes} (${searchTypesExecuted.join(', ')})\n\n`;

      // Show results from each search type
      for (const searchType of searchTypesExecuted) {
        const results = searchResults[searchType];
        if (results) {
          summary += `**${searchType}:**\n`;
          Object.keys(results).forEach((knowledgeBase) => {
            const kbResults = results[knowledgeBase];
            if (Array.isArray(kbResults) && kbResults.length > 0) {
              summary += `  ${knowledgeBase}: ${kbResults.length} results\n`;
              // Show top result
              const topResult = kbResults[0];
              if (
                topResult.conversationTextNormalized ||
                topResult.contextDocumentTextNormalized
              ) {
                const text =
                  topResult.conversationTextNormalized ||
                  topResult.contextDocumentTextNormalized;
                summary += `    → ${text.substring(0, 100)}...\n`;
                summary += `    → Confidence: ${topResult.confidence}\n`;
              }
            }
          });
          summary += `\n`;
        }
      }
    } else {
      // This is from individual search method - handle single SearchResults
      summary += `**Search Type:** Individual Search\n\n`;

      // Calculate total results
      let totalResults = 0;
      Object.keys(searchResults).forEach((knowledgeBase) => {
        const kbResults = searchResults[knowledgeBase];
        if (Array.isArray(kbResults)) {
          totalResults += kbResults.length;
        }
      });

      summary += `**Total Results:** ${totalResults}\n\n`;

      // Show results from each knowledge base
      Object.keys(searchResults).forEach((knowledgeBase) => {
        const kbResults = searchResults[knowledgeBase];
        if (Array.isArray(kbResults) && kbResults.length > 0) {
          summary += `**${knowledgeBase}:** ${kbResults.length} results\n`;
          // Show top result
          const topResult = kbResults[0];
          if (
            topResult.conversationTextNormalized ||
            topResult.contextDocumentTextNormalized
          ) {
            const text =
              topResult.conversationTextNormalized ||
              topResult.contextDocumentTextNormalized;
            summary += `  → ${text.substring(0, 100)}...\n`;
            summary += `  → Confidence: ${topResult.confidence}\n`;
          }
          summary += `\n`;
        }
      });
    }

    summary += `*Knowledge base search completed successfully.*`;
    return summary;
  }
}
