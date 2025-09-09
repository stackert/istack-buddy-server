_TMC_

Editor's note, do not remove.

This document is not complete until it mentions 'testing' and what kinds of testing is required

_TMC_

# Information Service API Integration

## Overview

This document defines the required API interface for iStackBuddy Information Services. It outlines the work needed to create a clean, typed interface to the Information Services API endpoints that applications will use.

## References

- **API Documentation**: `docs-living/features/30000-information-services/artifacts/istack-buddy-information-servcice.yml`
- **Parent Feature Documentation**: `docs-living/features/30001-information-service-pre-req/00000-info-serv-overview.md`

## BullMQ Integration

**Job Management**: The `sumoReport.jobs.*` methods integrate with our existing BullMQ job queue system:

- **submitQuery**: Creates a new job in the `sumo-query` queue
- **jobs.getStatus**: Checks job status from BullMQ
- **jobs.getResults**: Retrieves completed job results
- **jobs.cancel**: Cancels running jobs in the queue
- **jobs.list**: Lists recent jobs from BullMQ

**Queue Integration**: Jobs are processed asynchronously using our existing job queue infrastructure, providing reliable background processing for Sumo Logic queries.

## Caching Strategy

**Meta Data Caching**: All lookup/list methods are cached to reduce API calls:

- **Cached Methods**: `listKnowledgeBases`, `listChannels`, `listDomains`, `getQueryList`, `getKnownMessages`, `getSubmitActionTypes`
- **Cache Duration**: 1 week (these are meta services that rarely change)
- **Cache Storage**: Redis with file-based fallback
- **Refresh Strategy**: `refreshLookUpCaches()` method runs periodically (similar to existing garbage collection)
- **Cache Keys**: `istack:info-services:meta:{method-name}` (e.g., `istack:info-services:meta:listKnowledgeBases`)

## API Interface Structure

```typescript
iStackInfoService: {
  // Server Health Check
  health: () => Promise<HealthResponse>;

  // Knowledge Base Search
  knowledgeBase: {
    preQuery: (query: string) => Promise<PreQueryResponse>;
    keywordSearch: (input: KeywordSearchInput) => Promise<SearchResults>;
    semanticSearch: (input: SemanticSearchInput) => Promise<SearchResults>;
    topSearch: (input: TopSearchInput) => Promise<SearchResults>;
    listKnowledgeBases: () => Promise<KnowledgeBasesResponse>;
    listChannels: () => Promise<ChannelsResponse>;
    listDomains: () => Promise<DomainsResponse>;
  }

  // Context Dynamic Data
  contextDynamic: {
    get: (entityType: string, entityId: string) =>
      Promise<ContextDynamicResponse>;
    getAccount: (accountId: string) => Promise<AccountContextResponse>;
    getForm: (formId: string) => Promise<FormContextResponse>;
    getAuthProvider: (authProviderId: string) =>
      Promise<AuthProviderContextResponse>;
    health: () => Promise<HealthResponse>;
  }

  // Sumo Logic Reports
  sumoReport: {
    submitQuery: (request: SumoJobSubmissionRequest) =>
      Promise<SumoJobSubmissionResponse>;
    getQueryList: () => Promise<SumoQueryListResponse>;
    getKnownMessages: () => Promise<SumoKnownMessagesResponse>;
    getSubmitActionTypes: () => Promise<SumoSubmitActionTypesResponse>;
    getStatus: () => Promise<SumoStatusResponse>;

    // Job Management
    jobs: {
      getStatus: (jobId: string) => Promise<SumoJobStatusResponse>;
      getResults: (jobId: string) => Promise<SumoJobResultsResponse>;
      cancel: (jobId: string) => Promise<SumoJobCancelResponse>;
      list: () => Promise<SumoJobsListResponse>;
    };

    // File Management
    files: {
      get: (fileId: string) => Promise<SumoFileResponse>;
      delete: (fileId: string) => Promise<SumoFileDeleteResponse>;
      list: () => Promise<SumoFilesListResponse>;
    };
  }

  // Sumo Logic Syntax Help
  sumoSyntax: {
    estimateQuerySyntax: (request: SumoSyntaxEstimateRequest) =>
      Promise<SumoSyntaxEstimateResponse>;
  }
}
```

## Usage Examples

```typescript
// Health check
const health = await iStackInfoService.health();

// Knowledge base search
const preQuery = await iStackInfoService.knowledgeBase.preQuery(
  'SAML authentication setup',
);
const results = await iStackInfoService.knowledgeBase.topSearch({
  query: 'SAML authentication',
  knowledgeBases: ['SLACK', 'CONTEXT-DOCUMENTS'],
  maxResults: 10,
  maxConfidence: 0.9, // Paging: use lowest confidence from previous page
});

// Context dynamic data
const formContext = await iStackInfoService.contextDynamic.getForm('123456');
const accountContext =
  await iStackInfoService.contextDynamic.getAccount('789012');

// Sumo Logic reports
const job = await iStackInfoService.sumoReport.submitQuery({
  queryName: 'searchSumoLogSubmissionErrors',
  subject: 'formId:123456',
  startDate: '2025-01-01',
  endDate: '2025-01-07',
});
const results = await iStackInfoService.sumoReport.jobs.getResults(job.jobId);

// Sumo syntax help
const syntax = await iStackInfoService.sumoSyntax.estimateQuerySyntax({
  description: 'Find all form submission errors in the last 7 days',
});
```

