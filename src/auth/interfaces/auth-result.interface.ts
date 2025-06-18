export interface AuthenticationResult {
  success: boolean;
  sessionId?: string;
  userId?: string;
  message?: string;
  permissions?: string[];
  jwtToken?: string;
  error?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  sessionId?: string;
  lastAccessTime?: Date;
  error?: string;
}
