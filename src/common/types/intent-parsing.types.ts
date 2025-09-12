export interface IntentParsingResponse {
  robotName?: string; // Optional - only used for legacy robot fallback
  intent: string;
  intentData: IntentData;
}

export interface IntentData {
  originalUserPrompt: string;
  subIntents: string[]; // MISSING from current types - MUST ADD
  subjects?: {
    formId?: string[];
    submissionId?: string[];
    case?: string[];
    jira?: string[];
    account?: string[];
    authProvider?: string[];
    startDate?: string[];
    endDate?: string[];
    // Additional subjects may be added as needed
    [key: string]: string[] | undefined;
  };
  [key: string]: any; // Allow additional robot-specific parameters
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
