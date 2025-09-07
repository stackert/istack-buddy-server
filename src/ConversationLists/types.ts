type TConversationMessageContentMediaTypes =
  | 'text/plain'
  | 'image/jpg'
  | 'image/gif'
  | 'image/*'
  | 'application/octet-stream'
  | 'application/json'
  | 'content/*'
  | 'content/dynamic'
  | 'content/dynamic-account'
  | 'content/dynamic-form'
  | 'content/dynamic-auth-provider'
  | 'content/document'
  | 'sumo-search/report'
  | 'sumo-syntax/*';

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

// Content types
type TConversationMessageContentGeneric = TConversationMessageContentTypes<
  'content/*',
  string
>;

type TConversationMessageContentDynamic = TConversationMessageContentTypes<
  'content/dynamic',
  string
>;

// Dynamic content with specific record structures
type TConversationMessageContentDynamicAccount = TConversationMessageContentTypes<
  'content/dynamic-account',
  {
    accountRecord: {
      accountId: number;
      name: string;
      plan: string;
      [key: string]: any;
    };
    [key: string]: any;
  }
>;

type TConversationMessageContentDynamicForm = TConversationMessageContentTypes<
  'content/dynamic-form',
  {
    formRecord: {
      formId: number;
      activeAuthProviderName?: string;
      protectionType?: 'SSO' | 'Password' | 'None';
      submitActions?: Array<{
        submitActionId: number;
        name: string;
        type: string;
        isActive: boolean;
        hasLogic: boolean;
      }>;
      confirmationEmails?: Array<{
        confirmationEmailId: number;
        name: string;
        payloadType: string;
        hasLogic: boolean;
      }>;
      notificationEmails?: Array<{
        notificationEmailId: number;
        name: string;
        payloadType: string;
        hasLogic: boolean;
      }>;
      [key: string]: any;
    };
    [key: string]: any;
  }
>;

type TConversationMessageContentDynamicAuthProvider = TConversationMessageContentTypes<
  'content/dynamic-auth-provider',
  {
    authProviderRecord: {
      authProviderId: number;
      type: string;
      domain: string;
      [key: string]: any;
    };
    [key: string]: any;
  }
>;

type TConversationMessageContentDocument = TConversationMessageContentTypes<
  'content/document',
  any
>;

type TConversationMessageContentSumoSearchReport = TConversationMessageContentTypes<
  'sumo-search/report',
  {
    recordCount: number;
    firstRecord: any;
    results: any;
  }
>;

type TConversationMessageContentSumoSyntax = TConversationMessageContentTypes<
  'sumo-syntax/*',
  string
>;

// Union type for all possible content types
type TConversationMessageContent =
  | TConversationMessageContentString
  | TConversationMessageContentImageBuffer
  | TConversationMessageContentFileBuffer
  | TConversationMessageContentGeneric
  | TConversationMessageContentDynamic
  | TConversationMessageContentDynamicAccount
  | TConversationMessageContentDynamicForm
  | TConversationMessageContentDynamicAuthProvider
  | TConversationMessageContentDocument
  | TConversationMessageContentSumoSearchReport
  | TConversationMessageContentSumoSyntax;

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
type TConversationGenericMessage =
  TConversationListMessage<TConversationMessageContentGeneric>;
type TConversationDynamicMessage =
  TConversationListMessage<TConversationMessageContentDynamic>;
type TConversationDynamicAccountMessage =
  TConversationListMessage<TConversationMessageContentDynamicAccount>;
type TConversationDynamicFormMessage =
  TConversationListMessage<TConversationMessageContentDynamicForm>;
type TConversationDynamicAuthProviderMessage =
  TConversationListMessage<TConversationMessageContentDynamicAuthProvider>;
type TConversationDocumentMessage =
  TConversationListMessage<TConversationMessageContentDocument>;
type TConversationSumoSearchReportMessage =
  TConversationListMessage<TConversationMessageContentSumoSearchReport>;
type TConversationSumoSyntaxMessage =
  TConversationListMessage<TConversationMessageContentSumoSyntax>;

export type {
  // Media types
  TConversationMessageContentMediaTypes,
  // Content types
  TConversationMessageContent,
  TConversationMessageContentString,
  TConversationMessageContentImageBuffer,
  TConversationMessageContentFileBuffer,
  TConversationMessageContentGeneric,
  TConversationMessageContentDynamic,
  TConversationMessageContentDynamicAccount,
  TConversationMessageContentDynamicForm,
  TConversationMessageContentDynamicAuthProvider,
  TConversationMessageContentDocument,
  TConversationMessageContentSumoSearchReport,
  TConversationMessageContentSumoSyntax,

  // Message types
  TConversationListMessage,
  TConversationTextMessage,
  TConversationImageMessage,
  TConversationFileMessage,
  TConversationGenericMessage,
  TConversationDynamicMessage,
  TConversationDynamicAccountMessage,
  TConversationDynamicFormMessage,
  TConversationDynamicAuthProviderMessage,
  TConversationDocumentMessage,
  TConversationSumoSearchReportMessage,
  TConversationSumoSyntaxMessage,
};
