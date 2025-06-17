# Database Schema & Design Plan

## Overview

Comprehensive database design for the chat system using proven patterns from how-do-you-know project with PostgreSQL, proper indexing, and audit capabilities.

## Implementation Order

**Priority: 3**
**Dependencies: 11001-authentication-error-logging-plan.md**
**Required Before: Room management, message persistence, file storage**

## Features Included

### 1. Core Schema Design

- User management with chat-specific extensions
- Permission system (domain:function:action)
- Room/conversation management
- Message storage and indexing
- File attachment metadata
- Robot interaction tracking

### 2. Database Conventions (from how-do-you-know)

- UUID primary keys
- Timestamp tracking (created_at, updated_at, deleted_at)
- Soft delete patterns
- Audit trail tables
- Trigger-based automation
- Proper indexes and constraints

### 3. Performance Optimization

- Strategic indexing for chat queries
- Partitioning for message tables
- Connection pooling
- Query optimization
- Read replica support

## Database Schema

### Core Tables

#### Users (Extended from how-do-you-know)

```sql
CREATE TABLE users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    username character varying NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,

    -- Chat-specific fields
    display_name character varying,
    avatar_url character varying,
    current_status character varying DEFAULT 'offline' NOT NULL,
    last_seen_at timestamptz,
    chat_preferences jsonb DEFAULT '{}' NOT NULL,

    -- Profile fields
    account_type_informal user_account_type_informal_enum NOT NULL DEFAULT 'guest',
    current_account_status user_account_status_enum NOT NULL DEFAULT 'pending-verification',
    is_email_verified boolean NOT NULL DEFAULT false,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email)
);
```

#### Chat Rooms

```sql
CREATE TYPE room_type_enum AS ENUM ('group', 'direct', 'support', 'escalated');
CREATE TYPE room_status_enum AS ENUM ('active', 'archived', 'closed');

CREATE TABLE chat_rooms (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying,
    description text,
    room_type room_type_enum NOT NULL DEFAULT 'group',
    status room_status_enum NOT NULL DEFAULT 'active',

    -- Issue tracking
    issue_id character varying,
    issue_description text,

    -- Access control
    is_private boolean NOT NULL DEFAULT false,
    guest_access_allowed boolean NOT NULL DEFAULT true,
    max_participants integer DEFAULT 50,

    -- Metadata
    creator_id uuid NOT NULL,
    parent_room_id uuid, -- For escalations
    escalation_level integer DEFAULT 1,

    -- Settings
    room_settings jsonb DEFAULT '{}' NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_chat_rooms PRIMARY KEY (id),
    CONSTRAINT fk_chat_rooms_creator FOREIGN KEY (creator_id) REFERENCES users(id),
    CONSTRAINT fk_chat_rooms_parent FOREIGN KEY (parent_room_id) REFERENCES chat_rooms(id)
);
```

#### Room Participants

```sql
CREATE TYPE participant_role_enum AS ENUM ('member', 'moderator', 'observer', 'guest');
CREATE TYPE participant_status_enum AS ENUM ('active', 'muted', 'removed', 'left');

CREATE TABLE room_participants (
    room_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role participant_role_enum NOT NULL DEFAULT 'member',
    status participant_status_enum NOT NULL DEFAULT 'active',

    -- Permissions
    can_send_messages boolean NOT NULL DEFAULT true,
    can_invite_others boolean NOT NULL DEFAULT false,
    can_see_history boolean NOT NULL DEFAULT true,

    -- Tracking
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz,
    left_at timestamptz,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_room_participants PRIMARY KEY (room_id, user_id),
    CONSTRAINT fk_room_participants_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    CONSTRAINT fk_room_participants_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Messages

```sql
CREATE TYPE message_type_enum AS ENUM ('chat', 'robot', 'system', 'file', 'image', 'graph');
CREATE TYPE delivery_status_enum AS ENUM ('streaming', 'batch-delay', 'delivered', 'failed');

