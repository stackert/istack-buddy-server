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
  query: string;
  minConfidence: number;
  pageSize: number;
  originalText: string;
  normalizedText: string;
  aiTechnicalObservation: string;
  keywords: string[];
  nouns: string[];
  properNouns: string[];
  domains: string[];
  isWordSearch: boolean;
  applicableKnowledgeBase: string[];
  subjects: any;
  userPromptText: string;
  freeText?: string[];
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
  chunks: Array<{
    index: number;
    chunk_text: string;
    chunk_embedding: number[];
  }>;
}

// Base search parameters that all searches can use
type BaseSearchParams = Pick<
  PreQueryResponse,
  'channelIds' | 'maxConfidence' | 'limit'
>;

// All search input types derived from PreQueryResponse
export interface KeywordSearchInput extends BaseSearchParams {
  keywords: PreQueryResponse['keywords'];
}

export interface NounSearchInput extends BaseSearchParams {
  nouns: PreQueryResponse['nouns'];
}

export interface ProperNounSearchInput extends BaseSearchParams {
  properNouns: PreQueryResponse['properNouns'];
}

export interface DomainSearchInput extends BaseSearchParams {
  domains: PreQueryResponse['domains'];
}

export interface FreeTextSearchInput extends BaseSearchParams {
  freeText: PreQueryResponse['freeText'];
}

export interface SemanticSearchInput extends BaseSearchParams {
  userPromptText: PreQueryResponse['userPromptText'];
}

export interface KnowledgeBaseResultItem {
  conversation_id?: string;
  conversationText?: string;
  conversationTextNormalized?: string;
  context_document_id?: string;
  contextDocumentText?: string;
  contextDocumentTextNormalized?: string;
  title?: string;
  filePath?: string;
  aiTechnicalObservation?: string;
  confidence: string;
  channelId: string;
  keywords: string[];
  nouns: string[];
  properNouns: string[];
  domains: string[];
  subjects: any;
  citations: {
    text: string;
    link?: string;
  };
}

// Base type for knowledge base search results
export type KnowledgeBaseResults = {
  [knowledgeBase: string]: Array<KnowledgeBaseResultItem>;
};

// Individual search methods return this simple structure
export interface SearchResults extends KnowledgeBaseResults {}

// Top-results returns comprehensive structure with multiple search types
export interface TopResultsResponse {
  searchSemantic?: KnowledgeBaseResults;
  searchKeywords?: KnowledgeBaseResults;
  searchNouns?: KnowledgeBaseResults;
  searchProperNouns?: KnowledgeBaseResults;
  searchDomains?: KnowledgeBaseResults;
  searchFreeText?: KnowledgeBaseResults;
  searchTypesExecuted: string[];
  totalSearchTypes: number;
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
  account: {
    accountId: string;
    accountName: string;
    plan: string;
    status: string;
    [key: string]: any;
  };
}

export interface FormContextResponse extends ContextDynamicResponse {
  entityType: 'form';
  form: {
    formId: number;
    id: number;
    viewkey: string;
    isShareEnabled: boolean;
    accountId: number;
    name: string;
    alias?: string;
    templateId?: number;
    formVersion: number;
    numOfColumns: number;
    expirationType: '' | 'date' | 'submissions' | 'inventory_sold_out';
    isCaptchaEnabled: boolean;
    timezone: string;
    language: string;
    isActive: boolean;
    created: string;
    updated: string;
    viewCount: number;
    submissionCount: number;
    submissionUnreadCount: number;
    lastSubmissionDate: string;
    isDeleted: boolean;
    deletedDate?: string;
    formCreateUserId?: number;
    formWorkflowType: 'form' | 'workflow';
    workflowStatus: 'active_accepting' | 'active_not_accepting' | 'draft';
    workflowIncompleteSubmissionCount: number;
    activeAuthProviderName: string;
    protectionType: 'SSO' | 'Password' | 'None';
    submitActions: Array<{
      submitActionId: number;
      name: string;
      type: string;
      isActive: boolean;
      hasLogic: boolean;
    }>;
    confirmationEmails: Array<{
      confirmationEmailId: number;
      name: string;
      payloadType: string;
      hasLogic: boolean;
    }>;
    notificationEmails: Array<{
      notificationEmailId: number;
      name: string;
      payloadType: string;
      hasLogic: boolean;
    }>;
    formPlugins: Array<{
      formPluginId: number;
      type: string;
      isActive: boolean;
    }>;
    smartLists: Array<{
      smartListId: number;
      name: string;
      fieldIds: number[];
      useSeparateValues: boolean;
      useImages: boolean;
    }>;
    [key: string]: any;
  };
}

