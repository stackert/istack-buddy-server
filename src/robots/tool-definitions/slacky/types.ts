import Anthropic from '@anthropic-ai/sdk';

// Slacky tool names enum
enum SlackyToolsEnum {
  SumoLogicQuery = 'sumo_logic_query',
  SsoAutofillAssistance = 'sso_autofill_assistance',
}

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

export type {
  TAnthropicIstackToolSet,
  ISumoLogicQueryArgs,
  ISsoAutofillAssistanceArgs,
};

export { SlackyToolsEnum };
