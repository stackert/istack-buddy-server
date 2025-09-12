/**
 * Usage Examples for IStackInfoService
 *
 * These examples demonstrate how to use the Information Services API client
 * in real applications. This file is for documentation purposes only.
 */

import { IStackInfoService } from '../istack-info.service';

export class IStackInfoServiceExamples {
  constructor(private readonly iStackInfoService: IStackInfoService) {}

  /**
   * Example 1: Health Check and Service Status
   */
  async checkServiceHealth(): Promise<void> {
    try {
      // Check main service health
      const health = await this.iStackInfoService.health();
      console.log('Service Health:', health);

      // Check context dynamic health
      const contextHealth =
        await this.iStackInfoService.contextDynamic.health();
      console.log('Context Dynamic Health:', contextHealth);

      // Check Sumo service status
      const sumoStatus = await this.iStackInfoService.sumoReport.getStatus();
      console.log('Sumo Status:', sumoStatus);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Example 2: Knowledge Base Search Workflow
   */
  async searchKnowledgeBase(): Promise<void> {
    try {
      const userQuery = 'SAML authentication setup issues';

      // Step 1: Pre-process the query to extract keywords and metadata
      const preQuery =
        await this.iStackInfoService.knowledgeBase.preQuery(userQuery);
      console.log('Pre-query analysis:', preQuery);

      // Step 2: Perform top results search using the full preQuery data
      const searchResults =
        await this.iStackInfoService.knowledgeBase.topResults(preQuery);

      console.log('Search Results:', searchResults);

      // Step 3: If needed, get more specific results using keywords
      if (Object.keys(searchResults).length === 0) {
        const keywordResults =
          await this.iStackInfoService.knowledgeBase.keywordSearch({
            keywords: preQuery.keywords,
            limit: 5,
          });
        console.log('Keyword Search Results:', keywordResults);
      }
    } catch (error) {
      console.error('Knowledge base search failed:', error);
    }
  }

  /**
   * Example 3: Context Dynamic Data Retrieval
   */
  async getContextData(): Promise<void> {
    try {
      // Get form context with all related data
      const formContext =
        await this.iStackInfoService.contextDynamic.getForm('123456');
      console.log('Form Context:', formContext);

      // Get account context
      const accountContext =
        await this.iStackInfoService.contextDynamic.getAccount('789012');
      console.log('Account Context:', accountContext);

      // Get auth provider context
      const authContext =
        await this.iStackInfoService.contextDynamic.getAuthProvider('auth123');
      console.log('Auth Provider Context:', authContext);
    } catch (error) {
      console.error('Context data retrieval failed:', error);
    }
  }

  /**
   * Example 4: Sumo Logic Report Generation Workflow
   */
  async generateSumoReport(): Promise<void> {
    try {
      // Step 1: Submit a Sumo query for background processing
      const job = await this.iStackInfoService.sumoReport.submitQuery({
        queryName: 'searchSumoLogSubmissionErrors',
        subject: {
          formId: '123456',
          startDate: '2025-01-01',
          endDate: '2025-01-07',
        },
      });

      console.log('Job submitted:', job);

      // Step 2: Poll for job status
      let jobStatus = await this.iStackInfoService.sumoReport.jobs.getStatus(
        job.jobId,
      );
      console.log('Initial job status:', jobStatus);

      // Step 3: Wait for completion (in real apps, use proper polling with delays)
      while (jobStatus.status === 'pending' || jobStatus.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        jobStatus = await this.iStackInfoService.sumoReport.jobs.getStatus(
          job.jobId,
        );
        console.log('Job status update:', jobStatus);
      }

      // Step 4: Get results if completed successfully
      if (jobStatus.status === 'completed') {
        const results = await this.iStackInfoService.sumoReport.jobs.getResults(
          job.jobId,
        );
        console.log('Job results:', results);

        // Step 5: If there's a file, get file details
        if (results.fileId) {
          const fileInfo = await this.iStackInfoService.sumoReport.files.get(
            results.fileId,
          );
          console.log('Result file info:', fileInfo);
        }
      } else {
        console.error('Job failed:', jobStatus);
      }
    } catch (error) {
      console.error('Sumo report generation failed:', error);
    }
  }

  /**
   * Example 5: Sumo Syntax Estimation
   */
  async estimateSumoSyntax(): Promise<void> {
    try {
      const syntaxEstimate =
        await this.iStackInfoService.sumoSyntax.estimateQuerySyntax({
          description:
            'Find all form submission errors in the last 7 days for form ID 123456',
          context: {
            formId: '123456',
            timeRange: '7d',
          },
        });

      console.log('Estimated Sumo Query:', syntaxEstimate.estimatedQuery);
      console.log('Confidence:', syntaxEstimate.confidence);
      console.log('Explanation:', syntaxEstimate.explanation);
      console.log('Suggested Parameters:', syntaxEstimate.suggestedParameters);
    } catch (error) {
      console.error('Syntax estimation failed:', error);
    }
  }

  /**
   * Example 6: Cache Management
   */
  async manageCaches(): Promise<void> {
    try {
      // Get cached metadata (these are automatically cached for 1 week)
      const knowledgeBases =
        await this.iStackInfoService.knowledgeBase.listKnowledgeBases();
      console.log('Available Knowledge Bases:', knowledgeBases);

      const channels =
        await this.iStackInfoService.knowledgeBase.listChannels();
      console.log('Available Channels:', channels);

      const domains = await this.iStackInfoService.knowledgeBase.listDomains();
      console.log('Available Domains:', domains);

      // Get Sumo-related metadata
      const queryList = await this.iStackInfoService.sumoReport.getQueryList();
      console.log('Available Sumo Queries:', queryList);

      const knownMessages =
        await this.iStackInfoService.sumoReport.getKnownMessages();
      console.log('Known Message Types:', knownMessages);

      // Refresh all caches (typically done periodically by a scheduled job)
      await this.iStackInfoService.refreshLookUpCaches();
      console.log('All caches refreshed');
    } catch (error) {
      console.error('Cache management failed:', error);
    }
  }

  /**
   * Example 7: Specific Search Types
   */
  async demonstrateSpecificSearches(): Promise<void> {
    try {
      const userQuery = 'authentication issues';

      // Get preQuery data first
      const preQuery =
        await this.iStackInfoService.knowledgeBase.preQuery(userQuery);

      // Use specific search types with data from preQuery
      const keywordResults =
        await this.iStackInfoService.knowledgeBase.keywordSearch({
          keywords: preQuery.keywords,
          limit: 5,
        });

      const semanticResults =
        await this.iStackInfoService.knowledgeBase.semanticSearch({
          userPromptText: preQuery.userPromptText,
          limit: 5,
        });

      console.log('Keyword results:', keywordResults);
      console.log('Semantic results:', semanticResults);
    } catch (error) {
      console.error('Specific searches failed:', error);
    }
  }

  /**
   * Example 8: Error Handling Best Practices
   */
  async demonstrateErrorHandling(): Promise<void> {
    try {
      // This will likely fail due to invalid form ID
      await this.iStackInfoService.contextDynamic.getForm('invalid-form-id');
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log('Form not found - this is expected');
      } else if (error.statusCode === 401) {
        console.error('Authentication failed - check API key');
      } else if (error.statusCode === 429) {
        console.log('Rate limited - implement backoff strategy');
        // Implement exponential backoff retry logic here
      } else if (error.statusCode === 503) {
        console.error('Service unavailable - implement circuit breaker');
      } else {
        console.error('Unexpected error:', error);
      }
    }
  }
}

/**
 * Example Integration in a NestJS Controller
 */
export class ExampleController {
  constructor(private readonly iStackInfoService: IStackInfoService) {}

  async searchEndpoint(query: string) {
    // Pre-process query
    const preQuery = await this.iStackInfoService.knowledgeBase.preQuery(query);

    // Search with AI technical observation for context
    const results =
      await this.iStackInfoService.knowledgeBase.topResults(preQuery);

    return {
      query,
      aiObservation: preQuery.aiTechnicalObservation,
      results,
      metadata: {
        domains: preQuery.domains,
        keywords: preQuery.keywords,
      },
    };
  }

  async getFormAnalysis(formId: string) {
    // Get form context
    const formContext =
      await this.iStackInfoService.contextDynamic.getForm(formId);

    // Search for related issues
    const issues = await this.iStackInfoService.knowledgeBase.semanticSearch({
      userPromptText: `form issues ${formContext.data.formName}`,
      limit: 5,
    });

    return {
      form: formContext,
      relatedIssues: issues,
    };
  }
}
