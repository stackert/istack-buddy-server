import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  HealthResponse,
  PreQueryInputDto,
  PreQueryResponse,
  KeywordSearchInput,
  NounSearchInput,
  ProperNounSearchInput,
  DomainSearchInput,
  FreeTextSearchInput,
  SemanticSearchInput,
  SearchResults,
  TopResultsResponse,
  KnowledgeBasesResponse,
  ChannelsResponse,
  DomainsResponse,
  ContextDynamicResponse,
  AccountContextResponse,
  FormContextResponse,
  FormFieldsObservationsSourceResponse,
  AuthProviderContextResponse,
  SumoJobSubmissionRequest,
  SumoJobSubmissionResponse,
  SumoJobStatusResponse,
  SumoJobResultsResponse,
  SumoJobCancelResponse,
  SumoJobsListResponse,
  SumoQueryListResponse,
  SumoKnownMessagesResponse,
  SumoSubmitActionTypesResponse,
  SumoStatusResponse,
  SumoFileResponse,
  SumoFileDeleteResponse,
  SumoFilesListResponse,
  SumoSyntaxEstimateRequest,
  SumoSyntaxEstimateResponse,
  ApiError,
} from './types/istack-info-service.types';

@Injectable()
export class IStackInfoService implements OnModuleDestroy {
  private readonly logger = new Logger(IStackInfoService.name);
  private apiKey: string;
  private baseUrl: string;
  private httpClient: AxiosInstance;
  private readonly redis: Redis;
  private isInitialized = false;
  private readonly activeSumoJobs = new Map<string, Date>(); // Track active job IDs with start time

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // WE NEVER USE FALL BACKS FOR CONFIG
      this.apiKey = process.env.ISTACK_INFO_SERVICE_API_KEY as string;
      this.baseUrl = process.env.ISTACK_INFO_SERVICE_BASE_URL as string;

      // DEBUG: Log configuration
      this.logger.log(`IStackInfoService configured with:`);
      this.logger.log(`Base URL: ${this.baseUrl}`);
      this.logger.log(`API Key: ${this.apiKey ? '[CONFIGURED]' : '[MISSING]'}`);

      if (!this.apiKey) {
        throw new Error(
          'ISTACK_INFO_SERVICE_API_KEY environment variable is required',
        );
      }

      if (!this.baseUrl) {
        throw new Error(
          'ISTACK_INFO_SERVICE_BASE_URL environment variable is required',
        );
      }

      // Create axios instance with default configuration
      this.httpClient = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000, // 30 seconds
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      // Add response interceptor for error handling
      this.httpClient.interceptors.response.use(
        (response) => response,
        (error) => {
          this.logger.error(
            `API request failed: ${error.message}`,
            error.response?.data,
          );
          throw this.transformError(error);
        },
      );

