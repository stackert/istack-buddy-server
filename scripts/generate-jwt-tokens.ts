import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

const JWT_SECRET = 'istack-buddy-secret-key-2024';
const JWT_EXPIRES_IN = '8h';

interface UserProfile {
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
}

interface UserProfiles {
  users: {
    [userId: string]: UserProfile;
  };
}

interface UserPermissions {
  user_permissions: {
    [userId: string]: {
      permissions: string[];
      jwtToken: string;
    };
  };
}

function generateJWTToken(userId: string, userProfile: UserProfile): string {
  const payload = {
    userId,
    email: userProfile.email,
    username: userProfile.username,
    accountType: userProfile.account_type_informal,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function main() {
  try {
    // Load user profiles
    const profilesPath = path.join(
      process.cwd(),
      'src',
      'user-profile',
      'user-profiles.json',
    );
    const profilesFile = fs.readFileSync(profilesPath, 'utf8');
    const profiles: UserProfiles = JSON.parse(profilesFile);

    // Load existing user permissions
    const permissionsPath = path.join(
      process.cwd(),
      'src',
      'authorization-permissions',
      'user-permissions.json',
    );
    const permissionsFile = fs.readFileSync(permissionsPath, 'utf8');
    const permissions: UserPermissions = JSON.parse(permissionsFile);

    console.log('Generating JWT tokens for users...');

    // Generate JWT tokens for each user
    for (const [userId, userProfile] of Object.entries(profiles.users)) {
      const jwtToken = generateJWTToken(userId, userProfile);

      // Update the user permissions with the new JWT token
      if (permissions.user_permissions[userId]) {
        permissions.user_permissions[userId].jwtToken = jwtToken;
        console.log(
          `✅ Generated JWT token for ${userId} (${userProfile.email}): ${jwtToken.substring(0, 20)}...`,
        );
      } else {
        console.log(`⚠️  User ${userId} not found in permissions file`);
      }
    }

    // Save updated permissions
    fs.writeFileSync(permissionsPath, JSON.stringify(permissions, null, 2));
    console.log('\n✅ JWT tokens generated and saved to user-permissions.json');

    // Display all tokens for easy testing
    console.log('\n📋 JWT Tokens for testing:');
    console.log('=====================================');
    for (const [userId, userData] of Object.entries(
      permissions.user_permissions,
    )) {
      const userProfile = profiles.users[userId];
      console.log(`${userId} (${userProfile?.email || 'Unknown'}):`);
      console.log(`  Token: ${userData.jwtToken}`);
      console.log(`  Permissions: ${userData.permissions.length} permissions`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error generating JWT tokens:', error);
    process.exit(1);
  }
}

main();
