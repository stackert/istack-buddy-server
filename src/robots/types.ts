// Re-export ConversationLists types for robot compatibility
export type {
  TConversationTextMessageEnvelope as TMessageEnvelope,
  TConversationTextMessage as TRobotMessage,
  TConversationMessageContentString as TMessageContent,
} from '../ConversationLists/types';

// Legacy type for backward compatibility
type TMessageEnvelopePayload = {
  messages: any[]; // deprecated - use TConversationTextMessageEnvelope instead
};
