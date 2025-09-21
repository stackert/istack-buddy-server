export interface IntentParsingResponse {
  intent: string;
  intentData: IntentData;
  devDebugRecommendedExecutor?: string; // For debugging - suggested executor class name
  devDebugRecommendedRobot?: string; // For debugging - fallback robot name
}

export interface IntentData {
  conversationId: string; // REQUIRED - never have intent without conversation
  originalUserPrompt: string;
  subIntents: string[];
  isConversationContinuation: boolean; // true if this message is continuing a previous conversation/request
  subjects?: {
    formId?: string[];
    submissionId?: string[];
    submitActionId?: string[];
    submitActionType?: string[];
    accountId?: string[];
    authProviderId?: string[];
    case?: string[];
    jira?: string[];
    // NOTE: startDate/endDate moved to separate dateRange object per API spec
    [key: string]: string[] | undefined;
  };
  dateRange?: {
    startDate?: string; // ISO8601 format in separate DateRangeDto
    endDate?: string; // ISO8601 format in separate DateRangeDto
  };
  // NOTE: currentRobot, lastRobot retrieved from conversation.getCurrentRobot()
  [key: string]: any; // Allow additional parameters
}

export interface IntentParsingError {
  error: string;
  reason: string;
}

export type IntentParsingResult = IntentParsingResponse | IntentParsingError;

/**
 * Type guard to check if an IntentParsingResult is an error
 */
export function isIntentParsingError(
  result: IntentParsingResult,
): result is IntentParsingError {
  return 'error' in result;
}

// Robot Intent Registry Types
export interface RobotIntent {
  intent: string;
  subIntents: string[];
  requiredSubjects?: string[];
  description?: string;
  priority?: number; // For routing when multiple robots handle same intent
}

export interface RobotIntentRegistry {
  robotName: string;
  supportedIntents: RobotIntent[];
}

export interface PreviousConversationContext {
  lastRobotMessageText?: string;
  lastIntent?: IntentParsingResponse;
}