      this.isInitialized = true;
      this.logger.log('IStackInfoService initialized');
    } catch (error) {
      this.logger.error(
        'Failed to initialize IStackInfoService:',
        error.message,
      );
      throw error;
    }
  }

  onModuleDestroy() {
    this.logger.log('IStackInfoService destroyed');
  }

  // Health check
  async health(): Promise<HealthResponse> {
    this.logger.debug('Performing health check');
    return this.makeRequest<HealthResponse>(
      'OPTIONS',
      '/information-services/context-sumo-report/status',
    );
  }

  // Knowledge base methods
  knowledgeBase = {
    preQuery: async (query: string): Promise<PreQueryResponse> => {
      this.logger.debug(`Pre-processing query: ${query.substring(0, 100)}`);
      return this.makeRequest<PreQueryResponse>(
        'POST',
        '/information-services/knowledge-bases/preQuery',
        { query } as PreQueryInputDto,
      );
    },

    keywordSearch: async (
      input: KeywordSearchInput,
    ): Promise<SearchResults> => {
      this.logger.debug(
        `Keyword search with ${input.keywords.length} keywords`,
      );
      return this.makeRequest<SearchResults>(
        'POST',
        '/information-services/knowledge-bases/keyword-search',
        input,
      );
    },

    nounSearch: async (input: NounSearchInput): Promise<SearchResults> => {
      this.logger.debug(`Noun search with ${input.nouns.length} nouns`);
      return this.makeRequest<SearchResults>(
        'POST',
        '/information-services/knowledge-bases/noun-search',
        input,
      );
    },

    properNounSearch: async (
      input: ProperNounSearchInput,
    ): Promise<SearchResults> => {
      this.logger.debug(
        `Proper noun search with ${input.properNouns.length} proper nouns`,
      );
      return this.makeRequest<SearchResults>(
        'POST',
        '/information-services/knowledge-bases/proper-noun-search',
        input,
      );
    },

    domainSearch: async (input: DomainSearchInput): Promise<SearchResults> => {
      this.logger.debug(`Domain search with ${input.domains.length} domains`);
      return this.makeRequest<SearchResults>(
        'POST',
        '/information-services/knowledge-bases/domain-search',
        input,
      );
    },

    freeTextSearch: async (
      input: FreeTextSearchInput,
    ): Promise<SearchResults> => {
      this.logger.debug(
        `Free text search with ${input.freeText?.length || 0} terms`,
      );
      return this.makeRequest<SearchResults>(
        'POST',
        '/information-services/knowledge-bases/free-text-search',
        input,
      );
    },

    semanticSearch: async (
      input: SemanticSearchInput,
    ): Promise<SearchResults> => {
      this.logger.debug(
        `Semantic search: ${input.userPromptText.substring(0, 100)}`,
      );
      return this.makeRequest<SearchResults>(
        'POST',
        '/information-services/knowledge-bases/semantic-search',
        input,
      );
    },

    listKnowledgeBases: (): Promise<KnowledgeBasesResponse> =>
      this.getCachedMetaData<KnowledgeBasesResponse>('listKnowledgeBases'),

    listChannels: (): Promise<ChannelsResponse> =>
      this.getCachedMetaData<ChannelsResponse>('listChannels'),

    listDomains: (): Promise<DomainsResponse> =>
      this.getCachedMetaData<DomainsResponse>('listDomains'),

    topResults: async (
      preQueryDto: PreQueryResponse,
    ): Promise<TopResultsResponse> => {
      this.logger.debug('Executing top-results with full preQuery object');
      return this.makeRequest<TopResultsResponse>(
        'POST',
        '/information-services/knowledge-bases/top-results',
        preQueryDto,
      );
    },
  };

  // Context dynamic methods
  contextDynamic = {
    get: async (
      entityType: string,
      entityId: string,
    ): Promise<ContextDynamicResponse> => {
      this.logger.debug(
        `Getting context dynamic data for ${entityType}:${entityId}`,
      );
      return this.makeRequest<ContextDynamicResponse>(
        'POST',
        `/information-services/context-dynamic/${entityType}`,
        { entityId },
      );
    },

    getAccount: async (accountId: number): Promise<AccountContextResponse> => {
      this.logger.debug(`Getting account context: ${accountId}`);
      return this.makeRequest<AccountContextResponse>(
        'POST',
        '/information-services/context-dynamic/account',
        { accountId },
      );
    },

    getForm: async (formId: number): Promise<FormContextResponse> => {
      this.logger.debug(`Getting form context: ${formId}`);
      return this.makeRequest<FormContextResponse>(
        'POST',
        '/information-services/context-dynamic/form',
        { formId },
      );
    },

    getFormFieldsObservationsSource: async ({
      formId,
    }: {
      formId: number;
    }): Promise<any> => {
      this.logger.debug(`Getting form fields observations source: ${formId}`);
      return this.makeRequest<FormFieldsObservationsSourceResponse>(
        'POST',
        '/information-services/context-dynamic/form-fields-observations-source',
        { formId },
      );
    },

    getAuthProvider: async (
      authProviderId: number,
    ): Promise<AuthProviderContextResponse> => {
      this.logger.debug(`Getting auth provider context: ${authProviderId}`);
      return this.makeRequest<AuthProviderContextResponse>(
        'POST',
        '/information-services/context-dynamic/auth-provider',
        { authProviderId },
      );
    },

    health: (): Promise<HealthResponse> =>
      this.makeRequest<HealthResponse>(
        'POST',
        '/information-services/context-dynamic/health',
      ),
  };

  // Sumo report methods
  sumoReport = {
    submitQuery: async (
      request: SumoJobSubmissionRequest,
    ): Promise<SumoJobSubmissionResponse> => {
      this.logger.debug(
        `Submitting Sumo query: ${request.queryName} for ${JSON.stringify(request.subjects, null, 2)}`,
      );
      // Transform the request to match the API specification
      const apiRequest = {
        queryName: request.queryName,
        subjects: request.subjects || {},
        dateRange: request.dateRange || {},
      };

      this.logger.debug(
        `Transformed API request: ${JSON.stringify(apiRequest, null, 2)}`,
      );

      return this.makeRequest<SumoJobSubmissionResponse>(
        'POST',
        '/information-services/context-sumo-report/query/submit',
        apiRequest,
      );
    },

    submitQueryAndWait: async (
      request: SumoJobSubmissionRequest,
      maxAttempts: number = 300, // 5 minutes at 1 second intervals
      pollIntervalMs: number = 1000,
    ): Promise<any> => {
      let jobId: string | undefined;

      try {
        this.logger.debug(
          `Submitting Sumo query and waiting: ${request.queryName}`,
        );

        // Submit the query
        const submissionResponse = await this.sumoReport.submitQuery(request);
        jobId = submissionResponse.jobId;

        // Track active job with start time
        this.activeSumoJobs.set(jobId, new Date());

        this.logger.debug(
          `Sumo job submitted: ${jobId} (${this.activeSumoJobs.size} active jobs)`,
        );

        // Poll until completed
        let status = 'pending';
        let attempts = 0;

        while (
          (status === 'pending' || status === 'running') &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          const statusResponse = await this.sumoReport.jobs.getStatus(jobId);
          status = statusResponse.status;
          this.logger.debug(
            `Job ${jobId} status: ${status} (attempt ${++attempts})`,
          );
        }

        // Clean up job tracking regardless of outcome
        const jobStartTime = this.activeSumoJobs.get(jobId);
        this.activeSumoJobs.delete(jobId);

        const duration = jobStartTime ? Date.now() - jobStartTime.getTime() : 0;

        if (status !== 'completed') {
          const timeoutSeconds = (maxAttempts * pollIntervalMs) / 1000;
          const timeoutMinutes = Math.floor(timeoutSeconds / 60);
          const remainingSeconds = timeoutSeconds % 60;

          let timeoutMessage = `Sumo job ${jobId} timed out after ${maxAttempts} attempts`;
          if (timeoutMinutes > 0) {
            timeoutMessage += ` (${timeoutMinutes} minutes${remainingSeconds > 0 ? ` and ${remainingSeconds} seconds` : ''})`;
          } else {
            timeoutMessage += ` (${timeoutSeconds} seconds)`;
          }

          this.logger.warn(
            `Job ${jobId} failed after ${Math.round(duration / 1000)}s. ${this.activeSumoJobs.size} jobs still active.`,
          );
          throw new Error(timeoutMessage);
        }

        // Get results and return the full results object
        const resultsResponse = await this.sumoReport.jobs.getResults(jobId);

        this.logger.debug(
          `Job ${jobId} completed successfully in ${Math.round(duration / 1000)}s with ${(resultsResponse as any).records?.length || 0} records. ${this.activeSumoJobs.size} jobs still active.`,
        );

        return resultsResponse;
      } catch (error) {
        // Clean up job tracking on error
        if (jobId) {
          const jobStartTime = this.activeSumoJobs.get(jobId);
          this.activeSumoJobs.delete(jobId);
          const duration = jobStartTime
            ? Date.now() - jobStartTime.getTime()
            : 0;
          this.logger.error(
            `Job ${jobId} failed after ${Math.round(duration / 1000)}s with error: ${error.message}. ${this.activeSumoJobs.size} jobs still active.`,
          );
        }
        throw error;
      }
    },

    getQueryList: (): Promise<SumoQueryListResponse> =>
      this.getCachedMetaData<SumoQueryListResponse>('getQueryList'),

    getKnownMessages: (): Promise<SumoKnownMessagesResponse> =>
      this.getCachedMetaData<SumoKnownMessagesResponse>('getKnownMessages'),

    getSubmitActionTypes: (): Promise<SumoSubmitActionTypesResponse> =>
      this.getCachedMetaData<SumoSubmitActionTypesResponse>(
        'getSubmitActionTypes',
      ),

    getStatus: (): Promise<SumoStatusResponse> => {
      this.logger.debug('Getting Sumo service status');
      return this.makeRequest<SumoStatusResponse>(
        'GET',
        '/information-services/context-sumo-report/status',
      );
    },

    // Job Management
    jobs: {
      getStatus: async (jobId: string): Promise<SumoJobStatusResponse> => {
        this.logger.debug(`Getting job status: ${jobId}`);
        return this.makeRequest<SumoJobStatusResponse>(
          'GET',
          `/information-services/context-sumo-report/query/${jobId}/status`,
        );
      },

      getResults: async (jobId: string): Promise<SumoJobResultsResponse> => {
        this.logger.debug(`Getting job results: ${jobId}`);
        return this.makeRequest<SumoJobResultsResponse>(
          'GET',
          `/information-services/context-sumo-report/query/${jobId}/results`,
        );
      },

      cancel: async (jobId: string): Promise<SumoJobCancelResponse> => {
        this.logger.debug(`Cancelling job: ${jobId}`);
        return this.makeRequest<SumoJobCancelResponse>(
          'DELETE',
          `/information-services/context-sumo-report/query/${jobId}`,
        );
      },

      list: (): Promise<SumoJobsListResponse> => {
        this.logger.debug('Listing Sumo jobs');
        return this.makeRequest<SumoJobsListResponse>(
          'GET',
          '/information-services/context-sumo-report/query/jobs',
        );
      },
    },

    // File Management
    files: {
      get: async (fileId: string): Promise<SumoFileResponse> => {
        this.logger.debug(`Getting file: ${fileId}`);
        return this.makeRequest<SumoFileResponse>(
          'GET',
          `/information-services/context-sumo-report/files/${fileId}`,
        );
      },

      delete: async (fileId: string): Promise<SumoFileDeleteResponse> => {
        this.logger.debug(`Deleting file: ${fileId}`);
        return this.makeRequest<SumoFileDeleteResponse>(
          'DELETE',
          `/information-services/context-sumo-report/files/${fileId}`,
        );
      },

      list: (): Promise<SumoFilesListResponse> => {
        this.logger.debug('Listing Sumo files');
        return this.makeRequest<SumoFilesListResponse>(
          'GET',
          '/information-services/context-sumo-report/files',
        );
      },
    },
  };

  // Sumo syntax methods
  sumoSyntax = {
    estimateQuerySyntax: async (
      request: SumoSyntaxEstimateRequest,
    ): Promise<SumoSyntaxEstimateResponse> => {
      this.logger.debug(
        `Estimating Sumo syntax for: ${request.description.substring(0, 100)}`,
      );
      return this.makeRequest<SumoSyntaxEstimateResponse>(
        'POST',
        '/information-services/context-sumo-syntax/estimate',
        request,
      );
    },
  };

  // Generic cached method for meta data (Redis cache with 1 week TTL)
  private async getCachedMetaData<T>(methodName: string): Promise<T> {
    const cacheKey = `istack:info-services:meta:${methodName}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${methodName}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Cache read failed for ${methodName}: ${error.message}`);
    }

    this.logger.debug(`Cache miss for ${methodName}, fetching from API`);

    // Map method names to their endpoints
    const endpointMap: Record<string, string> = {
      listKnowledgeBases: '/information-services/knowledge-bases',
      listChannels: '/information-services/knowledge-bases/channels',
      listDomains: '/information-services/knowledge-bases/domains',
      getQueryList: '/information-services/context-sumo-report/query-list',
      getKnownMessages:
        '/information-services/context-sumo-report/known-messages',
      getSubmitActionTypes:
        '/information-services/context-sumo-report/submit-action-types',
    };

    const endpoint = endpointMap[methodName];
    if (!endpoint) {
      throw new Error(`Unknown cached method: ${methodName}`);
    }

    const result = await this.makeRequest<T>('GET', endpoint);

    // Cache for 1 week (604800 seconds)
    try {
      await this.redis.setex(cacheKey, 604800, JSON.stringify(result));
      this.logger.debug(`Cached result for ${methodName}`);
    } catch (error) {
      this.logger.warn(
        `Cache write failed for ${methodName}: ${error.message}`,
      );
    }

    return result;
  }

  // Periodic cache refresh method
  public async refreshLookUpCaches(): Promise<void> {
    this.logger.log('Refreshing lookup caches');

    const methods = [
      'listKnowledgeBases',
      'listChannels',
      'listDomains',
      'getQueryList',
      'getKnownMessages',
      'getSubmitActionTypes',
    ];

    for (const method of methods) {
      try {
        const cacheKey = `istack:info-services:meta:${method}`;
        await this.redis.del(cacheKey);
        await this.getCachedMetaData(method);
        this.logger.debug(`Refreshed cache for ${method}`);
      } catch (error) {
        this.logger.error(
          `Failed to refresh cache for ${method}: ${error.message}`,
        );
      }
    }

    this.logger.log('Cache refresh completed');
  }

  // Private method for making HTTP requests with proper error handling
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    try {
      this.logger.debug(`Making ${method} request to ${endpoint}`);

      let response: AxiosResponse<T>;

      switch (method) {
        case 'GET':
        case 'OPTIONS':
          response = await this.httpClient.request<T>({
            method,
            url: endpoint,
          });
          break;
        case 'POST':
        case 'PUT':
          response = await this.httpClient.request<T>({
            method,
            url: endpoint,
            data,
          });
          break;
        case 'DELETE':
          response = await this.httpClient.delete<T>(endpoint);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      this.logger.debug(`Request successful: ${method} ${endpoint}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Request failed: ${method} ${endpoint}`, error.message);
      throw error;
    }
  }

  /**
   * Check if the API server is online and responding
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.makeRequest<HealthResponse>('GET', '/health');
      return response.healthy === true;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  // Transform axios errors into our API error format
  private transformError(error: any): ApiError {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      return {
        error: error.response.data?.error || 'API Error',
        message: error.response.data?.message || error.message,
        statusCode: error.response.status,
        timestamp: new Date().toISOString(),
      };
    } else if (error.request) {
      // The request was made but no response was received
      this.logger.error('Network error details:', {
        baseUrl: this.baseUrl,
        requestUrl: error.config?.url,
        fullUrl: `${this.baseUrl}${error.config?.url}`,
        method: error.config?.method,
        timeout: error.config?.timeout,
        errorCode: error.code,
        errorMessage: error.message,
      });
      return {
        error: 'Network Error',
        message: `No response received from server. Attempted: ${this.baseUrl}${error.config?.url}`,
        statusCode: 0,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      return {
        error: 'Request Error',
        message: error.message,
        statusCode: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
