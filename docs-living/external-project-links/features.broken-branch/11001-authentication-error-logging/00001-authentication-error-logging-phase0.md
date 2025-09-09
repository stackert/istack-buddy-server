# Authentication System - Phase 0: Foundation Setup

## Overview

WE NEED TO DO MINIMAL DATABASE DESIGN - USERS, PERMISSIONS,
LAYOUT TERMINOLOGY.

This Phase 0 plan provides the concrete implementation details needed before starting the main authentication system development. It bridges the gap between architectural planning and actual NestJS implementation by establishing the technical foundation, dependencies, and project structure.

## Phase 0 Priority & Timeline

**Priority: 0 (Pre-Implementation Foundation)**
**Dependencies: None**
**Required Before: Phase 1 of main authentication plan**
**Estimated Duration: 3-4 days**
**Risk Level: LOW (Infrastructure setup)**

## Implementation Checklist

- [ ] Package dependencies installation
- [ ] Database configuration and connection
- [ ] TypeORM entities and migrations
- [ ] Configuration module setup
- [ ] Basic auth module structure
- [ ] Environment configuration
- [ ] Development database setup
- [ ] Initial security configuration

## 1. Package Dependencies & Installation

### 1.1 Core Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/jwt": "^10.1.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/throttler": "^5.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "bcrypt": "^5.1.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "uuid": "^9.0.0",
    "winston": "^3.10.0",
    "nest-winston": "^1.9.3",
    "socket.io": "^4.7.2",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/passport-jwt": "^3.0.9",
    "@types/passport-local": "^1.0.35",
    "@types/bcrypt": "^5.0.0",
    "@types/uuid": "^9.0.2",
    "@nestjs/testing": "^10.0.0",
    "jest": "^29.6.0",
    "supertest": "^6.3.3"
  }
}
```

### 1.2 Installation Commands

```bash
# Install core dependencies
npm install @nestjs/typeorm @nestjs/config @nestjs/jwt @nestjs/passport
npm install @nestjs/websockets @nestjs/platform-socket.io @nestjs/throttler
npm install typeorm pg passport passport-jwt passport-local bcrypt
npm install class-validator class-transformer uuid winston nest-winston
npm install socket.io reflect-metadata rxjs

# Install dev dependencies
npm install -D @types/passport-jwt @types/passport-local @types/bcrypt @types/uuid
npm install -D @nestjs/testing jest supertest
```

## 2. Database Configuration & Setup

### 2.1 PostgreSQL Database Setup

```sql
-- Create database and user for development
CREATE DATABASE istack_buddy_chat_dev;
CREATE USER istack_buddy_chat WITH PASSWORD 'dev_password_change_in_prod';
GRANT ALL PRIVILEGES ON DATABASE istack_buddy_chat_dev TO istack_buddy_chat;

-- Enable UUID extension
\c istack_buddy_chat_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2.2 TypeORM Configuration Module

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'istack_buddy_chat',
    password: process.env.DB_PASSWORD || 'dev_password_change_in_prod',
    database: process.env.DB_NAME || 'istack_buddy_chat_dev',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  }),
);
```

### 2.3 Database Module

```typescript
// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        configService.get('database'),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
```

## 3. TypeORM Entities & Database Schema

### 3.1 User Entity (Adapted from how-do-you-know)

```typescript
// src/auth/entities/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserAccountType {
  GUEST = 'guest',
  EMPLOYEE = 'employee',
  SUPERVISOR = 'supervisor',
}

export enum UserAccountStatus {
  PENDING_VERIFICATION = 'pending-verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  passwordHash: string;

  // Chat-specific fields
  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 'offline' })
  currentStatus: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  chatPreferences: Record<string, any>;

  // Profile fields
  @Column({
    type: 'enum',
    enum: UserAccountType,
    default: UserAccountType.GUEST,
  })
  accountType: UserAccountType;

  @Column({
    type: 'enum',
    enum: UserAccountStatus,
    default: UserAccountStatus.PENDING_VERIFICATION,
  })
  currentAccountStatus: UserAccountStatus;

  @Column({ default: false })
  isEmailVerified: boolean;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relations
  @ManyToMany(() => AccessPermissionGroup, (group) => group.users)
  permissionGroups: AccessPermissionGroup[];

  @OneToMany(
    () => AccessPermissionAssignmentUser,
    (assignment) => assignment.user,
  )
  directPermissions: AccessPermissionAssignmentUser[];
}
```

### 3.2 Permission System Entities

```typescript
// src/auth/entities/access-permission.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('access_permissions')
export class AccessPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  permissionId: string; // e.g., 'chat:room:join'

  @Column()
  humanReadableName: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  domain: string; // e.g., 'chat'

  @Column()
  function: string; // e.g., 'room'

  @Column()
  action: string; // e.g., 'join'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// src/auth/entities/access-permission-group.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from './user.entity';

