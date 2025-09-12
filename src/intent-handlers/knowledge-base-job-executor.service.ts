import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { RobotService } from '../robots/robot.service';

@Injectable()
export class KnowledgeBaseJobExecutor implements IntentHandler {
  private readonly logger = new Logger(KnowledgeBaseJobExecutor.name);
  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
  ) {}

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

  async executeIntent(
    intentData: any,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    this.logger.log('Starting knowledge base search workflow');

    const conversationId = (callbacks as any).conversationId;
    if (!conversationId) {
      throw new Error('conversationId is required in callbacks');
    }

    try {
      // 1. Fetch preQuery from mock server
      const preQuery = await this.fetchPreQuery(intentData);

      // 2. Fetch search results from mock server using preQuery
      const searchResults = await this.fetchSearchResults(preQuery);

      // 3. Format search results into robot prompt
      const robotPrompt = this.formatSearchResultsIntoRobotPrompt(
        searchResults,
        preQuery,
      );
      this.logger.log('Robot prompt prepared (noOp for now):', robotPrompt);

      // 4. Send structured prompt as robot-only message
      await this.chatManagerService.addMessage({
        content: {
          type: 'content/document',
          payload: robotPrompt,
        },
        conversationId: conversationId,
        fromUserId: null,
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.ROBOT, // Robot sees but user doesn't
      });

      this.logger.log('Sent structured knowledge base prompt to robot');

      // 5. Use KnobbyOpenAiSearch robot to process the prompt
      const knobbyRobot =
        this.robotService.getRobotByName('KnobbyOpenAiSearch');
      if (!knobbyRobot) {
        throw new Error('KnobbyOpenAiSearch robot not found');
      }

      // Create robot callbacks for the response
      const robotCallbacks: IStreamingCallbacks = {
        conversationId: conversationId,
        onStreamStart: () => {},
        onStreamChunkReceived: () => {},
        onStreamFinished: () => {},
        onFullMessageReceived: async (message) => {
          // Robot response will be sent directly to conversation
          await this.chatManagerService.addMessage({
            content: message.content,
            conversationId: conversationId,
            fromUserId: null,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.USER,
          });
          this.logger.log('KnobbyOpenAiSearch response sent to conversation');
        },
        onError: (error) => {
          this.logger.error('KnobbyOpenAiSearch error:', error);
        },
      };

      // Send the prompt to the robot using handleIntentWithTools
      await (knobbyRobot as any).handleIntentWithTools(
        {
          intent: 'searchKnowledgeBase',
          originalUserPrompt: robotPrompt,
          subjects: intentData.subjects,
        },
        robotCallbacks,
      );
    } catch (error) {
      this.logger.error(`Knowledge base search failed: ${error.message}`);
      callbacks.onError?.(error);
    }
  }

  private async fetchPreQuery(intentData: any): Promise<any> {
    const subjects = intentData.subjects || {};
    const baseUrl = process.env.ISTACK_INFO_SERVICE_BASE_URL;
    const apiKey = process.env.ISTACK_INFO_SERVICE_API_KEY;

    const preQueryPayload = {
      query: subjects.query?.[0] || intentData.originalUserPrompt || 'form',
      minConfidence: subjects.minConfidence?.[0] || 0.7,
      pageSize: subjects.pageSize?.[0] || 10,
    };

    this.logger.log(`Fetching preQuery: ${JSON.stringify(preQueryPayload)}`);

    const response = await fetch(
      `${baseUrl}/information-services/knowledge-bases/preQuery`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(preQueryPayload),
      },
    );

    if (!response.ok) {
      throw new Error(
        `PreQuery failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  private mapSubIntentToSearchType(subIntent: string): string {
    const mapping: Record<string, string> = {
      semanticSearch: 'semantic-search',
      keywordSearch: 'keyword-search',
      nounSearch: 'noun-search',
      properNounSearch: 'proper-noun-search',
      domainSearch: 'domain-search',
      freeTextSearch: 'free-text-search',
      topResults: 'top-results',
    };

    const searchType = mapping[subIntent];
    if (!searchType) {
      throw new Error(
        `Unsupported knowledge base search subIntent: ${subIntent}`,
      );
    }

    return searchType;
  }

  private async fetchSearchResults(preQuery: any): Promise<any> {
    const baseUrl =
      process.env.ISTACK_INFO_SERVICE_BASE_URL || 'http://localhost:3001';
    const apiKey =
      process.env.ISTACK_INFO_SERVICE_API_KEY || '_THE_FAKE_INFO_SERVICE_KEY_';

    this.logger.log(`Fetching search results using preQuery data`);

    const response = await fetch(
      `${baseUrl}/information-services/knowledge-bases/top-results`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(preQuery),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Search results failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  private formatSearchResultsIntoRobotPrompt(
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

    // Extract key information from each search type
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
  text: ${result.citations?.text || 'No citation'}
  link: ${result.citations?.link || 'No link'}
}

__${searchType}.${knowledgeBase}[${index}]_END__

`;
            });
          }
        });
      }
    }

    prompt += `___SEARCH_RESULTS_END__

__USER_ORIGINAL_QUERY_START__
${preQuery.originalText || 'No original query available'}
__USER_ORIGINAL_QUERY_END__

__USER_NORMALIZED_QUERY_START__
${preQuery.normalizedText || 'No normalized query available'}
__USER_NORMALIZED_QUERY_END__

`;

    return prompt;
  }

  private async sendSearchResultsToConversation(
    searchResults: any,
    conversationId: string,
    originalPrompt: string,
  ): Promise<void> {
    // Generate analysis of search results
    const analysisText = this.generateSearchAnalysis(
      searchResults,
      originalPrompt,
    );

    // Send results directly to conversation
    await this.chatManagerService.addMessage({
      content: {
        type: 'content/document',
        payload: analysisText,
      },
      conversationId,
      fromUserId: null,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    this.logger.log(
      `Sent knowledge base search results to conversation ${conversationId}`,
    );
  }

  private generateSearchAnalysis(
    searchResults: any,
    originalPrompt: string,
  ): string {
    const searchTypesExecuted = searchResults.searchTypesExecuted || [];
    const totalSearchTypes = searchResults.totalSearchTypes || 0;

    let analysis = `Knowledge Base Search Results for: "${originalPrompt}"

Search Types Executed: ${totalSearchTypes}
Types: ${searchTypesExecuted.join(', ')}

`;

    // Analyze each search type
    for (const searchType of searchTypesExecuted) {
      const results = searchResults[searchType];
      if (results) {
        analysis += `\n${searchType}:\n`;

        Object.keys(results).forEach((knowledgeBase) => {
          const kbResults = results[knowledgeBase];
          if (Array.isArray(kbResults) && kbResults.length > 0) {
            analysis += `  ${knowledgeBase}: ${kbResults.length} results\n`;

            // Show first result summary
            const firstResult = kbResults[0];
            if (firstResult.confidence) {
              analysis += `    Top result confidence: ${firstResult.confidence}\n`;
            }
            if (firstResult.channelId) {
              analysis += `    Channel: ${firstResult.channelId}\n`;
            }
          }
        });
      }
    }

    analysis += `\nKnowledge base search completed successfully.`;

    return analysis;
  }
}
