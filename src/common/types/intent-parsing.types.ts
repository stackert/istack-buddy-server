/**
 * Types for Intent Parsing System
 */

export interface IntentData {
  originalUserPrompt: string;
  subjects?: {
    formId?: string[];
    submissionId?: string[];
    case?: string[];
    jira?: string[];
    account?: string[];
    authProvider?: string[];
    [key: string]: string[] | undefined;
  };
  [key: string]: any; // Allow additional robot-specific parameters
}

export interface IntentResult {
  robotName: string;
  intent: string;
  intentData: IntentData;
}

export interface IntentParsingError {
  error: string;
  reason: string;
}

export type IntentParsingResponse = IntentResult | IntentParsingError;

/**
 * Type guard to check if result is an error
 */
export function isIntentParsingError(result: IntentParsingResponse): result is IntentParsingError {
  return 'error' in result;
}