@Entity('access_permission_groups')
export class AccessPermissionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  groupName: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => User, (user) => user.permissionGroups)
  @JoinTable({
    name: 'access_permission_group_memberships',
    joinColumn: { name: 'groupId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  users: User[];
}

// src/auth/entities/access-permission-assignment-user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { AccessPermission } from './access-permission.entity';

@Entity('access_permission_assignments_user')
export class AccessPermissionAssignmentUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  permissionId: string;

  @Column({ nullable: true })
  assignedBy: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.directPermissions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => AccessPermission)
  @JoinColumn({ name: 'permissionId' })
  permission: AccessPermission;
}
```

### 3.3 Database Migration Script

```typescript
// src/migrations/001-initial-auth-schema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialAuthSchema1701234567890 implements MigrationInterface {
  name = 'InitialAuthSchema1701234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enum types
    await queryRunner.query(
      `CREATE TYPE "user_account_type_enum" AS ENUM('guest', 'employee', 'supervisor')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_account_status_enum" AS ENUM('pending-verification', 'active', 'suspended', 'deactivated')`,
    );

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "displayName" character varying,
        "avatarUrl" character varying,
        "currentStatus" character varying NOT NULL DEFAULT 'offline',
        "lastSeenAt" TIMESTAMP WITH TIME ZONE,
        "chatPreferences" jsonb NOT NULL DEFAULT '{}',
        "accountType" "user_account_type_enum" NOT NULL DEFAULT 'guest',
        "currentAccountStatus" "user_account_status_enum" NOT NULL DEFAULT 'pending-verification',
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    // Create permission system tables
    await queryRunner.query(`
      CREATE TABLE "access_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "permissionId" character varying NOT NULL,
        "humanReadableName" character varying NOT NULL,
        "description" character varying,
        "domain" character varying NOT NULL,
        "function" character varying NOT NULL,
        "action" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_permissions_permissionId" UNIQUE ("permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "access_permission_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "groupName" character varying NOT NULL,
        "description" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_permission_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_permission_groups_groupName" UNIQUE ("groupName")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "access_permission_assignments_user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        "assignedBy" character varying,
        "reason" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_permission_assignments_user" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "access_permission_group_memberships" (
        "groupId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_access_permission_group_memberships" PRIMARY KEY ("groupId", "userId")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "access_permission_assignments_user" 
      ADD CONSTRAINT "FK_assignments_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "access_permission_assignments_user" 
      ADD CONSTRAINT "FK_assignments_permission" 
      FOREIGN KEY ("permissionId") REFERENCES "access_permissions"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "access_permission_group_memberships" 
      ADD CONSTRAINT "FK_group_memberships_group" 
      FOREIGN KEY ("groupId") REFERENCES "access_permission_groups"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "access_permission_group_memberships" 
      ADD CONSTRAINT "FK_group_memberships_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(
      `CREATE INDEX "IDX_users_accountType" ON "users" ("accountType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_currentStatus" ON "users" ("currentStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_lastSeenAt" ON "users" ("lastSeenAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_permissions_domain" ON "access_permissions" ("domain")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assignments_userId" ON "access_permission_assignments_user" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "access_permission_group_memberships"`);
    await queryRunner.query(`DROP TABLE "access_permission_assignments_user"`);
    await queryRunner.query(`DROP TABLE "access_permission_groups"`);
    await queryRunner.query(`DROP TABLE "access_permissions"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "user_account_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_account_type_enum"`);
  }
}
```

## 4. Configuration Module Setup

### 4.1 Main Configuration Module

```typescript
// src/config/config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import databaseConfig from './database.config';
import authConfig from './auth.config';
import appConfig from './app.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, appConfig],
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class ConfigModule {}
```

### 4.2 Auth Configuration

```typescript
// src/config/auth.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'change_this_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 5,
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL) || 60,
}));
```

### 4.3 App Configuration

```typescript
// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT) || 3000,
  websocketPort: parseInt(process.env.WEBSOCKET_PORT) || 3001,
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ],
}));
```

## 5. Project Structure Setup

### 5.1 Auth Module Structure

```
src/
├── auth/
│   ├── controllers/
│   │   └── auth.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── permission.service.ts
│   │   └── user.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── websocket-auth.guard.ts
│   │   └── permission.guard.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── decorators/
│   │   ├── require-permissions.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── register.dto.ts
│   │   └── auth-response.dto.ts
│   ├── entities/
│   │   ├── user.entity.ts
│   │   ├── access-permission.entity.ts
│   │   ├── access-permission-group.entity.ts
│   │   └── access-permission-assignment-user.entity.ts
│   ├── interfaces/
│   │   ├── authenticated-request.interface.ts
│   │   ├── jwt-payload.interface.ts
│   │   └── authenticated-socket.interface.ts
│   └── auth.module.ts
├── config/
│   ├── database.config.ts
│   ├── auth.config.ts
│   ├── app.config.ts
│   └── config.module.ts
├── database/
│   └── database.module.ts
├── common/
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   └── exceptions/
│       └── chat-exceptions.ts
├── logging/
│   ├── logging.module.ts
│   └── security-logger.service.ts
└── migrations/
    └── 001-initial-auth-schema.ts
