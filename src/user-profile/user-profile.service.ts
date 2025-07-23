import { Injectable, Inject } from '@nestjs/common';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';

// Import JSON files directly for compile-time checking
import userProfilesData from './user-profiles.json';

interface UserProfiles {
  users: {
    [userId: string]: {
      id: string;
      email: string;
      username: string;
      first_name: string;
      last_name: string;
      account_type_informal: string;
      current_account_status: string;
      is_email_verified: boolean;
      created_at: string;
      last_login: string;
    };
  };
}

@Injectable()
export class UserProfileService {
  private userProfiles: UserProfiles;

  constructor(
    private readonly logger: CustomLoggerService,
    private readonly authPermissionsService: AuthorizationPermissionsService,
    // Accept user profiles data as constructor parameter for testability
    // NOTE: At this time, we have no real user management and load from file.
    // When we integrate with a larger project, this will need to be changed.
    @Inject('UserProfilesData')
    userProfilesData: UserProfiles,
  ) {
    // Use provided user profiles data
    this.userProfiles = userProfilesData;
  }

  /**
   * Gets user profile by ID.
   */
  public async getUserProfileById(userId: string): Promise<any | null> {
    try {
      // Use imported user profiles data
      const userProfile = this.userProfiles.users[userId];
      if (!userProfile) {
        this.logger.logWithContext(
          'debug',
          'User profile not found',
          'UserProfileService.getUserProfileById',
          undefined,
          { userId },
        );
        return null;
      }

      return userProfile;
    } catch (error) {
      this.logger.error(
        'UserProfileService.getUserProfileById',
        'Failed to get user profile',
        error as Error,
        { userId },
      );
      return null;
    }
  }

  /**
   * Gets user profile by email.
   */
  public async getUserProfileByEmail(email: string): Promise<any | null> {
    try {
      // Search through user profiles to find by email
      for (const [userId, userProfile] of Object.entries(
        this.userProfiles.users,
      )) {
        if (userProfile.email === email) {
          this.logger.logWithContext(
            'debug',
            'Found user profile by email',
            'UserProfileService.getUserProfileByEmail',
            undefined,
            { email, userId },
          );
          return userProfile;
        }
      }

      this.logger.logWithContext(
        'debug',
        'User profile not found by email',
        'UserProfileService.getUserProfileByEmail',
        undefined,
        { email },
      );
      return null;
    } catch (error) {
      this.logger.error(
        'UserProfileService.getUserProfileByEmail',
        'Failed to get user profile by email',
        error as Error,
        { email },
      );
      return null;
    }
  }

  /**
   * Updates user profile.
   */
  public async updateUserProfile(
    userId: string,
    profileData: any,
  ): Promise<boolean> {
    try {
      this.logger.logWithContext(
        'debug',
        'Updating user profile',
        'UserProfileService.updateUserProfile',
        undefined,
        { userId },
      );

      // TODO: Update user profile in file-based storage
      // For now, return success
      return true;
    } catch (error) {
      this.logger.error(
        'UserProfileService.updateUserProfile',
        'Failed to update user profile',
        error as Error,
        { userId },
      );
      return false;
    }
  }

  /**
   * Adds a temporary user profile for form-marv sessions.
   * NOTE: This method is designed for testing and temporary users only.
   * When we integrate with a larger ecosystem, this will need to be replaced.
   */
  public addTemporaryUser(userId: string, profileData: any): void {
    this.userProfiles.users[userId] = {
      id: userId,
      email: profileData.email,
      username: profileData.username,
      first_name: profileData.first_name || 'Form',
      last_name: profileData.last_name || 'Marv',
      account_type_informal: profileData.account_type_informal || 'TEMPORARY',
      current_account_status: 'active',
      is_email_verified: false,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };

    this.logger.logWithContext(
      'log',
      'Temporary user profile added',
      'UserProfileService.addTemporaryUser',
      undefined,
      { userId },
    );
  }
}
