import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

@Injectable()
export class UserProfileService {
  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Gets user profile by ID.
   */
  public async getUserProfileById(userId: string): Promise<any | null> {
    this.logger.logWithContext(
      'debug',
      'Getting user profile by ID',
      'UserProfileService.getUserProfileById',
      undefined,
      { userId },
    );

    try {
      // Try multiple possible paths for the file
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'user-profile', 'user-profiles.json'),
        path.join(__dirname, 'user-profiles.json'),
        path.join(process.cwd(), 'src', 'user-profile', 'user-profiles.json'),
      ];

      let profilesFile = null;
      let usedPath = '';

      for (const filePath of possiblePaths) {
        try {
          profilesFile = fs.readFileSync(filePath, 'utf8');
          usedPath = filePath;
          break;
        } catch (fileError) {
          // Continue to next path
        }
      }

      if (!profilesFile) {
        throw new Error(
          'Could not find user-profiles.json in any expected location',
        );
      }

      const profiles = JSON.parse(profilesFile);

      const userProfile = profiles.users[userId];
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
   * Updates user profile.
   */
  public async updateUserProfile(
    userId: string,
    profileData: any,
  ): Promise<boolean> {
    this.logger.logWithContext(
      'debug',
      'Updating user profile',
      'UserProfileService.updateUserProfile',
      undefined,
      { userId },
    );

    try {
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
}