## Configuration

### Environment Variables

**Required**: API key must be configured in environment variables:

```bash
# Required - API key for Information Services
ISTACK_INFO_SERVICE_API_KEY=your_api_key_here

# Optional - Base URL (defaults to production)
ISTACK_INFO_SERVICE_BASE_URL=https://api.istackbuddy.com
```

### Health Check Endpoint

**Primary Health Check**: `/information-services/context-sumo-report/status`

- **Method**: OPTIONS
- **Purpose**: Check service availability for all Information Services
- **Response**: Valid response indicates healthy service
- **Usage**: Main health check for external API availability

**Internal Health Check**: `/information-services/context-dynamic/health`

- **Method**: POST
- **Purpose**: Internal context retrieval service health (used internally only)
- **Response**: `{ healthy: boolean, database: string, error?: string }`
- **Usage**: Internal service monitoring, not exposed externally

## Search Paging Strategy

**Important**: `maxConfidence` is used for paging in search results.

- **First Page**: Don't set `maxConfidence` - get highest confidence results
- **Subsequent Pages**: Set `maxConfidence` to the lowest confidence score from the previous page
- **Best Practice**: If results aren't found in the first page, revise your search query instead of paging through results
- **Rationale**: Search results are ordered by confidence, so paging indicates lower relevance

## Error Handling Strategy

**Implementation Plan**: We will implement comprehensive error handling for all API interactions:

- **Authentication Errors (401)**: We will validate API keys before requests and provide clear error messages for invalid credentials
- **Rate Limiting (429)**: We will implement exponential backoff retry logic with jitter to handle rate limits gracefully
- **Service Unavailable (503)**: We will implement circuit breaker patterns and fallback strategies for service outages
- **Validation Errors (400)**: We will validate request parameters and provide detailed error messages for invalid inputs

## Testing

- **Unit Tests**: Mock API responses for each method
- **Integration Tests**: Test against staging environment
- **Error Scenarios**: Test authentication, rate limiting, and service failures
- **Health Check**: Verify service availability before operations

## ObservationMaker Integration

**Note**: ObservationMaker (found in `src/common/observation-makers`) is a separate debug/monitoring tool for analyzing reports and form definitions. It may include serialization features for observations like "no submitAction in the report" or "some submitAction have non run record". This is unrelated to the Information Services API and should not be confused with the `aiTechnicalObservation` field in PreQuery responses.

---

## Technical Implementation Details

### API Client Structure

