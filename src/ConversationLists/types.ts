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

// Message envelope - contains the actual message as envelopePayload
type TConversationMessageEnvelope<T = TConversationListMessage> = {
  messageId: string;
  requestOrResponse: 'request' | 'response';
  envelopePayload: T;
};

// Convenience types for specific content types
type TConversationTextMessage =
  TConversationListMessage<TConversationMessageContentString>;
type TConversationImageMessage =
  TConversationListMessage<TConversationMessageContentImageBuffer>;
type TConversationFileMessage =
  TConversationListMessage<TConversationMessageContentFileBuffer>;

// Convenience envelope types
type TConversationTextMessageEnvelope =
  TConversationMessageEnvelope<TConversationTextMessage>;
type TConversationImageMessageEnvelope =
  TConversationMessageEnvelope<TConversationImageMessage>;
type TConversationFileMessageEnvelope =
  TConversationMessageEnvelope<TConversationFileMessage>;

// Union type for mixed content envelopes
type TConversationMixedMessageEnvelope =
  | TConversationTextMessageEnvelope
  | TConversationImageMessageEnvelope
  | TConversationFileMessageEnvelope;

export type {
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

  // Envelope types
  TConversationMessageEnvelope,
  TConversationTextMessageEnvelope,
  TConversationImageMessageEnvelope,
  TConversationFileMessageEnvelope,
  TConversationMixedMessageEnvelope,
};