export interface FormFieldsObservationsSourceResponse
  extends ContextDynamicResponse {
  entityType: 'form';
  formFieldsObservationsSource: {
    formId: number;
    id: number;
    viewkey: string;
    isShareEnabled: boolean;
    accountId: number;
    name: string;
    alias?: string;
    templateId?: number;
    formVersion: number;
    numOfColumns: number;
    expirationType: '' | 'date' | 'submissions' | 'inventory_sold_out';
    isCaptchaEnabled: boolean;
    timezone: string;
    language: string;
    isActive: boolean;
    created: string;
    updated: string;
    viewCount: number;
    submissionCount: number;
    submissionUnreadCount: number;
    lastSubmissionDate: string;
    isDeleted: boolean;
    deletedDate?: string;
    formCreateUserId?: number;
    formWorkflowType: 'form' | 'workflow';
    workflowStatus: 'active_accepting' | 'active_not_accepting' | 'draft';
    workflowIncompleteSubmissionCount: number;
    activeAuthProviderName: string;
    protectionType: 'SSO' | 'Password' | 'None';
    submitActions: Array<{
      submitActionId: number;
      name: string;
      type: string;
      isActive: boolean;
      hasLogic: boolean;
    }>;
    confirmationEmails: Array<{
      confirmationEmailId: number;
      name: string;
      payloadType: string;
      hasLogic: boolean;
    }>;
    notificationEmails: Array<{
      notificationEmailId: number;
      name: string;
      payloadType: string;
      hasLogic: boolean;
    }>;
    formPlugins: Array<{
      formPluginId: number;
      type: string;
      isActive: boolean;
    }>;
    smartLists: Array<{
      smartListId: number;
      name: string;
      fieldIds: number[];
      useSeparateValues: boolean;
      useImages: boolean;
    }>;
    viewKey: string;
    folder: number;
    version: number;
    url: string;
    submissionsCount: number;
    unreadSubmissionsCount: number;
    todaySubmissionsCount: number;
    isEncrypted: boolean;
    submitButtonTitle: string;
    isWorkflowForm: boolean;
    isWorkflowPublished: boolean;
    hasApprovers: boolean;
    permissions: number;
    canEdit: boolean;
    formExtras: {
      numberOfColumns: number;
      fieldLabelsPosition: string;
      language: string;
      useCaptcha: boolean;
      useProgressMeter: boolean;
      useSaveResume: boolean;
      useExpiration: boolean;
      expirationOption: string;
      disabledMessage: string;
    };
    formSettings: {
      alias: string;
      timezone: string;
      isActive: boolean;
      saveSubmissionsToDatabase: boolean;
    };
    fields: Array<{
      id: number;
      label: string;
      labelKey: string;
      internalLabel: string;
      supportingText: string;
      useCallout: boolean;
      type: string;
      required: boolean;
      readOnly: boolean;
      hidden: boolean;
      unique: boolean;
      hideLabel: boolean;
      displayOrder: number;
      columnSpan: number;
      language: string;
      defaultValue: string;
      smartListId?: number;
      logic?: any;
      numericCalculations?: any;
      datetimeCalculations?: any;
      options?: string;
      attributes: string;
    }>;
    [key: string]: any;
  };
}

export interface AuthProviderContextResponse extends ContextDynamicResponse {
  entityType: 'authProvider';
  authProvider: {
    authProviderId: string;
    providerType: string;
    configuration: any;
    [key: string]: any;
  };
}

// Sumo Logic types
export interface SumoJobSubmissionRequest {
  queryName: string;
  subjects: {
    formId?: string[];
    submissionId?: string[];
    submitActionId?: string[];
    submitActionType?: string[];
    authProviderId?: string[];
    accountId?: string[];
    message?: string[];
  };
  dateRange?: {
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
