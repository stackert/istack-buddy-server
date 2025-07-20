export interface AuthenticationResult {
  success: boolean;
  sessionId?: string;
  userId?: string;
  permissions?: string[];
  message?: string;
  jwtToken?: string;
}
