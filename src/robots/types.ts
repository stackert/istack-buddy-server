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
};

export type { TAnthropicIstackToolSet };