```

## 6. Environment Configuration

### 6.1 Development Environment (.env)

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=istack_buddy_chat
DB_PASSWORD=dev_password_change_in_prod
DB_NAME=istack_buddy_chat_dev

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# Application
NODE_ENV=development
PORT=3000
WEBSOCKET_PORT=3001
LOG_LEVEL=debug

# Rate Limiting
RATE_LIMIT_MAX=5
RATE_LIMIT_TTL=60

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 6.2 Production Environment Template (.env.production)

```bash
# Database Configuration
DB_HOST=your_production_db_host
DB_PORT=5432
DB_USERNAME=istack_buddy_chat_prod
DB_PASSWORD=your_secure_production_password
DB_NAME=istack_buddy_chat_prod

# Authentication
JWT_SECRET=your_super_secure_production_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Application
NODE_ENV=production
PORT=3000
WEBSOCKET_PORT=3001
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_MAX=10
RATE_LIMIT_TTL=60

# CORS
CORS_ORIGINS=https://yourdomain.com
```

## 7. Initial Permission Seed Data

### 7.1 Permission Seed Script

```typescript
// src/auth/seeds/permissions.seed.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessPermission } from '../entities/access-permission.entity';
import { AccessPermissionGroup } from '../entities/access-permission-group.entity';

@Injectable()
export class PermissionSeedService {
  constructor(
    @InjectRepository(AccessPermission)
    private permissionRepository: Repository<AccessPermission>,
    @InjectRepository(AccessPermissionGroup)
    private groupRepository: Repository<AccessPermissionGroup>,
  ) {}

