import Anthropic from '@anthropic-ai/sdk';

// Direct exports of ConversationLists types for robots
export type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
  TConversationMessageEnvelope,
  TConversationListMessage,
} from '../ConversationLists/types';

// Type for robot responses that omits messageId since robots cannot create them
export type TRobotResponseEnvelope = Omit<
  import('../ConversationLists/types').TConversationTextMessageEnvelope,
  'messageId' | 'envelopePayload'
> & {
  envelopePayload: Omit<
    import('../ConversationLists/types').TConversationTextMessage,
    'messageId'
  >;
};

type TAnthropicIstackToolSet = {
  toolDefinitions: Anthropic.Messages.Tool[];
  executeToolCall: (toolName: string, toolArgs: any) => any | Promise<any>;
  transformToolResponse?: (functionName: string, functionResponse: any) => any;
};

export type { TAnthropicIstackToolSet };

/**
 * Streaming callbacks interface for robot chat responses
 * All handlers are required and should be implemented by the conversation manager
 * Callbacks receive minimal necessary data - conversation manager handles message IDs, timestamps, etc.
 */
export interface IStreamingCallbacks {
  onStreamChunkReceived: (chunk: string, contentType?: string) => void;
  onStreamStart: (
    message: import('../ConversationLists/types').TConversationTextMessageEnvelope,
  ) => void;
  onStreamFinished: (
    content: string,
    authorRole: string,
    contentType?: string,
  ) => void;
  onFullMessageReceived: (content: string, contentType?: string) => void;
  onError: (error: any) => void;
}
