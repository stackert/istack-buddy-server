import { Injectable, Logger } from '@nestjs/common';

export interface KnowledgeBaseSearchRequest {
  kb: string; // slack:channel or slack:all
}

export interface KnowledgeBaseSearchResult {
  message_link: string;
  excerpt_text: string;
  relevance_score: number;
  original_post_date?: string;
  author?: string;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  /**
   * Search knowledge base for relevant content
   * @param request - Search request containing kb parameter
   * @returns Array of search results
   */
  public async getSearchResults(
    request: KnowledgeBaseSearchRequest,
  ): Promise<KnowledgeBaseSearchResult[]> {
    this.logger.log(`Searching knowledge base for: ${request.kb}`);

    // Parse the kb parameter
    const kbValue = request.kb;

    // For now, return fake data regardless of the kb value
    // In the future, this will be replaced with actual search logic
    return this.getFakeSearchResults(kbValue);
  }

  /**
   * Get fake search results for development/testing
   * @param kbValue - The knowledge base identifier
   * @returns Array of fake search results
   */
  private getFakeSearchResults(kbValue: string): KnowledgeBaseSearchResult[] {
    const baseResults: KnowledgeBaseSearchResult[] = [
      {
        message_link:
          'https://slack.com/app_redirect?channel=C1234567890&message_ts=1234567890.123456',
        excerpt_text:
          'This is a helpful message about form configuration and troubleshooting. It contains useful information about setting up form fields and validation rules.',
        relevance_score: 0.95,
        original_post_date: '2024-01-15T10:30:00Z',
        author: 'U1234567890',
      },
      {
        message_link:
          'https://slack.com/app_redirect?channel=C1234567890&message_ts=1234567891.123456',
        excerpt_text:
          "Here's how to fix SSO auto-fill issues: First, check your field mapping configuration. Make sure the SSO provider is properly configured and the field names match exactly.",
        relevance_score: 0.87,
        original_post_date: '2024-01-14T14:20:00Z',
        author: 'U0987654321',
      },
      {
        message_link:
          'https://slack.com/app_redirect?channel=C1234567890&message_ts=1234567892.123456',
        excerpt_text:
          'For F4SF integration problems, verify your workflow configuration and check the data mapping between systems. Common issues include missing required fields and incorrect data types.',
        relevance_score: 0.78,
        original_post_date: '2024-01-13T09:15:00Z',
        author: 'U1122334455',
      },
    ];

    // Add search parameters to each result's excerpt_text
    const resultsWithParams = baseResults.map((result) => ({
      ...result,
      excerpt_text: `${result.excerpt_text} {kb: ${kbValue}}`,
    }));

    // Customize results based on kb value
    if (kbValue === 'slack:cx-formstack') {
      return resultsWithParams.map((result) => ({
        ...result,
        excerpt_text: result.excerpt_text.replace(
          /form configuration|SSO|F4SF/g,
          'Forms Core',
        ),
      }));
    } else if (kbValue === 'slack:forms-sso-autofill') {
      return resultsWithParams.map((result) => ({
        ...result,
        excerpt_text: result.excerpt_text.replace(
          /form configuration|Forms Core|F4SF/g,
          'SSO',
        ),
      }));
    } else if (kbValue === 'slack:cx-f4sf') {
      return resultsWithParams.map((result) => ({
        ...result,
        excerpt_text: result.excerpt_text.replace(
          /form configuration|Forms Core|SSO/g,
          'F4SF',
        ),
      }));
    }

    // Default return for 'slack:all' or any other value
    return resultsWithParams;
  }
}