  async seedChatPermissions() {
    const chatPermissions = [
      // Room management
      {
        id: 'chat:room:create',
        name: 'Create Chat Rooms',
        domain: 'chat',
        function: 'room',
        action: 'create',
      },
      {
        id: 'chat:room:join',
        name: 'Join Chat Rooms',
        domain: 'chat',
        function: 'room',
        action: 'join',
      },
      {
        id: 'chat:room:invite',
        name: 'Invite to Chat Rooms',
        domain: 'chat',
        function: 'room',
        action: 'invite',
      },
      {
        id: 'chat:room:leave',
        name: 'Leave Chat Rooms',
        domain: 'chat',
        function: 'room',
        action: 'leave',
      },

      // Messaging
      {
        id: 'chat:message:send',
        name: 'Send Messages',
        domain: 'chat',
        function: 'message',
        action: 'send',
      },
      {
        id: 'chat:message:view',
        name: 'View Messages',
        domain: 'chat',
        function: 'message',
        action: 'view',
      },
      {
        id: 'chat:message:edit',
        name: 'Edit Messages',
        domain: 'chat',
        function: 'message',
        action: 'edit',
      },
      {
        id: 'chat:message:delete',
        name: 'Delete Messages',
        domain: 'chat',
        function: 'message',
        action: 'delete',
      },

      // Robot interaction (EMPLOYEE ONLY)
      {
        id: 'chat:robot:interact',
        name: 'Interact with Robots',
        domain: 'chat',
        function: 'robot',
        action: 'interact',
      },
      {
        id: 'chat:robot:share',
        name: 'Share Robot Responses',
        domain: 'chat',
        function: 'robot',
        action: 'share',
      },

      // File operations
      {
        id: 'chat:file:upload',
        name: 'Upload Files',
        domain: 'chat',
        function: 'file',
        action: 'upload',
      },
      {
        id: 'chat:file:download',
        name: 'Download Files',
        domain: 'chat',
        function: 'file',
        action: 'download',
      },

      // Escalation
      {
        id: 'chat:escalation:create',
        name: 'Create Escalations',
        domain: 'chat',
        function: 'escalation',
        action: 'create',
      },
      {
        id: 'chat:escalation:assign',
        name: 'Assign Escalations',
        domain: 'chat',
        function: 'escalation',
        action: 'assign',
      },

      // Supervisor functions
      {
        id: 'supervisor:chat:monitor',
        name: 'Monitor Chat Conversations',
        domain: 'supervisor',
        function: 'chat',
        action: 'monitor',
      },
      {
        id: 'supervisor:chat:intervene',
        name: 'Intervene in Chat',
        domain: 'supervisor',
        function: 'chat',
        action: 'intervene',
      },
    ];

    for (const perm of chatPermissions) {
      await this.permissionRepository.save({
        permissionId: perm.id,
        humanReadableName: perm.name,
        domain: perm.domain,
        function: perm.function,
        action: perm.action,
      });
    }

    // Create permission groups
    const groups = [
      { name: 'guests', description: 'Basic guest user permissions' },
      { name: 'employees', description: 'Standard employee permissions' },
      { name: 'supervisors', description: 'Supervisor-level permissions' },
    ];

    for (const group of groups) {
      await this.groupRepository.save(group);
    }
  }
}
```

## 8. Updated App Module Integration

### 8.1 Root App Module

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { LoggingModule } from './logging/logging.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggingModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

## 9. Basic DTOs and Interfaces

### 9.1 Authentication DTOs

```typescript
// src/auth/dto/login.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

// src/auth/dto/auth-response.dto.ts
export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    accountType: string;
    displayName?: string;
  };
  expiresIn: string;
}
```

### 9.2 Interfaces

```typescript
// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  accountType: 'guest' | 'employee' | 'supervisor';
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
}

// src/auth/interfaces/authenticated-socket.interface.ts
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    accountType: 'guest' | 'employee' | 'supervisor';
    permissions: string[];
    sessionId: string;
  };
}
```

## 10. Phase 0 Completion Checklist

### Database Setup

- [ ] PostgreSQL database created
- [ ] UUID extension enabled
- [ ] Database user and permissions configured
- [ ] Connection tested

### NestJS Setup

- [ ] All dependencies installed
- [ ] TypeORM configuration working
- [ ] Environment configuration loaded
- [ ] Basic module structure created

### Entity & Migration Setup

- [ ] User entity created
- [ ] Permission system entities created
- [ ] Initial migration script ready
- [ ] Database schema matches entities

### Configuration

- [ ] Environment variables configured
- [ ] JWT configuration setup
- [ ] Database connection configuration
- [ ] Rate limiting configuration

### Project Structure

- [ ] Auth module folder structure created
- [ ] Configuration module setup
- [ ] Basic DTOs and interfaces defined
- [ ] Updated app.module.ts

## Success Criteria

✅ **Database Connection**: Successfully connects to PostgreSQL
✅ **Entity Compilation**: All TypeORM entities compile without errors
✅ **Environment Loading**: Configuration loads from environment variables
✅ **Module Structure**: Basic auth module structure is in place
✅ **Migration Ready**: Database migration can be executed
✅ **Dependencies Resolved**: All npm packages install successfully

## Next Steps

After Phase 0 completion, proceed to **Phase 1: Core Authentication** from the main authentication plan:

1. Run database migrations
2. Implement JWT services
3. Create authentication controllers
4. Build WebSocket authentication guard
5. Set up permission system services

This foundation ensures that Phase 1 implementation can proceed smoothly with all infrastructure in place.
