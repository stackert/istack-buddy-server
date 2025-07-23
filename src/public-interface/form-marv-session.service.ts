import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { UserProfileService } from '../user-profile/user-profile.service';

export interface FormMarvSession {
  secretKey: string;
  userId: string;
  jwtToken: string;
  formId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresInMs: number;
}

@Injectable()
export class FormMarvSessionService {
  private formMarvSessions: Map<string, FormMarvSession> = new Map();

  constructor(
    private readonly authPermissionsService: AuthorizationPermissionsService,
    private readonly userProfileService: UserProfileService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Generate a fake 6-digit formId starting with 1 or higher
   */
  private generateFakeFormId(): string {
    // Generate a random number between 100000 and 999999
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Create a new form-marv session with a temporary user
   * @param formId Optional formId, will generate a fake 6-digit one if not provided
   * @returns The secret key for the session
   */
  createSession(formId?: string): string {
    const secretKey = uuidv4();
    const userId = `form-marv-temp-${uuidv4()}`;
    const now = new Date();
    const expiresInMs = 24 * 60 * 60 * 1000; // 24 hours
    const sessionFormId = formId || this.generateFakeFormId();

    // Create a temporary user with the required permission
    this.authPermissionsService.addUser(
      userId,
      ['cx-agent:form-marv:read'],
      [],
    );

    // Create a temporary user profile
    this.userProfileService.addTemporaryUser(userId, {
      email: `${userId}@form-marv.temp`,
      username: userId,
      account_type_informal: 'TEMPORARY',
      first_name: 'Form',
      last_name: 'Marv',
    });

    // Create JWT token for the temporary user
    const jwtToken = jwt.sign(
      {
        userId,
        email: `${userId}@form-marv.temp`,
        username: userId,
        accountType: 'TEMPORARY',
      },
      'istack-buddy-secret-key-2024',
      { expiresIn: '8h' },
    );

    const session: FormMarvSession = {
      secretKey,
      userId,
      jwtToken,
      formId: sessionFormId,
      createdAt: now,
      lastActivityAt: now,
      expiresInMs,
    };

    this.formMarvSessions.set(secretKey, session);

    this.logger.logWithContext(
      'log',
      'Form-marv session created',
      'FormMarvSessionService.createSession',
      undefined,
      { secretKey, userId, formId: sessionFormId },
    );

    return secretKey;
  }

  /**
   * Get a session by secret key and update last activity
   * @param secretKey The secret key to look up
   * @returns The session if found and not expired, null otherwise
   */
  getSession(secretKey: string): FormMarvSession | null {
    const session = this.formMarvSessions.get(secretKey);

    if (!session) {
      return null;
    }

    // Check if session is expired
    const now = new Date();
    const expirationTime = new Date(
      session.createdAt.getTime() + session.expiresInMs,
    );

    if (now > expirationTime) {
      this.formMarvSessions.delete(secretKey);
      this.logger.logWithContext(
        'log',
        'Form-marv session expired and removed',
        'FormMarvSessionService.getSession',
        undefined,
        { secretKey },
      );
      return null;
    }

    // Update last activity
    session.lastActivityAt = now;
    this.formMarvSessions.set(secretKey, session);

    return session;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [secretKey, session] of this.formMarvSessions.entries()) {
      const expirationTime = new Date(
        session.createdAt.getTime() + session.expiresInMs,
      );
      if (now > expirationTime) {
        expiredKeys.push(secretKey);
      }
    }

    expiredKeys.forEach((key) => {
      this.formMarvSessions.delete(key);
    });

    if (expiredKeys.length > 0) {
      this.logger.logWithContext(
        'log',
        'Cleaned up expired form-marv sessions',
        'FormMarvSessionService.cleanupExpiredSessions',
        undefined,
        { expiredCount: expiredKeys.length },
      );
    }
  }

  /**
   * Get session statistics for debugging
   */
  getSessionStats(): { total: number; active: number } {
    const now = new Date();
    let activeCount = 0;

    for (const session of this.formMarvSessions.values()) {
      const expirationTime = new Date(
        session.createdAt.getTime() + session.expiresInMs,
      );
      if (now <= expirationTime) {
        activeCount++;
      }
    }

    return {
      total: this.formMarvSessions.size,
      active: activeCount,
    };
  }
}
