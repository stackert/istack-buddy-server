import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface KnowledgeBaseSearchRequest {
  q: string;
  channels: string[] | string;
}

export interface KnowledgeBaseSearchResult {
  message_link: string;
  excerpt_text: string;
  relevance_score: number;
  channelId: string;
  original_post_date?: string;
  author?: string;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private readonly knowledgeBaseUrl: string;

  constructor(private readonly httpService: HttpService) {
    this.knowledgeBaseUrl = process.env.ISTACK_KNOWLEDGE_BUDDY || 'http://localhost:3502/';
    if (!this.knowledgeBaseUrl.endsWith('/')) {
      this.knowledgeBaseUrl += '/';
    }
  }

  async getSearchResults(request: KnowledgeBaseSearchRequest): Promise<KnowledgeBaseSearchResult[]> {
    this.logger.log(`Searching knowledge base: "${request.q}" in channels: ${JSON.stringify(request.channels)}`);

    try {
      const apiUrl = `${this.knowledgeBaseUrl}istack-buddy/search/slack`;
      
      // LOG THE EXACT POST BODY
      this.logger.log(`API POST body: ${JSON.stringify(request)}`);
      this.logger.log(`API URL: ${apiUrl}`);
      
      // WRITE TO FILE FOR DEBUGGING
      const fs = require('fs');
      fs.appendFileSync('/tmp/kb-debug.log', `[${new Date().toISOString()}] POST body: ${JSON.stringify(request, null, 2)}\nURL: ${apiUrl}\n\n`);
      
      const response = await firstValueFrom(this.httpService.post(apiUrl, request));
      
      // The API returns {searchResult: [...]} not [...] directly
      const results = response.data?.searchResult || [];
      
      this.logger.log(`Knowledge base returned ${results.length} results`);
      this.logger.log(`Response status: ${response.status}`);
      
      // Also log to file
      fs.appendFileSync('/tmp/kb-debug.log', `Response status: ${response.status}\nFound ${results.length} results\n\n`);
      
      return results;
      
    } catch (error: any) {
      this.logger.error('Knowledge base API error:', error.message);
      throw new Error('KNOWLEDGE_BUDDY_OFFLINE');
    }
  }
}