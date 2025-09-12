import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { RobotService } from '../robots/robot.service';
import { AbstractRobotChat } from '../robots/AbstractRobotChat';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { TConversationMessageContentString } from '../ConversationLists/types';

@Injectable()
export class KnowledgeBaseJobExecutor implements IntentHandler {
  private readonly logger = new Logger(KnowledgeBaseJobExecutor.name);
  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
    private readonly iStackInfoService: IStackInfoService,
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
      // 1. Fetch preQuery using service wrapper
      const query = intentData.originalUserPrompt;
      if (!query) {
        throw new Error('originalUserPrompt is required but was not provided');
      }
      const preQuery =
        await this.iStackInfoService.knowledgeBase.preQuery(query);

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

      // Enhanced callbacks that stream to user AND save final message
      const enhancedCallbacks: IStreamingCallbacks = {
        ...callbacks,
        conversationId: conversationId,
        onFullMessageReceived: async (message) => {
          // Save the final robot response to conversation
          await this.chatManagerService.addMessage({
            content: message.content,
            conversationId: conversationId,
            fromUserId: null,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.USER,
          });
          this.logger.log('KnobbyOpenAiSearch response saved to conversation');
        },
      };

      // Create message for the robot with the structured prompt
      const robotMessage =
        await this.chatManagerService.createMessage<TConversationMessageContentString>(
          {
            conversationId: conversationId,
            content: {
              type: 'text/plain',
              payload: robotPrompt,
            },
            fromUserId: null,
            fromRole: UserRole.USER,
            toRole: UserRole.ROBOT,
          },
        );

      // Call the robot directly with streaming response
      await (knobbyRobot as AbstractRobotChat).acceptMessageStreamResponse(
        robotMessage,
        enhancedCallbacks,
      );
    } catch (error) {
      this.logger.error(`Knowledge base search failed: ${error.message}`);
      callbacks.onError?.(error);
    }
  }

  private async fetchSearchResults(preQuery: any): Promise<any> {
    this.logger.log(`Fetching search results using preQuery data`);

    // The /top-results endpoint expects the FULL PreQueryDto object as input
    return await this.iStackInfoService.knowledgeBase.topResults(preQuery);
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
}
