import Anthropic from '@anthropic-ai/sdk';

// Direct exports of ConversationLists types for robots
export type {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
  TConversationMessageContentString,
  TConversationMessageEnvelope,
  TConversationListMessage,
} from '../ConversationLists/types';

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
  onStreamChunkReceived: (chunk: string) => void;
  onStreamStart: (
    message: import('../ConversationLists/types').TConversationTextMessageEnvelope,
  ) => void;
  onStreamFinished: (content: string, authorRole: string) => void;
  onFullMessageReceived: (content: string) => void;
  onError: (error: any) => void;
}
