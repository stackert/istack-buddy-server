// Core response types
export interface HealthResponse {
  healthy: boolean;
  database: string;
  error?: string;
}

// Knowledge base types
export interface PreQueryInputDto {
  query: string;
}

export interface PreQueryResponse {
  nouns: string[];
  properNouns: string[];
  domains: string[];
  keywords: string[];
  aiTechnicalObservation: string;
}

export interface KeywordSearchInput {
  keywords: string[];
  knowledgeBases?: string[];
  maxResults?: number;
  maxConfidence?: number;
  channels?: string[];
  domains?: string[];
}

export interface SemanticSearchInput {
  query: string;
  knowledgeBases?: string[];
  maxResults?: number;
  maxConfidence?: number;
  channels?: string[];
  domains?: string[];
}

export interface TopSearchInput {
  query: string;
  knowledgeBases?: string[];
  maxResults?: number;
  maxConfidence?: number; // Paging: use lowest confidence from previous page
  channels?: string[];
  domains?: string[];
}

export interface SearchResults {
  [knowledgeBase: string]: Array<{
    confidence: string;
    content: string;
    [key: string]: any;
  }>;
}

export interface KnowledgeBasesResponse {
  knowledgeBases: string[];
}

export interface ChannelsResponse {
  channels: string[];
}

export interface DomainsResponse {
  domains: string[];
}

// Context dynamic types
export interface ContextDynamicResponse {
  entityType: string;
  entityId: string;
  data: any;
}

export interface AccountContextResponse extends ContextDynamicResponse {
  entityType: 'account';
  data: {
    accountId: string;
    accountName: string;
    plan: string;
    status: string;
    [key: string]: any;
  };
}

export interface FormContextResponse extends ContextDynamicResponse {
  entityType: 'form';
  data: {
    formId: string;
    formName: string;
    status: string;
    fields: any[];
    submitActions: any[];
    [key: string]: any;
  };
}

export interface AuthProviderContextResponse extends ContextDynamicResponse {
  entityType: 'authProvider';
  data: {
    authProviderId: string;
    providerType: string;
    configuration: any;
    [key: string]: any;
  };
}

// Sumo Logic types
export interface SumoJobSubmissionRequest {
  queryName: string;
  subject: {
    formId?: string;
    submissionId?: string;
    submitActionId?: string;
    submitActionType?: string;
    authProviderId?: string;
    accountId?: string;
    message?: string;
    startDate?: string;
    endDate?: string;
  };
  isValidationOnly?: boolean;
}

export interface SumoJobSubmissionResponse {
  jobId: string;
  status: string;
  statusUrl: string;
}

export interface SumoJobStatusResponse {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SumoJobResultsResponse {
  jobId: string;
  status: string;
  results: any;
  fileId?: string;
  recordCount?: number;
}

export interface SumoJobCancelResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface SumoJobsListResponse {
  jobs: Array<{
    jobId: string;
    queryName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface SumoQueryListResponse {
  queries: Array<{
    queryName: string;
    description: string;
    parameters: string[];
  }>;
}

export interface SumoKnownMessagesResponse {
  messages: Array<{
    messageType: string;
    description: string;
    fields: string[];
  }>;
}

export interface SumoSubmitActionTypesResponse {
  submitActionTypes: Array<{
    type: string;
    description: string;
    fields: string[];
  }>;
}

export interface SumoStatusResponse {
  status: string;
  version: string;
  uptime: number;
}

// Sumo file management types
export interface SumoFileResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface SumoFileDeleteResponse {
  fileId: string;
  deleted: boolean;
  message: string;
}

export interface SumoFilesListResponse {
  files: Array<{
    fileId: string;
    fileName: string;
    fileSize: number;
    createdAt: string;
  }>;
}

// Sumo syntax types
export interface SumoSyntaxEstimateRequest {
  description: string;
  context?: {
    formId?: string;
    accountId?: string;
    timeRange?: string;
  };
}

export interface SumoSyntaxEstimateResponse {
  estimatedQuery: string;
  confidence: number;
  explanation: string;
  suggestedParameters: string[];
}

// API Error types
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// Cache metadata type
export interface CacheMetadata {
  method: string;
  cacheKey: string;
  ttl: number;
  lastUpdated?: string;
}
