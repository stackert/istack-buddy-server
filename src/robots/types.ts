import Anthropic from '@anthropic-ai/sdk';
import { IConversationMessage } from 'src/chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from '../ConversationLists/types';

// Direct exports of ConversationLists types for robots
export type {
  TConversationTextMessage,
  TConversationMessageContentString,
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

export type TStreamingCallbackMessageOnFullMessageReceived = {
  content: { payload: string; type: 'text/plain' };
};

export interface IStreamingCallbacks {
  onStreamChunkReceived: (chunk: string, contentType?: string) => void;
  onStreamStart: (
    message: IConversationMessage<TConversationMessageContentString>,
  ) => void;
  onStreamFinished: (
    message: IConversationMessage<TConversationMessageContentString>,
  ) => void;
  onFullMessageReceived: (
    message: TStreamingCallbackMessageOnFullMessageReceived,
  ) => void;
  onError: (error: any) => void;
}
