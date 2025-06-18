#!/usr/bin/env ts-node

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  timezone: string;
}

interface Config {
  development: DatabaseConfig;
  test: DatabaseConfig;
  production: DatabaseConfig;
}

async function loadConfig(): Promise<DatabaseConfig> {
  const configPath = path.join(process.cwd(), 'config', 'database.json');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config: Config = JSON.parse(configFile);

  const environment = process.env.NODE_ENV || 'development';
  const dbConfig = config[environment as keyof Config];

  // Replace environment variables in production config
  if (environment === 'production') {
    return {
      ...dbConfig,
      host: process.env.DB_HOST || dbConfig.host,
      port: parseInt(process.env.DB_PORT || dbConfig.port.toString()),
      database: process.env.DB_NAME || dbConfig.database,
      username: process.env.DB_USERNAME || dbConfig.username,
      password: process.env.DB_PASSWORD || dbConfig.password,
    };
  }

  return dbConfig;
}

async function seedDatabase() {
  const config = await loadConfig();

  console.log('🌱 Seeding database...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Host: ${config.host}:${config.port}`);
  console.log(`Database: ${config.database}`);

  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
  });

  try {
    await client.connect();

    // Set timezone
    await client.query(`SET timezone = '${config.timezone}'`);

    // Check if database has been created (tables exist)
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);

    if (parseInt(tablesResult.rows[0].table_count) === 0) {
      throw new Error(
        'Database has no tables. Please run "npm run db:create" first.',
      );
    }

    console.log('📊 Creating seed data...');

    // Begin transaction
    await client.query('BEGIN');

    try {
      // Create admin user
      console.log('👤 Creating admin user...');
      const adminUserId = await createAdminUser(client);

      // Create sample permission groups
      console.log('🔐 Creating permission groups...');
      const permissionGroupIds = await createPermissionGroups(client);

      // Create sample permissions
      console.log('⚙️  Creating permissions...');
      await createSamplePermissions(client);

      // Assign permissions to groups
      console.log('🔗 Assigning permissions to groups...');
      await assignPermissionsToGroups(client, permissionGroupIds);

      // Assign admin to groups
      console.log('👥 Adding admin to groups...');
      await assignUserToGroups(client, adminUserId, permissionGroupIds);

      // Create admin login credentials
      console.log('🔑 Creating admin login...');
      await createAdminLogin(client, adminUserId);

      // Create admin profile
      console.log('📝 Creating admin profile...');
      await createAdminProfile(client, adminUserId);

      // Commit transaction
      await client.query('COMMIT');

      console.log('✅ Database seeded successfully!');
      console.log('');
      console.log('🎯 Seed Data Summary:');
      console.log('   👤 Admin User: admin@example.com / password123');
      console.log(
        '   🔐 Permission Groups: Administrators, Instructors, Students, Observers',
      );
      console.log(
        '   ⚙️  Sample Permissions: Various instructor, student, and observer permissions',
      );
      console.log('');
      console.log('🚀 Ready for development!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function createAdminUser(client: Client): Promise<string> {
  // Create minimal user record (only id, created_at, updated_at)
  const result = await client.query(`
    INSERT INTO users DEFAULT VALUES RETURNING id
  `);

  return result.rows[0].id;
}

async function createPermissionGroups(
  client: Client,
): Promise<Record<string, string>> {
  const groups = [
    {
      name: 'Administrators',
      description: 'System administrators with full access',
      icon: 'admin',
      color_code: '#FF0000',
    },
    {
      name: 'Instructors',
      description: 'Teachers and course instructors',
      icon: 'teacher',
      color_code: '#0066CC',
    },
    {
      name: 'Students',
      description: 'Students and learners',
      icon: 'student',
      color_code: '#00AA00',
    },
    {
      name: 'Observers',
      description: 'Parents, auditors, and read-only users',
      icon: 'observer',
      color_code: '#888888',
    },
  ];

  const groupIds: Record<string, string> = {};

  for (const group of groups) {
    const result = await client.query(
      `
      INSERT INTO user_permission_groups (name, description, icon, color_code)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
      [group.name, group.description, group.icon, group.color_code],
    );

    groupIds[group.name.toLowerCase()] = result.rows[0].id;
  }

  return groupIds;
}

async function createSamplePermissions(client: Client): Promise<void> {
  const permissions = [
    // User profile permissions (using exact seeded prefixes)
    {
      id: 'user:profile:me:view',
      prefix: 'user:profile:me',
      description: 'View own profile',
    },
    {
      id: 'user:profile:me:edit',
      prefix: 'user:profile:me',
      description: 'Edit own profile',
    },
    {
      id: 'user:profile:public:view:basic',
      prefix: 'user:profile:public:view',
      description: 'View public profiles',
    },

    // Instructor permissions
    {
      id: 'instructor:course:create',
      prefix: 'instructor:course',
      description: 'Create courses',
    },
    {
      id: 'instructor:course:edit',
      prefix: 'instructor:course',
      description: 'Edit courses',
    },
    {
      id: 'instructor:course:delete',
      prefix: 'instructor:course',
      description: 'Delete courses',
    },
    {
      id: 'instructor:exams:create',
      prefix: 'instructor:exams',
      description: 'Create examinations',
    },
    {
      id: 'instructor:exams:grade',
      prefix: 'instructor:exams',
      description: 'Grade examinations',
    },
    {
      id: 'instructor:lesson:create',
      prefix: 'instructor:lesson',
      description: 'Create lesson plans',
    },
    {
      id: 'instructor:practice:create',
      prefix: 'instructor:practice',
      description: 'Create practice exams',
    },

    // Student permissions
    {
      id: 'student:course:enroll',
      prefix: 'student:course',
      description: 'Enroll in courses',
    },
    {
      id: 'student:course:view',
      prefix: 'student:course',
      description: 'View course content',
    },
    {
      id: 'student:exams:take',
      prefix: 'student:exams',
      description: 'Take examinations',
    },
    {
      id: 'student:practice:access',
      prefix: 'student:practice',
      description: 'Access practice materials',
    },
    {
      id: 'student:notebook:create',
      prefix: 'student:notebook',
      description: 'Create notebook entries',
    },
    {
      id: 'student:study:join',
      prefix: 'student:study',
      description: 'Join study groups',
    },

    // Observer permissions
    {
      id: 'observer:course:view',
      prefix: 'observer:course',
      description: 'View course information (read-only)',
    },
    {
      id: 'observer:student:progress',
      prefix: 'observer:student',
      description: 'View student progress (with conditions)',
    },

    // WebSocket system permissions
    {
      id: 'ws-sys:notifications:receive',
      prefix: 'ws-sys',
      description: 'Receive system notifications',
    },
    {
      id: 'ws-sys:chat:participate',
      prefix: 'ws-sys',
      description: 'Participate in chat systems',
    },

    // File manager permissions
    {
      id: 'file-manager:upload',
      prefix: 'file-manager',
      description: 'Upload files',
    },
    {
      id: 'file-manager:download',
      prefix: 'file-manager',
      description: 'Download files',
    },
  ];

  for (const permission of permissions) {
    await client.query(
      `
      INSERT INTO access_permissions (permission_id, permission_prefix, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (permission_id) DO NOTHING
    `,
      [permission.id, permission.prefix, permission.description],
    );
  }
}

async function getPermissionConditions(
  client: Client,
  permissionId: string,
): Promise<string> {
  const permissionDetails = await client.query(
    'SELECT required_conditions FROM access_permissions WHERE permission_id = $1',
    [permissionId],
  );

  const requiredConditions = permissionDetails.rows[0].required_conditions;

  // Set conditions based on required_conditions type
  switch (requiredConditions) {
    case 'NO_CONDITIONS_APPLY_ALLOW':
      return '{"requiredConditions": false, "alwaysEvaluateAs": true}';
    case 'NO_CONDITIONS_APPLY_DENY':
      return '{"requiredConditions": false, "alwaysEvaluateAs": false}';
    case 'ALLOWED_TO_OBSERVE_COURSES_OF_CONDITIONS':
      return '{"allowedToObserveCourseIds": []}';
    case 'ALLOWED_TO_OBSERVE_STUDENTS_OF_CONDITIONS':
      return '{"allowedToObserveStudentIds": []}';
    default:
      return '{"requiredConditions": false, "alwaysEvaluateAs": false}';
  }
}

async function assignPermissionsToGroups(
  client: Client,
  groupIds: Record<string, string>,
): Promise<void> {
  // Administrators get all permissions
  const allPermissions = await client.query(
    'SELECT permission_id FROM access_permissions',
  );
  for (const permission of allPermissions.rows) {
    const conditions = await getPermissionConditions(
      client,
      permission.permission_id,
    );

    await client.query(
      `
      INSERT INTO access_permission_assignments_group (permission_group_id, permission_id, allow_deny, conditions)
      VALUES ($1, $2, 'ALLOW', $3)
      ON CONFLICT DO NOTHING
    `,
      [groupIds.administrators, permission.permission_id, conditions],
    );
  }

  // Instructors get instructor and user permissions
  const instructorPermissions = [
    'user:profile:me:view',
    'user:profile:me:edit',
    'user:profile:public:view:basic',
    'instructor:course:create',
    'instructor:course:edit',
    'instructor:course:delete',
    'instructor:exams:create',
    'instructor:exams:grade',
    'instructor:lesson:create',
    'instructor:practice:create',
    'ws-sys:notifications:receive',
    'ws-sys:chat:participate',
    'file-manager:upload',
    'file-manager:download',
  ];

  for (const permissionId of instructorPermissions) {
    const conditions = await getPermissionConditions(client, permissionId);

    await client.query(
      `
      INSERT INTO access_permission_assignments_group (permission_group_id, permission_id, allow_deny, conditions)
      VALUES ($1, $2, 'ALLOW', $3)
      ON CONFLICT DO NOTHING
    `,
      [groupIds.instructors, permissionId, conditions],
    );
  }

  // Students get student and basic user permissions
  const studentPermissions = [
    'user:profile:me:view',
    'user:profile:me:edit',
    'user:profile:public:view:basic',
    'student:course:enroll',
    'student:course:view',
    'student:exams:take',
    'student:practice:access',
    'student:notebook:create',
    'student:study:join',
    'ws-sys:notifications:receive',
    'ws-sys:chat:participate',
  ];

  for (const permissionId of studentPermissions) {
    const conditions = await getPermissionConditions(client, permissionId);

    await client.query(
      `
      INSERT INTO access_permission_assignments_group (permission_group_id, permission_id, allow_deny, conditions)
      VALUES ($1, $2, 'ALLOW', $3)
      ON CONFLICT DO NOTHING
    `,
      [groupIds.students, permissionId, conditions],
    );
  }

  // Observers get read-only permissions
  const observerPermissions = [
    'user:profile:me:view',
    'user:profile:public:view:basic',
    'observer:course:view',
    'observer:student:progress',
    'ws-sys:notifications:receive',
  ];

  for (const permissionId of observerPermissions) {
    const conditions = await getPermissionConditions(client, permissionId);

    await client.query(
      `
      INSERT INTO access_permission_assignments_group (permission_group_id, permission_id, allow_deny, conditions)
      VALUES ($1, $2, 'ALLOW', $3)
      ON CONFLICT DO NOTHING
    `,
      [groupIds.observers, permissionId, conditions],
    );
  }
}

async function assignUserToGroups(
  client: Client,
  userId: string,
  groupIds: Record<string, string>,
): Promise<void> {
  // Add admin to administrators group
  await client.query(
    `
    INSERT INTO user_permission_group_membership (user_id, permission_group_id, status)
    VALUES ($1, $2, 'ACTIVE')
    ON CONFLICT DO NOTHING
  `,
    [userId, groupIds.administrators],
  );
}

async function createAdminLogin(client: Client, userId: string): Promise<void> {
  // Note: In production, this should be a properly hashed password
  // This is just for development seeding
  const hashedPassword =
    '$2b$10$rHxriVNVON6.dXV7gVT5kezjNHYKL5XpXiKEd4hx4R4QqJTKfV8.i'; // "password123"

  await client.query(
    `
    INSERT INTO user_logins (user_id, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET password_hash = $2
  `,
    [userId, hashedPassword],
  );
}

async function createAdminProfile(
  client: Client,
  userId: string,
): Promise<void> {
  await client.query(
    `
    INSERT INTO user_profiles (
      user_id, username, first_name, last_name, email, user_defined_tags,
      current_account_status, is_email_verified, email_verified_at,
      account_type_informal, ui_handle, display_name, bio_about_me,
      profile_visibility, ui_stash
    ) VALUES (
      $1, 'admin', 'System', 'Administrator', 'admin@example.com', 'seed-data',
      'ACTIVE', true, NOW(),
      'ADMINISTRATOR', 'admin', 'System Administrator', 
      'System administrator account for managing the platform.',
      'PRIVATE', '{}'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      username = 'admin',
      first_name = 'System',
      last_name = 'Administrator',
      email = 'admin@example.com',
      user_defined_tags = 'seed-data',
      current_account_status = 'ACTIVE',
      is_email_verified = true,
      email_verified_at = NOW(),
      account_type_informal = 'ADMINISTRATOR',
      ui_handle = 'admin',
      display_name = 'System Administrator',
      bio_about_me = 'System administrator account for managing the platform.',
      profile_visibility = 'PRIVATE'
  `,
    [userId],
  );
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Database seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };
