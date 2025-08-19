import { slackyToolDefinitions } from './slackyToolDefinitions';
import { performSlackyToolCall } from './performSlackyToolCall';
import type { TAnthropicIstackToolSet } from './types';
export { ObservationMakerViewer } from './ObservationMakerViewer';
export * from './slack-formatters';

// Export types
export type {
  TAnthropicIstackToolSet,
  ISumoLogicQueryArgs,
  ISsoAutofillAssistanceArgs,
  ICollectUserFeedbackArgs,
  ICollectUserRatingArgs,
} from './types';

// Export enums
export { SlackyToolsEnum } from './types';

// Main slacky tool set
const slackyToolSet: TAnthropicIstackToolSet = {
  toolDefinitions: slackyToolDefinitions,
  executeToolCall: performSlackyToolCall,
};

export { slackyToolSet };
