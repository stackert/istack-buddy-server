type TConversationMessageContentMediaTypes =
  | 'text/plain'
  | 'image/jpg'
  | 'image/gif'
  | 'image/*'
  | 'application/octet-stream'
  | 'application/json';

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

// Union type for all possible content types
type TConversationMessageContent =
  | TConversationMessageContentString
  | TConversationMessageContentImageBuffer
  | TConversationMessageContentFileBuffer;

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

  // Message types
  TConversationListMessage,
  TConversationTextMessage,
  TConversationImageMessage,
  TConversationFileMessage,
};