```typescript
// src/istack-buddy-slack-api/iStackInfoService.ts
export class IStackInfoService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly redis: Redis; // Redis client for caching

  constructor(redisClient: Redis) {
    this.apiKey = process.env.ISTACK_INFO_SERVICE_API_KEY;
    this.baseUrl =
      process.env.ISTACK_INFO_SERVICE_BASE_URL || 'https://api.istackbuddy.com';
    this.redis = redisClient;

    if (!this.apiKey) {
      throw new Error(
        'ISTACK_INFO_SERVICE_API_KEY environment variable is required',
      );
    }
  }

  // Health check
  async health(): Promise<HealthResponse> {
    return this.makeRequest(
      'OPTIONS',
      '/information-services/context-sumo-report/status',
    );
  }

  // Knowledge base methods
  knowledgeBase = {
    preQuery: (query: string) =>
      this.makeRequest(
        'POST',
        '/information-services/knowledge-bases/preQuery',
        { query },
      ),
    keywordSearch: (input: KeywordSearchInput) =>
      this.makeRequest(
        'POST',
        '/information-services/knowledge-bases/keyword-search',
        input,
      ),
    semanticSearch: (input: SemanticSearchInput) =>
      this.makeRequest(
        'POST',
        '/information-services/knowledge-bases/semantic-search',
        input,
      ),
    topSearch: (input: TopSearchInput) =>
      this.makeRequest(
        'POST',
        '/information-services/knowledge-bases/top-search',
        input,
      ),
    listKnowledgeBases: () => this.getCachedMetaData('listKnowledgeBases'),
    listChannels: () => this.getCachedMetaData('listChannels'),
    listDomains: () => this.getCachedMetaData('listDomains'),
  };

  // Context dynamic methods
  contextDynamic = {
    get: (entityType: string, entityId: string) =>
      this.makeRequest(
        'POST',
        `/information-services/context-dynamic/${entityType}`,
        { entityId },
      ),
    getAccount: (accountId: string) =>
      this.makeRequest(
        'POST',
        '/information-services/context-dynamic/account',
        { accountId },
      ),
    getForm: (formId: string) =>
      this.makeRequest('POST', '/information-services/context-dynamic/form', {
        formId,
      }),
    getAuthProvider: (authProviderId: string) =>
      this.makeRequest(
        'POST',
        '/information-services/context-dynamic/auth-provider',
        { authProviderId },
      ),
    health: () =>
      this.makeRequest('POST', '/information-services/context-dynamic/health'),
  };

  // Sumo report methods
  sumoReport = {
    submitQuery: (request: SumoJobSubmissionRequest) =>
      this.makeRequest(
        'POST',
        '/information-services/context-sumo-report/query/submit',
        request,
      ),
    getQueryList: () => this.getCachedMetaData('getQueryList'),
    getKnownMessages: () => this.getCachedMetaData('getKnownMessages'),
    getSubmitActionTypes: () => this.getCachedMetaData('getSubmitActionTypes'),
    getStatus: () =>
      this.makeRequest(
        'GET',
        '/information-services/context-sumo-report/status',
      ),

    // Job Management
    jobs: {
      getStatus: (jobId: string) =>
        this.makeRequest(
          'GET',
          `/information-services/context-sumo-report/query/${jobId}/status`,
        ),
      getResults: (jobId: string) =>
        this.makeRequest(
          'GET',
          `/information-services/context-sumo-report/query/${jobId}/results`,
        ),
      cancel: (jobId: string) =>
        this.makeRequest(
          'DELETE',
          `/information-services/context-sumo-report/query/${jobId}`,
        ),
      list: () =>
        this.makeRequest(
          'GET',
          '/information-services/context-sumo-report/query/jobs',
        ),
    },

    // File Management
    files: {
      get: (fileId: string) =>
        this.makeRequest(
          'GET',
          `/information-services/context-sumo-report/files/${fileId}`,
        ),
      delete: (fileId: string) =>
        this.makeRequest(
          'DELETE',
          `/information-services/context-sumo-report/files/${fileId}`,
        ),
      list: () =>
        this.makeRequest(
          'GET',
          '/information-services/context-sumo-report/files',
        ),
    },
  };

  // Sumo syntax methods
  sumoSyntax = {
    estimateQuerySyntax: (request: SumoSyntaxEstimateRequest) =>
      this.makeRequest(
        'POST',
        '/information-services/context-sumo-syntax/estimate',
        request,
      ),
  };

  // Generic cached method for meta data (Redis cache with 1 week TTL)
  private async getCachedMetaData<T>(methodName: string): Promise<T> {
    const cacheKey = `istack:info-services:meta:${methodName}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Map method names to their endpoints
    const endpointMap = {
      listKnowledgeBases: '/information-services/knowledge-bases',
      listChannels: '/information-services/knowledge-bases/channels',
      listDomains: '/information-services/knowledge-bases/domains',
      getQueryList: '/information-services/context-sumo-report/query-list',
      getKnownMessages:
        '/information-services/context-sumo-report/known-messages',
      getSubmitActionTypes:
        '/information-services/context-sumo-report/submit-action-types',
    };

    const result = await this.makeRequest('GET', endpointMap[methodName]);

    // Cache for 1 week (604800 seconds)
    await this.redis.setex(cacheKey, 604800, JSON.stringify(result));
    return result;
  }

  // Periodic cache refresh method
  public async refreshLookUpCaches(): Promise<void> {
    const methods = [
      'listKnowledgeBases',
      'listChannels',
      'listDomains',
      'getQueryList',
      'getKnownMessages',
      'getSubmitActionTypes',
    ];

    for (const method of methods) {
      const cacheKey = `istack:info-services:meta:${method}`;
      await this.redis.del(cacheKey);
      await this.getCachedMetaData(method);
    }
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
  ): Promise<T> {
    // Implementation with proper error handling, authentication, etc.
  }
}
```

## Type Definitions

```typescript
// Core response types
interface HealthResponse {
  healthy: boolean;
  database: string;
  error?: string;
}

// Knowledge base types
interface PreQueryResponse {
  nouns: string[];
  properNouns: string[];
  domains: string[];
  keywords: string[];
  aiTechnicalObservation: string;
}

interface TopSearchInput {
  query: string;
  knowledgeBases?: string[];
  maxResults?: number;
  maxConfidence?: number; // Paging: use lowest confidence from previous page
  channels?: string[];
  domains?: string[];
}

interface SearchResults {
  [knowledgeBase: string]: Array<{
    confidence: string;
    content: string;
    [key: string]: any;
  }>;
}

// Context dynamic types
interface ContextDynamicResponse {
  entityType: string;
  entityId: string;
  data: any;
}

// Sumo Logic types
interface SumoJobSubmissionRequest {
  queryName: string;
  subject: string;
  startDate: string;
  endDate: string;
}

interface SumoJobSubmissionResponse {
  jobId: string;
  status: string;
  statusUrl: string;
}
```
