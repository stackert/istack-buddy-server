import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import {
  FileManagerService,
  STORAGE_CLASS,
} from '../file-manager/file-manager.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KnowledgeBaseJobExecutor implements IntentHandler {
  private readonly logger = new Logger(KnowledgeBaseJobExecutor.name);
  private readonly fileStorageBasePath = 'file-storage-server/session-public';

  constructor(
    private readonly fileManagerService: FileManagerService,
    private readonly chatManagerService: ChatManagerService,
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
      // 1. Parse search parameters from intent data
      const searchParams = this.parseSearchParameters(intentData);

      // 2. Execute knowledge base search
      const searchResults = await this.executeKnowledgeBaseSearch(searchParams);

      // 3. Move results to session-public directory
      const fileLinks = await this.moveResultsToSessionPublic(
        searchResults,
        conversationId,
        searchParams,
      );

      // 4. Send file links message to conversation
      await this.sendFileLinksMessage(
        fileLinks,
        conversationId,
        intentData.originalUserPrompt,
      );

      // 5. Process search results and send analysis
      await this.processSearchResultsAndSendAnalysis(
        searchResults,
        conversationId,
      );
    } catch (error) {
      this.logger.error(`Knowledge base search failed: ${error.message}`);
      callbacks.onError?.(error);
    }
  }

  private parseSearchParameters(intentData: any): any {
    const subIntents = intentData.subIntents || [];
    const subjects = intentData.subjects || {};

    // Map subIntents to search types
    const searchType = this.mapSubIntentToSearchType(subIntents[0]);

    return {
      searchType,
      query: subjects.query?.[0] || intentData.originalUserPrompt || 'form',
      minConfidence: subjects.minConfidence?.[0] || 0.7,
      pageSize: subjects.pageSize?.[0] || 10,
      originalText: intentData.originalUserPrompt,
    };
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

  private async executeKnowledgeBaseSearch(searchParams: any): Promise<any> {
    this.logger.log(
      `Executing knowledge base search: ${searchParams.searchType} for query: ${searchParams.query}`,
    );

    try {
      // Step 1: Submit preQuery for analysis
      const preQueryResponse = await this.submitPreQuery(searchParams);

      // Step 2: Submit top-results search using preQuery response
      const searchResults = await this.submitTopResultsSearch(preQueryResponse);

      return searchResults;
    } catch (error) {
      this.logger.error(`Knowledge base search failed: ${error.message}`);
      throw error;
    }
  }

  private async submitPreQuery(searchParams: any): Promise<any> {
    const baseUrl =
      process.env.ISTACK_INFO_SERVICE_BASE_URL || 'http://localhost:3001';
    const apiKey =
      process.env.ISTACK_INFO_SERVICE_API_KEY || '_THE_FAKE_INFO_SERVICE_KEY_';

    const preQueryPayload = {
      query: searchParams.query,
      minConfidence: searchParams.minConfidence,
      pageSize: searchParams.pageSize,
    };

    this.logger.log(`Submitting preQuery: ${JSON.stringify(preQueryPayload)}`);

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

  private async submitTopResultsSearch(preQueryResponse: any): Promise<any> {
    const baseUrl =
      process.env.ISTACK_INFO_SERVICE_BASE_URL || 'http://localhost:3001';
    const apiKey =
      process.env.ISTACK_INFO_SERVICE_API_KEY || '_THE_FAKE_INFO_SERVICE_KEY_';

    this.logger.log(`Submitting top-results search with preQuery data`);

    const response = await fetch(
      `${baseUrl}/information-services/knowledge-bases/top-results`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(preQueryResponse),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Top-results search failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  private async moveResultsToSessionPublic(
    searchResults: any,
    conversationId: string,
    searchParams: any,
  ): Promise<string[]> {
    const sessionDir = path.join(this.fileStorageBasePath, conversationId);

    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      this.logger.log(`Created session directory: ${sessionDir}`);
    }

    // Generate filename: {conversation-id}-{searchType}-{timestamp}.json
    const timestamp = this.formatDateForFilename(new Date().toISOString());
    const fileName = `${conversationId}-${searchParams.searchType}-${timestamp}.json`;
    const filePath = path.join(sessionDir, fileName);

    // Write search results to file
    fs.writeFileSync(filePath, JSON.stringify(searchResults, null, 2));

    // Create file link
    const fileLink = `file:///file-storage/session-public/${conversationId}/${fileName}`;

    this.logger.log(`Saved knowledge base search results to ${filePath}`);

    return [fileLink];
  }

  private formatDateForFilename(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private async sendFileLinksMessage(
    fileLinks: string[],
    conversationId: string,
    originalPrompt: string,
  ): Promise<void> {
    const message = `Knowledge base search completed for: "${originalPrompt}"\n\nResults saved to:\n${fileLinks.join('\n')}`;

    await this.chatManagerService.addMessage({
      content: {
        type: 'text/plain',
        payload: message,
      },
      conversationId,
      fromUserId: null,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    this.logger.log(
      `Sent file links message to conversation ${conversationId}`,
    );
  }

  private async processSearchResultsAndSendAnalysis(
    searchResults: any,
    conversationId: string,
  ): Promise<void> {
    // Simple analysis for now - will be enhanced later
    const analysisText = this.generateSearchAnalysis(searchResults);

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

    this.logger.log(`Sent search analysis to conversation ${conversationId}`);
  }

  private generateSearchAnalysis(searchResults: any): string {
    const searchTypesExecuted = searchResults.searchTypesExecuted || [];
    const totalSearchTypes = searchResults.totalSearchTypes || 0;

    let analysis = `Knowledge Base Search Analysis:

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
