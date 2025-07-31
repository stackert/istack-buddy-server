import Anthropic from '@anthropic-ai/sdk';

// Slacky tool names enum
enum SlackyToolsEnum {
  SumoLogicQuery = 'sumo_logic_query',
  SsoAutofillAssistance = 'sso_autofill_assistance',
  CollectUserFeedback = 'collect_user_feedback',
  CollectUserRating = 'collect_user_rating',
}

// Main tool set type for Anthropic Istack tools
type TAnthropicIstackToolSet = {
  toolDefinitions: Anthropic.Messages.Tool[];
  executeToolCall: (
    toolName: string,
    toolArgs: any,
  ) => string | Promise<string>;
};

// Arguments for Sumo Logic query tool
interface ISumoLogicQueryArgs {
  fromDate: string;
  toDate: string;
  formId?: string;
  submissionId?: string;
}

// Arguments for SSO auto-fill assistance tool
interface ISsoAutofillAssistanceArgs {
  formId: string;
  accountId: string;
}

// Arguments for collect user feedback tool
interface ICollectUserFeedbackArgs {
  feedback: string;
  category:
    | 'conversation'
    | 'service'
    | 'feature_request'
    | 'bug_report'
    | 'other';
}

// Arguments for collect user rating tool
interface ICollectUserRatingArgs {
  rating: number; // -5 to +5
  context: string;
  comment?: string;
}

export { SlackyToolsEnum };

export type {
  TAnthropicIstackToolSet,
  ISumoLogicQueryArgs,
  ISsoAutofillAssistanceArgs,
  ICollectUserFeedbackArgs,
  ICollectUserRatingArgs,
};
