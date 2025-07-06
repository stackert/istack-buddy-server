import Anthropic from '@anthropic-ai/sdk';

// Main tool set type for Anthropic Istack tools
type TAnthropicIstackToolSet = {
  toolDefinitions: Anthropic.Messages.Tool[];
  executeToolCall: (
    toolName: string,
    toolArgs: any,
  ) => string | Promise<string>;
};

// Tool argument types
interface ISumoLogicQueryArgs {
  fromDate: string;
  toDate: string;
  formId?: string;
  submissionId?: string;
}

interface ISsoAutofillAssistanceArgs {
  formId: string;
  accountId: string;
}

interface IFormAndRelatedEntityOverviewArgs {
  formId: string;
  apiKey?: string;
}

export type {
  TAnthropicIstackToolSet,
  ISumoLogicQueryArgs,
  ISsoAutofillAssistanceArgs,
  IFormAndRelatedEntityOverviewArgs,
};
