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
          type: 'text/plain',
          payload: `🔄 **Knowledge Base Search Request Received**\n\nSearching for: ${intentData.originalUserPrompt}\nProcessing query...`,
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

      // 3. Format search results into robot context
      const robotContext = this.formatSearchResultsIntoRobotContext(
        searchResults,
        preQuery,
      );

      // 4. Add robot context to conversation
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

  private formatSearchResultsIntoRobotContext(
    searchResults: any,
    preQuery: any,
  ): string {
    const searchTypesExecuted = searchResults.searchTypesExecuted || [];

    let prompt = `**ROBOT_INSTRUCTION_START**
The end user has has made an inquiry. We have search relevant knowledge bases and found best possible results. We used several search algorithms which will likely find the same results or different results (hence there may be duplicate results).

Please review the users original query the normalized user query and search results and respond the best you can to the end-user inquiry. For any search result you use in your response please cite the resource (should be included with each search result).

If you find none of the search results are useful - it is ok to ignore. If you are not able to use any of the search results you should say that.

**IMPORTANT** End the response with a positive affirmation 'We appreciate you', 'team work makes dream work', Think of something original. Also, you should ask them to use the istackbuddy /feedback feature

Example Response:

Based on the knowledge base search and a few things I knew already, I think ...

You're the best.

If you benefitted (or did not) from iStackBuddy's search, please responds with
@iStackBuddy /feedback - 'this was pretty good but..' or 'This was the most awesome ever!'

**ROBOT_INSTRUCTION_END**

___SEARCH_RESULTS_START__

`;

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