CREATE TABLE messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    room_id uuid NOT NULL,
    sender_id uuid NOT NULL,

    -- Content
    message_type message_type_enum NOT NULL DEFAULT 'chat',
    content text NOT NULL,
    content_metadata jsonb DEFAULT '{}' NOT NULL,

    -- Robot interaction
    robot_id character varying,
    robot_response_to uuid, -- References another message
    is_robot_visible_to_guests boolean DEFAULT false,

    -- Delivery
    delivery_status delivery_status_enum NOT NULL DEFAULT 'streaming',

    -- Threading
    reply_to_message_id uuid,
    thread_id uuid,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_messages PRIMARY KEY (id),
    CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id),
    CONSTRAINT fk_messages_reply_to FOREIGN KEY (reply_to_message_id) REFERENCES messages(id)
);
```

#### File Attachments (Adapted from how-do-you-know)

```sql
CREATE TABLE chat_file_attachments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,

    -- File info (reference to file manager)
    file_manager_file_id uuid NOT NULL,
    original_filename character varying NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying NOT NULL,

    -- Chat-specific metadata
    thumbnail_url character varying,
    preview_available boolean DEFAULT false,

    -- Access control
    owner_id uuid NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_chat_file_attachments PRIMARY KEY (id),
    CONSTRAINT fk_chat_file_attachments_message FOREIGN KEY (message_id) REFERENCES messages(id),
    CONSTRAINT fk_chat_file_attachments_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

#### Robot Interactions

```sql
CREATE TYPE robot_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE robot_interactions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    robot_id character varying NOT NULL,

    -- Request
    request_data jsonb NOT NULL,
    observation_data jsonb,

    -- Response
    response_data jsonb,
    status robot_status_enum NOT NULL DEFAULT 'pending',
    error_message text,

    -- Timing
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT pk_robot_interactions PRIMARY KEY (id),
    CONSTRAINT fk_robot_interactions_message FOREIGN KEY (message_id) REFERENCES messages(id)
);
```

#### Escalations

```sql
CREATE TYPE escalation_status_enum AS ENUM ('created', 'assigned', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE support_level_enum AS ENUM ('T1', 'T2', 'T3', 'manager');

CREATE TABLE escalations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    source_room_id uuid NOT NULL,
    target_room_id uuid, -- May create new room

    -- Escalation details
    escalation_reason text NOT NULL,
    from_level support_level_enum NOT NULL,
    to_level support_level_enum NOT NULL,
    priority integer DEFAULT 3, -- 1=high, 5=low

    -- Tracking
    created_by_user_id uuid NOT NULL,
    assigned_to_user_id uuid,
    status escalation_status_enum NOT NULL DEFAULT 'created',

    -- Resolution
    resolution_notes text,
    resolved_at timestamptz,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT pk_escalations PRIMARY KEY (id),
    CONSTRAINT fk_escalations_source_room FOREIGN KEY (source_room_id) REFERENCES chat_rooms(id),
    CONSTRAINT fk_escalations_target_room FOREIGN KEY (target_room_id) REFERENCES chat_rooms(id),
    CONSTRAINT fk_escalations_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_escalations_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
);
```

### Permission System (Reuse from how-do-you-know)

```sql
-- Use existing permission tables with chat-specific domains
INSERT INTO access_permission_domains (permission_prefix, description) VALUES
    ('chat:room', 'Chat room management permissions'),
    ('chat:message', 'Message sending and viewing permissions'),
    ('chat:robot', 'Robot interaction permissions'),
    ('chat:file', 'File upload and sharing permissions'),
    ('chat:escalation', 'Escalation management permissions'),
    ('supervisor:chat', 'Supervisor monitoring permissions');
```

## Indexing Strategy

### Performance-Critical Indexes

```sql
-- Message queries (most frequent)
CREATE INDEX idx_messages_room_created_at ON messages(room_id, created_at DESC);
CREATE INDEX idx_messages_sender_created_at ON messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_type_room ON messages(message_type, room_id) WHERE deleted_at IS NULL;

-- Room participant lookups
CREATE INDEX idx_room_participants_user_active ON room_participants(user_id) WHERE status = 'active';
CREATE INDEX idx_room_participants_room_active ON room_participants(room_id) WHERE status = 'active';

-- User status and activity
CREATE INDEX idx_users_status_last_seen ON users(current_status, last_seen_at);

-- Robot interactions
CREATE INDEX idx_robot_interactions_status ON robot_interactions(status, created_at);
CREATE INDEX idx_robot_interactions_robot_id ON robot_interactions(robot_id, created_at DESC);

-- File attachments
CREATE INDEX idx_chat_file_attachments_message ON chat_file_attachments(message_id);
CREATE INDEX idx_chat_file_attachments_owner ON chat_file_attachments(owner_id, created_at DESC);
```

