type TConversationMessageContentMediaTypes =
  | 'text/plain'
  | 'image/jpg'
  | 'image/gif'
  | 'image/*'
  | 'application/octet-stream'
  | 'application/json'
  // Information Services Content Types
  | 'content/dynamic'
  | 'content/dynamic-account'
  | 'content/dynamic-form'
  | 'content/dynamic-auth-provider'
  | 'content/document' // when toRole = 'robot' visible to robot only, when toRole = 'user' visible to user AND robot, content always visible to robot
  | 'sumo-search/report'
  | 'sumo-syntax/query'
  | 'sumo-syntax/validation';

type TConversationMessageContentTypes<
  MEDIA_TYPE extends TConversationMessageContentMediaTypes,
  BASE_TYPE,
> = {
  type: MEDIA_TYPE;
  payload: BASE_TYPE;
};

type TConversationMessageContentString = TConversationMessageContentTypes<
  'text/plain',
  string
>;

type TConversationMessageRobotContent = TConversationMessageContentTypes<
  'content/document',
  string
>;

// this type is not currently used - we hope to add support
// therefore this is stub.  with files I would expect to fileName, size, etc
type TConversationMessageContentImageBuffer = TConversationMessageContentTypes<
  'image/*',
  Buffer
>;
type TConversationMessageContentFileBuffer = TConversationMessageContentTypes<
  'application/octet-stream',
  Buffer
>;

// Information Services Content Types
type TConversationMessageContentDynamic = TConversationMessageContentTypes<
  'content/dynamic',
  string
>;

type TConversationMessageContentDynamicAccount =
  TConversationMessageContentTypes<
    'content/dynamic-account',
    {
      accountRecord: any;
      [key: string]: any;
    }
  >;

type TConversationMessageContentDynamicForm = TConversationMessageContentTypes<
  'content/dynamic-form',
  {
    formRecord: any;
    submitActionIds?: string[];
    emails?: string[];
    [key: string]: any;
  }
>;

type TConversationMessageContentDynamicAuthProvider =
  TConversationMessageContentTypes<
    'content/dynamic-auth-provider',
    {
      authProviderRecord: any;
      [key: string]: any;
    }
  >;

type TConversationMessageContentDocument = TConversationMessageContentTypes<
  'content/document',
  {
    content: any;
    tokenCount?: number;
    [key: string]: any;
  }
>;

type TConversationMessageContentSumoSearchReport =
  TConversationMessageContentTypes<
    'sumo-search/report',
    {
      recordCount: number;
      firstRecord: any;
      results: any;
      originalQuery?: string;
      [key: string]: any;
    }
  >;

type TConversationMessageContentSumoSyntaxQuery =
  TConversationMessageContentTypes<
    'sumo-syntax/query',
    {
      query: string;
      isValid?: boolean;
      [key: string]: any;
    }
  >;

type TConversationMessageContentSumoSyntaxValidation =
  TConversationMessageContentTypes<
    'sumo-syntax/validation',
    {
      query: string;
      isValid: boolean;
      errors?: string[];
      [key: string]: any;
    }
  >;

// Union type for all possible content types
type TConversationMessageContent =
  | TConversationMessageContentString
  | TConversationMessageRobotContent
  | TConversationMessageContentImageBuffer
  | TConversationMessageContentFileBuffer
  | TConversationMessageContentDynamic
  | TConversationMessageContentDynamicAccount
  | TConversationMessageContentDynamicForm
  | TConversationMessageContentDynamicAuthProvider
  | TConversationMessageContentDocument
  | TConversationMessageContentSumoSearchReport
  | TConversationMessageContentSumoSyntaxQuery
  | TConversationMessageContentSumoSyntaxValidation;

// Base message structure - T can be any content type
type TConversationListMessage<T = TConversationMessageContent> = {
  messageId: string;
  author_role: string;
  fromUserId?: string | null; // Optional user identifier (e.g., 'cx-slack-robot' for Slack)
  content: T;
  created_at: string;
  estimated_token_count: number;
};

// Convenience types for specific content types
type TConversationTextMessage =
  TConversationListMessage<TConversationMessageContentString>;
type TConversationImageMessage =
  TConversationListMessage<TConversationMessageContentImageBuffer>;
type TConversationFileMessage =
  TConversationListMessage<TConversationMessageContentFileBuffer>;

export type {
  // Media types
  TConversationMessageContentMediaTypes,
  // Content types
  TConversationMessageContent,
  TConversationMessageContentString,
  TConversationMessageContentImageBuffer,
  TConversationMessageContentFileBuffer,
  // Information Services Content Types
  TConversationMessageContentDynamic,
  TConversationMessageContentDynamicAccount,
  TConversationMessageContentDynamicForm,
  TConversationMessageContentDynamicAuthProvider,
  TConversationMessageContentDocument,
  TConversationMessageContentSumoSearchReport,
  TConversationMessageContentSumoSyntaxQuery,
  TConversationMessageContentSumoSyntaxValidation,

  // Message types
  TConversationListMessage,
  TConversationTextMessage,
  TConversationImageMessage,
  TConversationFileMessage,
};