### Audit Tables (Following how-do-you-know pattern)

```sql
-- Create audit tables for all core entities
CREATE TABLE messages_history (
    history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    -- Copy all fields from messages table
    id uuid NOT NULL,
    room_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message_type message_type_enum NOT NULL,
    content text NOT NULL,
    -- ... all other fields
    CONSTRAINT pk_messages_history PRIMARY KEY (history_id)
);

-- Audit triggers
CREATE OR REPLACE FUNCTION log_messages_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO messages_history (
        operation_type, id, room_id, sender_id, message_type, content,
        content_metadata, robot_id, delivery_status, created_at, updated_at, deleted_at
    ) VALUES (
        TG_OP, OLD.id, OLD.room_id, OLD.sender_id, OLD.message_type, OLD.content,
        OLD.content_metadata, OLD.robot_id, OLD.delivery_status, OLD.created_at, OLD.updated_at, OLD.deleted_at
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_messages_changes_trigger
    AFTER UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION log_messages_changes();
```

## Implementation Strategy

### Phase 1: Core Schema (Week 1)

1. Set up PostgreSQL with UUID extension
2. Create user and permission tables (adapt from how-do-you-know)
3. Create chat rooms and participants tables
4. Add core indexes and constraints
5. Set up audit table framework

### Phase 2: Messaging & Files (Week 1-2)

1. Create messages table with proper partitioning
2. Add file attachments table
3. Create robot interactions table
4. Add performance indexes
5. Set up message retention policies

### Phase 3: Advanced Features (Week 2)

1. Create escalations table
2. Add conversation conclusion tracking
3. Implement audit triggers
4. Create database functions for common operations
5. Add data migration scripts

### Phase 4: Optimization (Week 2-3)

1. Performance testing and index optimization
2. Set up read replicas
3. Implement connection pooling
4. Add monitoring queries
5. Create backup and recovery procedures

## Performance Considerations

### Message Storage

- Partition messages table by date (monthly partitions)
- Use partial indexes for active messages
- Implement message archival strategy
- Consider separate table for message search indexes

### Connection Pooling

```typescript
// Database configuration
{
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  extra: {
    max: 50, // Max connections
    min: 5,  // Min connections
    acquire: 30000, // Max time to get connection
    idle: 10000     // Max idle time
  }
}
```

### Query Optimization

- Use proper joins instead of N+1 queries
- Implement pagination for message history
- Cache frequently accessed room data
- Use materialized views for complex aggregations

## Data Retention & Archival

### Message Retention

- Active messages: 2 years online
- Archived messages: 7 years cold storage
- Audit logs: 10 years compliance storage
- User data: Follows privacy regulations

### Backup Strategy

- Daily incremental backups
- Weekly full backups
- Cross-region backup replication
- Point-in-time recovery capability

## Security Considerations

### Data Protection

- Encryption at rest for sensitive data
- Row-level security for multi-tenant isolation
- Audit logging for all data access
- Regular security assessments

### Access Control

- Database user permissions aligned with application roles
- Connection encryption (SSL/TLS)
- IP allowlisting for database access
- Regular credential rotation

## Success Criteria

- [ ] All core tables created with proper constraints
- [ ] Permission system fully functional
- [ ] Message queries perform < 100ms for 10k messages
- [ ] Room participant lookups < 50ms
- [ ] Audit trails capturing all changes
- [ ] Database can handle 1000+ concurrent connections
- [ ] Backup and recovery procedures tested
- [ ] > 95% query performance targets met

## Monitoring & Maintenance

### Database Metrics

- Connection pool utilization
- Query performance statistics
- Index usage and effectiveness
- Storage growth rates
- Backup success rates

### Maintenance Tasks

- Regular VACUUM and ANALYZE
- Index maintenance and optimization
- Partition management for messages
- Audit log cleanup
- Performance monitoring and alerting
