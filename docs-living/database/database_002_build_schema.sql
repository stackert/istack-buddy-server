-- PostgreSQL database schema for WDYK platform
-- Includes all tables, constraints, and initial seed data

-- Verify database is in UTC timezone
DO $$
BEGIN
    IF current_setting('timezone') != 'UTC' THEN
        RAISE EXCEPTION 'Database timezone must be UTC. Current timezone is %', current_setting('timezone');
    END IF;
END
$$;

-- Enable UUID extension for ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Base trigger function for updating timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment version_id on update
CREATE OR REPLACE FUNCTION increment_version_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version_id = OLD.version_id + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Common ENUM types
CREATE TYPE examination_actual_type_enum AS ENUM (
    'lesson-plan',           -- For lesson plan examinations
    'study-guide',           -- For study guide examinations
    'notebook',              -- For learning journal/"Trapper Keeper" examinations
    'study-group',           -- For study group collaborative examinations
    'practice-examination',  -- For practice examinations
    'secure-examination',     -- For secure/formal examinations
    'independent-study',     -- Question can only be used in independent study
    'extra-curricular',      -- Question can only be used in extra curricular
    'homework'             -- Question can only be used in homework
);

-- User Profile ENUMs
CREATE TYPE user_profile_visibility_enum AS ENUM (
    'private',              -- Only the user can see their profile
    'connections-only',     -- Only connected users can see the profile
    'institution-only',     -- Only users in the same institution can see the profile
    'public'               -- Anyone can see the profile
);

CREATE TYPE user_account_status_enum AS ENUM (
    'pending-verification',  -- New account pending email verification
    'active',               -- Account is active and in good standing
    'suspended',            -- Account has been temporarily suspended
    'banned',               -- Account has been permanently banned
    'inactive'              -- Account has been deactivated by the user
);

CREATE TYPE user_account_type_informal_enum AS ENUM (
    'student',              -- Regular student account
    'instructor',           -- Teaching staff
    'administrator',        -- System administrator
    'observer',             -- Parent/Guardian/Auditor
    'guest'                 -- Guest/Limited access account
);

CREATE TYPE access_permission_conditions_enum AS ENUM (
    'ALLOWED_TO_OBSERVE_COURSES_OF_CONDITIONS',
    'ALLOWED_TO_OBSERVE_STUDENTS_OF_CONDITIONS',
    'NO_CONDITIONS_APPLY_ALLOW',
    'NO_CONDITIONS_APPLY_DENY'
);

CREATE TYPE examination_exclusivity_type_enum AS ENUM (
    'lesson-plan',           -- Question can only be used in lesson plans
    'study-guide',           -- Question can only be used in study guides
    'notebook',              -- Question can only be used in notebooks
    'study-group',           -- Question can only be used in study groups
    'practice-examination',  -- Question can only be used in practice exams
    'secure-examination',    -- Question can only be used in secure exams
    'independent-study',     -- Question can only be used in independent study
    'extra-curricular',      -- Question can only be used in extra curricular
    'homework',             -- Question can only be used in homework
    'any'                    -- Question can be used in any examination type
);

CREATE TYPE examination_status_enum AS ENUM ('scheduled', 'in-progress', 'completed', 'expired');
CREATE TYPE instructional_courses_days_of_week_enum AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
CREATE TYPE question_status_enum AS ENUM ('unanswered', 'answered', 'flagged', 'skipped');
CREATE TYPE question_prompt_type_enum AS ENUM ('text', 'multimedia');
CREATE TYPE question_response_type_enum AS ENUM (
    'free-text-255',     -- Free text response limited to 255 characters
    'multiple-choice-4',  -- Multiple choice with 4 options
    'true-false',         -- Boolean true/false response
    'all-that-apply'      -- All that apply response
);

-- Question Media Types
CREATE TYPE question_media_type_enum AS ENUM (
    'application/*',  -- For application files (e.g., executables, binaries)
    'audio/*',        -- For audio files (e.g., mp3, wav)
    'document/*',     -- For document files (e.g., pdf, doc)
    'image/*',        -- For image files (e.g., jpg, png)
    'url/*',          -- For external links/URLs
    'other/*',        -- For uncategorized or special types
    'video/*'         -- For video files (e.g., mp4, webm)
);

-- Access Control ENUMs
CREATE TYPE allow_deny_enum AS ENUM ('allow', 'deny');
CREATE TYPE user_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending-verification',
    'pending-approval'
);

-- Function to validate permission conditions
CREATE OR REPLACE FUNCTION validate_permission_conditions()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set default if no explicit value provided
    IF NEW.required_conditions IS NULL THEN
        NEW.required_conditions := CASE
            -- Observer patterns (strict conditions)
            WHEN NEW.permission_id LIKE 'observer:course%' THEN
                'ALLOWED_TO_OBSERVE_COURSES_OF_CONDITIONS'::access_permission_conditions_enum
            WHEN NEW.permission_id LIKE 'observer:student%' THEN
                'ALLOWED_TO_OBSERVE_STUDENTS_OF_CONDITIONS'::access_permission_conditions_enum
            WHEN NEW.permission_id LIKE 'observer:institution:all:view%' THEN
                'NO_CONDITIONS_APPLY_DENY'::access_permission_conditions_enum
            WHEN NEW.permission_id LIKE 'observer%' THEN
                'NO_CONDITIONS_APPLY_DENY'::access_permission_conditions_enum
            
            -- Patterns that default to ALLOW
            WHEN NEW.permission_id LIKE 'institution:%' THEN
                'NO_CONDITIONS_APPLY_ALLOW'::access_permission_conditions_enum
            WHEN NEW.permission_id LIKE 'instructor:%' THEN
                'NO_CONDITIONS_APPLY_ALLOW'::access_permission_conditions_enum
            WHEN NEW.permission_id LIKE 'student:%' THEN
                'NO_CONDITIONS_APPLY_ALLOW'::access_permission_conditions_enum
                
            -- Everything else defaults to DENY
            ELSE
                'NO_CONDITIONS_APPLY_DENY'::access_permission_conditions_enum
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate permission conditions format
CREATE OR REPLACE FUNCTION validate_permission_assignment_conditions()
RETURNS TRIGGER AS $$
DECLARE
    required_cond access_permission_conditions_enum;
BEGIN
    -- Get the required_conditions from access_permissions
    SELECT required_conditions INTO required_cond
    FROM access_permissions
    WHERE permission_id = NEW.permission_id;

    -- Validate conditions based on required_conditions
    CASE required_cond
        WHEN 'ALLOWED_TO_OBSERVE_COURSES_OF_CONDITIONS' THEN
            IF NOT (jsonb_typeof(NEW.conditions) = 'object' AND
                   (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.conditions) AS t(key)) = ARRAY['allowedToObserveCourseIds'] AND
                   jsonb_typeof(NEW.conditions->'allowedToObserveCourseIds') = 'array') THEN
                RAISE EXCEPTION 'Invalid conditions format for ALLOWED_TO_OBSERVE_COURSES_OF_CONDITIONS';
            END IF;
        WHEN 'ALLOWED_TO_OBSERVE_STUDENTS_OF_CONDITIONS' THEN
            IF NOT (jsonb_typeof(NEW.conditions) = 'object' AND
                   (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.conditions) AS t(key)) = ARRAY['allowedToObserveStudentIds'] AND
                   jsonb_typeof(NEW.conditions->'allowedToObserveStudentIds') = 'array') THEN
                RAISE EXCEPTION 'Invalid conditions format for ALLOWED_TO_OBSERVE_STUDENTS_OF_CONDITIONS';
            END IF;
        WHEN 'NO_CONDITIONS_APPLY_ALLOW' THEN
            IF NEW.conditions != '{"requiredConditions": false, "alwaysEvaluateAs": true}'::jsonb THEN
                RAISE EXCEPTION 'Invalid conditions format for NO_CONDITIONS_APPLY_ALLOW';
            END IF;
        WHEN 'NO_CONDITIONS_APPLY_DENY' THEN
            IF NEW.conditions != '{"requiredConditions": false, "alwaysEvaluateAs": false}'::jsonb THEN
                RAISE EXCEPTION 'Invalid conditions format for NO_CONDITIONS_APPLY_DENY';
            END IF;
        ELSE
            -- Default to deny
            IF NEW.conditions != '{"requiredConditions": false, "alwaysEvaluateAs": false}'::jsonb THEN
                RAISE EXCEPTION 'Invalid conditions format for default case';
            END IF;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if permission_id starts with valid domain prefix
CREATE OR REPLACE FUNCTION check_permission_domain_prefix(permission_id text)
RETURNS boolean AS $$
DECLARE
    domain_prefix text;
    result boolean;
BEGIN
    -- Extract the domain prefix (up to three parts)
    domain_prefix := split_part(permission_id, ':', 1) || ':' || split_part(permission_id, ':', 2) || ':' || split_part(permission_id, ':', 3);
    
    -- If the third part is empty, try two parts
    IF domain_prefix LIKE '%:' THEN
        domain_prefix := split_part(permission_id, ':', 1) || ':' || split_part(permission_id, ':', 2);
    END IF;
    
    -- Check if this prefix exists in our access_permission_domains table
    SELECT EXISTS (
        SELECT 1 FROM access_permission_domains
        WHERE permission_prefix = domain_prefix
    ) INTO result;

    -- Log the check
    RAISE NOTICE 'Permission check: ID=%, Prefix=%, Result=%', permission_id, domain_prefix, result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Users (must be first as it's referenced by many tables)
CREATE TABLE users (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,

    -- Trivial fields
    username character varying NOT NULL,    -- user chosen.  must be unique, we should be requiring character validation 
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    ui_stash jsonb NOT NULL DEFAULT '{}',
    user_defined_tags text DEFAULT ''::text NOT NULL,  -- this would be, maybe, used by teacher to 'group' students.  Its real purpose isn't fully understood.

    -- Profile fields
    ui_handle character varying,     -- how the user wishes to be seen
    display_name character varying,  -- how the system will display user (likely same as username)
    avatar_url character varying,
    bio_about_me text,
    location_text character varying, -- "Austin TX."  - "Remote Location" 
    website_social_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    publicly_visible_fields character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    profile_visibility user_profile_visibility_enum NOT NULL DEFAULT 'private',
    current_account_status user_account_status_enum NOT NULL DEFAULT 'pending-verification',
    is_email_verified boolean NOT NULL DEFAULT false,
    email_verified_at timestamptz,
    last_login_at timestamptz,
    account_type_informal user_account_type_informal_enum NOT NULL DEFAULT 'student',

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,  -- Added for soft delete support

    -- Primary Key
    CONSTRAINT pk_users PRIMARY KEY (id),

    -- Unique Constraints
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- Access Permission Groups
CREATE TABLE access_permission_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying(1024),
    icon character varying(50),          -- Example trivial attribute
    color_code character varying(7),     -- Example trivial attribute
    created_at timestamptz NOT NULL DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    -- Primary Key
    CONSTRAINT pk_access_permission_groups PRIMARY KEY (id),
    -- Unique Constraints
    CONSTRAINT uq_access_permission_groups_name UNIQUE (name)
);

-- Access Permission Group Memberships
CREATE TABLE access_permission_group_memberships (
    user_id uuid NOT NULL,
    permission_group_id uuid NOT NULL,
    status user_status_enum DEFAULT 'active'::user_status_enum NOT NULL,
    joined_date timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    -- Primary Key (composite)
    CONSTRAINT pk_access_permission_group_memberships PRIMARY KEY (user_id, permission_group_id),
    -- Foreign Keys
    CONSTRAINT fk_access_permission_group_memberships_user FOREIGN KEY (user_id) 
        REFERENCES users(id),
    CONSTRAINT fk_access_permission_group_memberships_group FOREIGN KEY (permission_group_id) 
        REFERENCES access_permission_groups(id)
);

-- Permission Domains (moved before access_permissions)
CREATE TABLE access_permission_domains (
    permission_prefix character varying(255) NOT NULL,
    description character varying(1024) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    -- Primary Key
    CONSTRAINT pk_access_permission_domains PRIMARY KEY (permission_prefix),
    
    -- Ensure prefix only contains allowed characters
    CONSTRAINT ck_access_permission_domains_prefix_pattern CHECK (
        permission_prefix ~ '^[a-z0-9_:-]+$'
    )
);

-- -- Seed initial permission domains
-- INSERT INTO access_permission_domains (permission_prefix, description) VALUES
--     ('deny', 'Special deny permissions'),
--     ('file-manager', 'File management operations'),
--     ('institution:user:admin', 'Institution user administration permissions'),
--     ('instructor:course', 'Course management permissions'),
--     ('instructor:exams', 'Examination management permissions'),
--     ('instructor:lesson', 'Lesson plan management permissions'),
--     ('instructor:practice', 'Practice examination management permissions'),
--     ('observer:course', 'Course monitoring (read-only)'),
--     ('observer:institution', 'Institution monitoring (read-only)'),
--     ('observer:student', 'Student monitoring (read-only)'),
--     ('student:course', 'Student course participation permissions'),
--     ('student:exams', 'Student examination permissions'),
--     ('student:notebook', 'Student notebook permissions'),
--     ('student:practice', 'Student practice permissions'),
--     ('student:study', 'Student study group permissions'),
--     ('user:profile:public:view', 'Public profile viewing permissions'),
--     ('user:profile:me', 'User''s own profile management permissions'),
--     ('ws-sys', 'WebSocket system operations');

-- Access Permissions
CREATE TABLE access_permissions (
    /*
        Convention for permissions:
        - permission_id: follows pattern "domain:resource:action" where:
            - domain: MUST be one of the permission prefixes from access_permission_domains table
            - resource: the entity being acted upon (e.g., courses, exams, users)
            - action: the operation being performed (e.g., create, read, update, delete)
        
        Examples:
            - instructor:courses:create
            - student:exams:take
            - observer:student:view-progress
            - ws-sys:notifications:broadcast
            - institution:user:admin:create
            - observer:institution:all:view-metrics
        
        Observer Pattern:
        Permissions starting with 'observer:' are automatically read-only.
        These are used for monitoring (parents, auditors, etc.)
        The application should enforce this read-only nature.
        
        - description: human-readable explanation of what the permission allows
        
        - required_conditions: Enum that defines what conditions MUST be present
          when this permission is assigned. This is automatically set based on
          the permission_id prefix.
    */
    permission_id character varying(255) NOT NULL,
    permission_prefix character varying(255) NOT NULL,
    description character varying(1024) NOT NULL,
    required_conditions access_permission_conditions_enum NOT NULL DEFAULT 'NO_CONDITIONS_APPLY_DENY',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    -- Primary Key
    CONSTRAINT pk_access_permissions PRIMARY KEY (permission_id),
    
    -- Foreign Key to access_permission_domains
    CONSTRAINT fk_access_permissions_domain 
        FOREIGN KEY (permission_prefix) 
        REFERENCES access_permission_domains(permission_prefix),
    
    -- Enforce permission_id pattern
    CONSTRAINT ck_access_permissions_id_pattern 
        CHECK (permission_id ~ '^[a-z0-9_:-]+:[a-z0-9_:-]+$')
);

-- Create trigger to enforce permission conditions
CREATE TRIGGER enforce_permission_conditions
    BEFORE INSERT OR UPDATE ON access_permissions
    FOR EACH ROW
    EXECUTE FUNCTION validate_permission_conditions();

-- Access Permission Group Assignments
CREATE TABLE access_permission_assignments_group (
    permission_group_id uuid NOT NULL,
    permission_id character varying(255) NOT NULL,
    allow_deny allow_deny_enum NOT NULL,
    conditions jsonb DEFAULT '{"requiredConditions": false, "alwaysEvaluateAs": true}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    -- Primary Key (composite)
    CONSTRAINT pk_access_permission_assignments_group PRIMARY KEY (permission_group_id, permission_id),
    -- Foreign Keys
    CONSTRAINT fk_access_permission_assignments_group_group FOREIGN KEY (permission_group_id) 
        REFERENCES access_permission_groups(id),
    CONSTRAINT fk_access_permission_assignments_group_permission FOREIGN KEY (permission_id) 
        REFERENCES access_permissions(permission_id)
);

-- Add trigger for group assignments
CREATE TRIGGER validate_group_permission_conditions
    BEFORE INSERT OR UPDATE ON access_permission_assignments_group
    FOR EACH ROW
    EXECUTE FUNCTION validate_permission_assignment_conditions();

-- Access User Permissions (formerly user_grants)
CREATE TABLE access_permission_assignments_user (
    user_id uuid NOT NULL,
    permission_id character varying(255) NOT NULL,
    allow_deny allow_deny_enum NOT NULL,
    conditions jsonb DEFAULT '{"requiredConditions": false, "alwaysEvaluateAs": true}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    -- Primary Key (composite)
    CONSTRAINT pk_access_permission_assignments_user PRIMARY KEY (user_id, permission_id),
    -- Foreign Keys
    CONSTRAINT fk_access_permission_assignments_user_user FOREIGN KEY (user_id) 
        REFERENCES users(id),
    CONSTRAINT fk_access_permission_assignments_user_permission FOREIGN KEY (permission_id) 
        REFERENCES access_permissions(permission_id)
);

-- Add trigger for user assignments
CREATE TRIGGER validate_user_permission_conditions
    BEFORE INSERT OR UPDATE ON access_permission_assignments_user
    FOR EACH ROW
    EXECUTE FUNCTION validate_permission_assignment_conditions();

-- Create indexes for access control tables
CREATE INDEX idx_access_permission_group_memberships_user_id ON access_permission_group_memberships(user_id);
CREATE INDEX idx_access_permission_group_memberships_group_id ON access_permission_group_memberships(permission_group_id);
CREATE INDEX idx_access_permission_assignments_group_group_id ON access_permission_assignments_group(permission_group_id);
CREATE INDEX idx_access_permission_assignments_group_permission_id ON access_permission_assignments_group(permission_id);
CREATE INDEX idx_access_permission_assignments_user_user_id ON access_permission_assignments_user(user_id);
CREATE INDEX idx_access_permission_assignments_user_permission_id ON access_permission_assignments_user(permission_id);

-- User Authentication Sessions Table
-- This table manages active user authentication sessions
-- Uses restrictive write pattern: ONLY updates last_access_time, ONLY inserts on new sessions, ONLY deletes on timeout
CREATE TABLE user_authentication_sessions (
    -- Primary identification
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session data
    jwt_token character varying NOT NULL,

    -- Permission caching (for performance)
    group_permission_chain jsonb NOT NULL DEFAULT '[]',
    user_permission_chain jsonb NOT NULL DEFAULT '[]',
    group_memberships jsonb NOT NULL DEFAULT '[]',

    -- Session timing
    initial_access_time timestamptz NOT NULL DEFAULT now(),
    last_access_time timestamptz NOT NULL DEFAULT now(),

    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    PRIMARY KEY (id),
    UNIQUE (user_id, jwt_token)
);

-- Indexes for performance
CREATE INDEX idx_user_auth_sessions_user_id ON user_authentication_sessions(user_id);
CREATE INDEX idx_user_auth_sessions_last_access ON user_authentication_sessions(last_access_time);
CREATE INDEX idx_user_auth_sessions_jwt_token ON user_authentication_sessions(jwt_token);

-- Trigger for updating timestamps
CREATE TRIGGER set_timestamp_user_authentication_sessions
    BEFORE UPDATE ON user_authentication_sessions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Access Control Audit Tables
-- Audit trail tracking is primarily an application responsibility.
-- These tables are for dev/debug purposes and to assist in troubleshooting.
-- NOTE: DEV/DEBUG: Consider removing these audit tables before production.
-- The application should implement its own audit trail system with appropriate
-- security and retention policies.

-- Access Permission Groups History
CREATE TABLE access_permission_groups_history (
    history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    
    -- Original fields from access_permission_groups
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying(1024),
    icon character varying(50),
    color_code character varying(7),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_access_permission_groups_history PRIMARY KEY (history_id)
);

-- Access Permission Group Memberships History
CREATE TABLE access_permission_group_memberships_history (
    history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    
    -- Original fields from access_permission_group_memberships
    user_id uuid NOT NULL,
    permission_group_id uuid NOT NULL,
    status user_status_enum NOT NULL,
    joined_date timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_access_permission_group_memberships_history PRIMARY KEY (history_id)
);

-- Access Permissions History
CREATE TABLE access_permissions_history (
    history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    
    -- Original fields from access_permissions
    permission_id character varying(255) NOT NULL,
    description character varying(1024) NOT NULL,
    required_conditions access_permission_conditions_enum NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_access_permissions_history PRIMARY KEY (history_id)
);

-- Access Permission Group Assignments History
CREATE TABLE access_permission_assignments_group_history (
    history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    
    -- Original fields from access_permission_assignments_group
    permission_group_id uuid NOT NULL,
    permission_id character varying(255) NOT NULL,
    allow_deny allow_deny_enum NOT NULL,
    conditions jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_access_permission_assignments_group_history PRIMARY KEY (history_id)
);

-- Access User Permissions History
CREATE TABLE access_permission_assignments_user_history (
    history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    operation_type text NOT NULL,
    
    -- Original fields from access_permission_assignments_user
    user_id uuid NOT NULL,
    permission_id character varying(255) NOT NULL,
    allow_deny allow_deny_enum NOT NULL,
    conditions jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_access_permission_assignments_user_history PRIMARY KEY (history_id)
);

-- Triggers for access control audit tables
CREATE OR REPLACE FUNCTION log_access_permission_groups_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        INSERT INTO access_permission_groups_history
        (history_id, changed_at, operation_type, id, name, description, icon, color_code, created_at, updated_at, deleted_at)
        VALUES (
            uuid_generate_v4(),
            now(),
            TG_OP,
            OLD.id,
            OLD.name,
            OLD.description,
            OLD.icon,
            OLD.color_code,
            OLD.created_at,
            OLD.updated_at,
            OLD.deleted_at
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_access_permission_group_memberships_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        INSERT INTO access_permission_group_memberships_history
        (history_id, changed_at, operation_type, user_id, permission_group_id, status, joined_date, created_at, updated_at, deleted_at)
        VALUES (
            uuid_generate_v4(),
            now(),
            TG_OP,
            OLD.user_id,
            OLD.permission_group_id,
            OLD.status,
            OLD.joined_date,
            OLD.created_at,
            OLD.updated_at,
            OLD.deleted_at
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_access_permissions_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        INSERT INTO access_permissions_history
        (history_id, changed_at, operation_type, permission_id, description, required_conditions, created_at, updated_at, deleted_at)
        VALUES (
            uuid_generate_v4(),
            now(),
            TG_OP,
            OLD.permission_id,
            OLD.description,
            OLD.required_conditions,
            OLD.created_at,
            OLD.updated_at,
            OLD.deleted_at
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_access_permission_assignments_group_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        INSERT INTO access_permission_assignments_group_history
        (history_id, changed_at, operation_type, permission_group_id, permission_id, allow_deny, conditions, created_at, updated_at, deleted_at)
        VALUES (
            uuid_generate_v4(),
            now(),
            TG_OP,
            OLD.permission_group_id,
            OLD.permission_id,
            OLD.allow_deny,
            OLD.conditions,
            OLD.created_at,
            OLD.updated_at,
            OLD.deleted_at
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_access_permission_assignments_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        INSERT INTO access_permission_assignments_user_history
        (history_id, changed_at, operation_type, user_id, permission_id, allow_deny, conditions, created_at, updated_at, deleted_at)
        VALUES (
            uuid_generate_v4(),
            now(),
            TG_OP,
            OLD.user_id,
            OLD.permission_id,
            OLD.allow_deny,
            OLD.conditions,
            OLD.created_at,
            OLD.updated_at,
            OLD.deleted_at
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to access control tables
CREATE TRIGGER log_access_permission_groups_changes_trigger
AFTER UPDATE OR DELETE ON access_permission_groups
FOR EACH ROW EXECUTE FUNCTION log_access_permission_groups_changes();

CREATE TRIGGER log_access_permission_group_memberships_changes_trigger
AFTER UPDATE OR DELETE ON access_permission_group_memberships
FOR EACH ROW EXECUTE FUNCTION log_access_permission_group_memberships_changes();

CREATE TRIGGER log_access_permissions_changes_trigger
AFTER UPDATE OR DELETE ON access_permissions
FOR EACH ROW EXECUTE FUNCTION log_access_permissions_changes();

CREATE TRIGGER log_access_permission_assignments_group_changes_trigger
AFTER UPDATE OR DELETE ON access_permission_assignments_group
FOR EACH ROW EXECUTE FUNCTION log_access_permission_assignments_group_changes();

CREATE TRIGGER log_access_permission_assignments_user_changes_trigger
AFTER UPDATE OR DELETE ON access_permission_assignments_user
FOR EACH ROW EXECUTE FUNCTION log_access_permission_assignments_user_changes();

-- Fodder pools (collections of related items)
CREATE TABLE fodder_pools (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),
    deleted_at timestamptz,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT pk_fodder_pools PRIMARY KEY (id)
);

-- Triggers for timestamp updates
CREATE TRIGGER set_timestamp_fodder_pools
    BEFORE UPDATE ON fodder_pools
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Individual fodder items belonging to pools
CREATE TABLE fodder_pool_items (
    pool_id uuid NOT NULL,
    index integer NOT NULL,     -- database makes no guarantees about sequence.
    --   Its the application's responsibility assure (1, 2, 3) or whatever it needs 
    
    contentJson text NOT NULL,  -- application is expected to JSON.stringify
    metadata jsonb,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
 
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT pk_fodder_pool_items PRIMARY KEY (pool_id, index),
    CONSTRAINT fk_fodder_pool_items_pool FOREIGN KEY (pool_id) 
        REFERENCES fodder_pools(id) 
        ON DELETE CASCADE
);

-- Triggers for timestamp updates
CREATE TRIGGER set_timestamp_fodder_pool_items
    BEFORE UPDATE ON fodder_pool_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Index for efficient lookup of items by pool
CREATE INDEX idx_fodder_pool_items_pool ON fodder_pool_items(pool_id);

-- Learning Institutions
CREATE TABLE learning_institutions (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_by_id uuid NOT NULL, -- Renamed for clarity

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,
    website character varying NOT NULL,
    email character varying NOT NULL,
    phone character varying NOT NULL,
    address text,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_learning_institutions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_learning_institutions_created_by 
        FOREIGN KEY (created_by_id) 
        REFERENCES users(id)
);

-- Course Archetypes (must be before Course Actuals)
CREATE TABLE course_archetypes (
    -- NOTE: this is analogous to a "University Course Catalog"
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    institution_id uuid NOT NULL,
    created_by uuid NOT NULL,
    course_catalog_id character varying NOT NULL,

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,
    duration_minutes integer NOT NULL,
    user_defined_tags text DEFAULT ''::text NOT NULL,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_course_archetypes PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_course_archetypes_institution 
        FOREIGN KEY (institution_id) 
        REFERENCES learning_institutions(id),
    CONSTRAINT fk_course_archetypes_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id),

    -- Add version_id
    version_id integer NOT NULL DEFAULT 1,

    -- Add unique constraint for course_catalog_id
    CONSTRAINT uq_course_archetypes_catalog_id UNIQUE (course_catalog_id)
);

-- Add semester_session_type_enum
CREATE TYPE semester_session_type_enum AS ENUM (
    'FALL',
    'SPRING',
    'WINTER',
    'SUMMER',
    'INDEPENDENT-STUDY'
);

-- This table tracks academic semesters and their date ranges
-- It serves as the temporal foundation for all actual course resources
CREATE TABLE actuals_semesters (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,

    -- Core fields
    semester_code character varying NOT NULL, -- Format: YYYY-[SESSION] (e.g., '2024-FALL')
    session_type semester_session_type_enum NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,

    -- Optional description/name
    display_name character varying NOT NULL, -- e.g., "Fall Semester 2024"
    description text,

    -- Standard timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_semesters PRIMARY KEY (id),
    CONSTRAINT uq_actuals_semesters_code UNIQUE (semester_code),
    CONSTRAINT check_semester_dates CHECK (start_date < end_date),
    CONSTRAINT check_semester_code_format CHECK (
        semester_code ~ '^[0-9]{4}-(FALL|SPRING|WINTER|SUMMER|INDEPENDENT-STUDY)$'
    )
);

COMMENT ON TABLE actuals_semesters IS 'Defines academic semesters and their date ranges';
COMMENT ON COLUMN actuals_semesters.semester_code IS 'Unique identifier for semester in YYYY-SESSION format';
COMMENT ON COLUMN actuals_semesters.session_type IS 'Type of academic session (FALL, SPRING, etc)';

CREATE TABLE actuals_courses (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    semester_id uuid NOT NULL,
    course_archetype_id uuid NOT NULL,
    institution_id uuid NOT NULL,
    instructor_id uuid NOT NULL,

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,
    duration_minutes integer NOT NULL,
    instructor_defined_tags text NOT NULL DEFAULT ''::text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_courses PRIMARY KEY (id),
    CONSTRAINT fk_actuals_courses_semester
        FOREIGN KEY (semester_id)
        REFERENCES actuals_semesters(id),
    CONSTRAINT fk_actuals_courses_archetype
        FOREIGN KEY (course_archetype_id)
        REFERENCES course_archetypes(id),
    CONSTRAINT fk_actuals_courses_institution
        FOREIGN KEY (institution_id)
        REFERENCES learning_institutions(id),
    CONSTRAINT fk_actuals_courses_instructor
        FOREIGN KEY (instructor_id)
        REFERENCES users(id)
);

COMMENT ON TABLE actuals_courses IS 'Actual course instances for specific semesters';

-- Course Enrollment
CREATE TABLE actuals_courses_enrollment (
    -- Core fields
    student_id uuid NOT NULL,
    semester_id uuid NOT NULL,
    course_id uuid NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_courses_enrollment PRIMARY KEY (student_id, semester_id, course_id),
    CONSTRAINT fk_actuals_courses_enrollment_student
        FOREIGN KEY (student_id)
        REFERENCES users(id),
    CONSTRAINT fk_actuals_courses_enrollment_semester
        FOREIGN KEY (semester_id)
        REFERENCES actuals_semesters(id),
    CONSTRAINT fk_actuals_courses_enrollment_course
        FOREIGN KEY (course_id)
        REFERENCES actuals_courses(id)
);

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_courses_enrollment
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Add indexes for common lookups
CREATE INDEX idx_actuals_courses_enrollment_semester 
    ON actuals_courses_enrollment(semester_id);

-- Web Socket Clients
CREATE TABLE web_socket_clients (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,

    -- Trivial fields
    client_id character varying NOT NULL,      -- Unique client identifier
    connection_status text NOT NULL,           -- Current connection state
    last_heartbeat timestamptz,   -- Last client heartbeat
    connection_metadata jsonb,                 -- Additional connection info (IP, user agent, etc)
    device_info jsonb,                        -- Device specific information
    session_data jsonb,                       -- Session-specific data
    user_defined_tags text DEFAULT ''::text NOT NULL,

    -- Timestamps
    connected_at timestamptz NOT NULL,  -- When the connection was established
    disconnected_at timestamptz,        -- When the connection was closed (null if active)
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_web_socket_clients PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_web_socket_clients_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    -- Unique Constraints
    CONSTRAINT uq_web_socket_clients_client_id UNIQUE (client_id)
);

-- Examination Archetypes
CREATE TABLE examination_archetypes (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    created_by uuid NOT NULL,

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,
    user_defined_tags text DEFAULT ''::text NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
    
    -- Version fields
    availability_start_date timestamptz NOT NULL,
    availability_end_date timestamptz NOT NULL,
    change_notes text,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_examination_archetypes PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_examination_archetypes_course 
        FOREIGN KEY (course_id) 
        REFERENCES course_archetypes(id),
    CONSTRAINT fk_examination_archetypes_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id)
);

-- Examination Archetype Sections
CREATE TABLE examination_archetype_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    archetype_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    time_limit_seconds integer NOT NULL,
    position integer NOT NULL,
    difficulty_distribution jsonb,
    topic_distribution jsonb,
    user_defined_tags text DEFAULT ''::text NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_examination_archetype_sections PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_examination_archetype_sections_archetype
        FOREIGN KEY (archetype_id) 
        REFERENCES examination_archetypes(id)
);

-- Examination Archetype Section Questions
CREATE TABLE examination_archetype_section_questions (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    section_id uuid NOT NULL,

    -- Question fields
    prompt_text text NOT NULL,
    instruction_text text,
    prompt_type question_prompt_type_enum NOT NULL,
    response_type question_response_type_enum NOT NULL,
    valid_answer jsonb NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    difficulty text NOT NULL,
    topics text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
    user_prompt_json_string text NOT NULL DEFAULT ''::text,
    user_response_json_string text NOT NULL DEFAULT ''::text,

    -- Trivial fields
    position integer DEFAULT 0 NOT NULL,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_examination_archetype_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_examination_archetype_section_questions_examination_section 
        FOREIGN KEY (section_id) 
        REFERENCES examination_archetype_sections(id)
);

-- Question Archetype Media
CREATE TABLE question_archetype_media (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    question_id uuid NOT NULL,
    media_type question_media_type_enum NOT NULL,
    media_url text NOT NULL,
    display_order integer NOT NULL,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_question_archetype_media PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_question_archetype_media_question 
        FOREIGN KEY (question_id) 
        REFERENCES examination_archetype_section_questions(id)
);

-- Question Actuals
CREATE TABLE question_actuals (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    archetype_question_id uuid NOT NULL,
    actual_course_id uuid NOT NULL,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_question_actuals PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_question_actuals_archetype 
        FOREIGN KEY (archetype_question_id) 
        REFERENCES examination_archetype_section_questions(id),
    CONSTRAINT fk_question_actuals_course
        FOREIGN KEY (actual_course_id)
        REFERENCES actuals_courses(id)
);

-- Question Actual Media
CREATE TABLE question_actual_media (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    question_actual_id uuid NOT NULL,
    media_type question_media_type_enum NOT NULL,
    media_url text NOT NULL,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_question_actual_media PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_question_actual_media_question 
        FOREIGN KEY (question_actual_id) 
        REFERENCES question_actuals(id)
);


-- Actuals Examination (must be after all archetype tables)
CREATE TABLE actuals_examination (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    examination_archetype_id uuid NOT NULL,

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,
    instructor_defined_tags text NOT NULL DEFAULT ''::text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_course
        FOREIGN KEY (course_id)
        REFERENCES actuals_courses(id),
    CONSTRAINT fk_actuals_examination_archetype
        FOREIGN KEY (examination_archetype_id)
        REFERENCES examination_archetypes(id)
);

-- Base sections table
CREATE TABLE actuals_examination_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    actual_examination_id uuid NOT NULL,
    section_archetype_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    relative_position integer NOT NULL,
    difficulty_distribution jsonb NOT NULL,
    topic_distribution jsonb NOT NULL,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_sections_exam
        FOREIGN KEY (actual_examination_id)
        REFERENCES actuals_examination(id),
    CONSTRAINT fk_actuals_examination_sections_archetype
        FOREIGN KEY (section_archetype_id)
        REFERENCES examination_archetype_sections(id)
);

-- Base questions table
CREATE TABLE actuals_examination_section_questions (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    actual_section_id uuid NOT NULL,
    archetype_question_id uuid NOT NULL,

    -- Trivial fields
    prompt_text text NOT NULL,
    instruction_text text,
    prompt_type question_prompt_type_enum NOT NULL,
    response_type question_response_type_enum NOT NULL,
    valid_answer jsonb NOT NULL,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    instructor_defined_tags text NOT NULL DEFAULT ''::text,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,
    difficulty text NOT NULL,
    topics text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
    user_prompt_json_string text NOT NULL DEFAULT ''::text,
    user_response_json_string text NOT NULL DEFAULT ''::text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Constraints
    CONSTRAINT pk_actuals_examination_section_questions PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_section_questions_section
        FOREIGN KEY (actual_section_id)
        REFERENCES actuals_examination_sections(id),
    CONSTRAINT fk_actuals_examination_section_questions_archetype
        FOREIGN KEY (archetype_question_id)
        REFERENCES examination_archetype_section_questions(id)
);

-- Function to check question exclusivity
CREATE OR REPLACE FUNCTION check_question_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exclusivity_type != TG_ARGV[0]::examination_exclusivity_type_enum THEN
        RAISE EXCEPTION 'Question must have exclusivity type %', TG_ARGV[0];
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now all the extension tables can follow...
CREATE TABLE actuals_examination_secure_exam (
    -- Because of the "secure" nature, this breaks the base/extension table pattern
    -- ID fields
    id uuid NOT NULL,
    examination_archetype_id uuid NOT NULL,
    course_id uuid NOT NULL,
    student_id uuid NOT NULL,
    proctor_by uuid NOT NULL,

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,
    exam_specific_notes text,

    -- Scheduling fields
    visible_start_at timestamptz NOT NULL,
    visible_end_at timestamptz NOT NULL,
    due_by_at timestamptz NOT NULL,
    time_allowance_minutes integer NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Primary Key and Foreign Keys
    CONSTRAINT pk_actuals_examination_secure_exam PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_secure_exam_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id),
    CONSTRAINT fk_actuals_examination_secure_exam_archetype
        FOREIGN KEY (examination_archetype_id)
        REFERENCES examination_archetypes(id),
    CONSTRAINT fk_actuals_examination_secure_exam_course
        FOREIGN KEY (course_id)
        REFERENCES actuals_courses(id),
    CONSTRAINT fk_actuals_examination_secure_exam_student
        FOREIGN KEY (student_id)
        REFERENCES users(id),
    CONSTRAINT fk_actuals_examination_secure_exam_proctor
        FOREIGN KEY (proctor_by)
        REFERENCES users(id),
    CONSTRAINT ck_actuals_examination_secure_exam_dates
        CHECK (
            visible_start_at <= visible_end_at AND
            visible_start_at <= due_by_at AND
            due_by_at <= visible_end_at
        )
);

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_secure_exam
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Secure Examination Sections
CREATE TABLE actuals_examination_secure_exam_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    secure_exam_id uuid NOT NULL,
    section_archetype_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    relative_position integer NOT NULL,
    difficulty_distribution jsonb NOT NULL,
    topic_distribution jsonb NOT NULL,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_secure_exam_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_secure_exam_sections_exam
        FOREIGN KEY (secure_exam_id)
        REFERENCES actuals_examination_secure_exam(id),
    CONSTRAINT fk_actuals_examination_secure_exam_sections_archetype
        FOREIGN KEY (section_archetype_id)
        REFERENCES examination_archetype_sections(id)
);

CREATE TABLE actuals_examination_secure_exam_section_questions (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    section_id uuid NOT NULL,
    archetype_question_id uuid NOT NULL,

    -- Question fields (cloned from base table)
    prompt_text text NOT NULL,
    instruction_text text,
    prompt_type question_prompt_type_enum NOT NULL,
    response_type question_response_type_enum NOT NULL,
    valid_answer jsonb NOT NULL,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    instructor_defined_tags text NOT NULL DEFAULT ''::text,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,
    difficulty text NOT NULL,
    topics text,
    user_prompt_json_string text NOT NULL DEFAULT ''::text,
    user_response_json_string text NOT NULL DEFAULT ''::text,

    -- Feature specific fields
    feature_debug_json_string text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Constraints
    CONSTRAINT pk_actuals_examination_secure_exam_section_questions PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_secure_exam_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_secure_exam_sections(id),
    CONSTRAINT fk_actuals_examination_secure_exam_section_questions_archetype
        FOREIGN KEY (archetype_question_id)
        REFERENCES examination_archetype_section_questions(id)
);

-- Add trigger for secure examination question exclusivity
CREATE TRIGGER check_secure_exam_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_secure_exam_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('secure-examination');

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_secure_exam_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Lesson Plan Extension
CREATE TABLE actuals_examination_lesson_plan (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    lesson_plan_debug_feature_json_string text,
    lesson_plan_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_lesson_plan PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_lesson_plan_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Lesson Plan Sections
CREATE TABLE actuals_examination_lesson_plan_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lesson_plan_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    relative_position integer NOT NULL,
    difficulty_distribution jsonb,
    topic_distribution jsonb,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_lesson_plan_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_lesson_plan_sections_exam
        FOREIGN KEY (lesson_plan_id)
        REFERENCES actuals_examination_lesson_plan(id)
);

CREATE TABLE actuals_examination_lesson_plan_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,
    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_lesson_plan_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_lesson_plan_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_lesson_plan_sections(id),
    CONSTRAINT fk_actuals_examination_lesson_plan_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),
    CONSTRAINT ck_actuals_examination_lesson_plan_section_questions_exclusivity
        CHECK (exclusivity_type = 'lesson-plan'::examination_exclusivity_type_enum)
);

-- Add trigger for lesson plan question exclusivity
-- CREATE TRIGGER check_lesson_plan_question_exclusivity
--     BEFORE INSERT OR UPDATE ON actuals_examination_lesson_plan_section_questions
--     FOR EACH ROW
--     EXECUTE FUNCTION check_question_exclusivity('lesson-plan');

-- Add timestamp triggers for lesson plan tables
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_lesson_plan
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_lesson_plan_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_lesson_plan_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Practice Exam Extension
CREATE TABLE actuals_examination_practice_exam (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    practice_exam_debug_feature_json_string text,
    practice_exam_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_practice_exam PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_practice_exam_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Practice Exam Sections
CREATE TABLE actuals_examination_practice_exam_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    practice_exam_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    relative_position integer NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_practice_exam_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_practice_exam_sections_exam
        FOREIGN KEY (practice_exam_id)
        REFERENCES actuals_examination_practice_exam(id)
);

CREATE TABLE actuals_examination_practice_exam_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_practice_exam_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_practice_exam_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_practice_exam_sections(id),
    CONSTRAINT fk_actuals_examination_practice_exam_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),

    CONSTRAINT ck_actuals_examination_practice_examination_section_questions_exclusivity
        CHECK (exclusivity_type = 'practice-examination'::examination_exclusivity_type_enum)
);

-- Notebook Extension
CREATE TABLE actuals_examination_notebook (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    notebook_debug_feature_json_string text,
    notebook_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_notebook PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_notebook_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Notebook Sections
CREATE TABLE actuals_examination_notebook_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    notebook_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    notes text NOT NULL,
    relative_position integer NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_notebook_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_notebook_sections_exam
        FOREIGN KEY (notebook_id)
        REFERENCES actuals_examination_notebook(id)
);

CREATE TABLE actuals_examination_notebook_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_notebook_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_notebook_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_notebook_sections(id),
    CONSTRAINT fk_actuals_examination_notebook_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),

    CONSTRAINT ck_actuals_examination_notebook_section_questions_exclusivity
        CHECK (exclusivity_type = 'notebook'::examination_exclusivity_type_enum)

);

-- Study Group Extension
CREATE TABLE actuals_examination_study_group (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    title character varying NOT NULL,
    name text NOT NULL,

    -- Feature specific fields
    study_group_debug_feature_json_string text,
    study_group_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_study_group PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_study_group_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Study Group Sections
CREATE TABLE actuals_examination_study_group_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    study_group_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    notes text NOT NULL,
    relative_position integer NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_study_group_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_study_group_sections_exam
        FOREIGN KEY (study_group_id)
        REFERENCES actuals_examination_study_group(id)
);

CREATE TABLE actuals_examination_study_group_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_study_group_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_study_group_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_study_group_sections(id),
    CONSTRAINT fk_actuals_examination_study_group_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),
    CONSTRAINT ck_actuals_examination_study_group_section_questions_exclusivity
        CHECK (exclusivity_type = 'study-group'::examination_exclusivity_type_enum)
);

-- Course Study Groups
CREATE TABLE actuals_course_study_groups (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    instructor_id uuid NOT NULL,

    -- Trivial fields
    name character varying NOT NULL,
    description text NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_course_study_groups PRIMARY KEY (id),
    CONSTRAINT fk_actuals_course_study_groups_course
        FOREIGN KEY (course_id)
        REFERENCES actuals_courses(id),
    CONSTRAINT fk_actuals_course_study_groups_instructor
        FOREIGN KEY (instructor_id)
        REFERENCES users(id)
);

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_course_study_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Course Study Group Students
CREATE TABLE actuals_course_study_group_students (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id uuid NOT NULL,
    student_id uuid NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_course_study_group_students PRIMARY KEY (id),
    CONSTRAINT fk_actuals_course_study_group_students_group
        FOREIGN KEY (group_id)
        REFERENCES actuals_course_study_groups(id),
    CONSTRAINT fk_actuals_course_study_group_students_student
        FOREIGN KEY (student_id)
        REFERENCES users(id)
);

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_course_study_group_students
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Independent Study Extension
CREATE TABLE actuals_examination_independent_study (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    independent_study_debug_feature_json_string text,
    independent_study_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_independent_study PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_independent_study_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Independent Study Sections
CREATE TABLE actuals_examination_independent_study_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    independent_study_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    notes text NOT NULL,
    relative_position integer NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_independent_study_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_independent_study_sections_exam
        FOREIGN KEY (independent_study_id)
        REFERENCES actuals_examination_independent_study(id)
);

CREATE TABLE actuals_examination_independent_study_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_independent_study_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_independent_study_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_independent_study_sections(id),
    CONSTRAINT fk_actuals_examination_independent_study_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),
    CONSTRAINT ck_actuals_examination_independent_study_section_questions_exclusivity
        CHECK (exclusivity_type = 'independent-study'::examination_exclusivity_type_enum)
);

-- Extra Curricular Extension
CREATE TABLE actuals_examination_extra_curricular (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    extra_curricular_debug_feature_json_string text,
    extra_curricular_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_extra_curricular PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_extra_curricular_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Extra Curricular Sections
CREATE TABLE actuals_examination_extra_curricular_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    extra_curricular_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    notes text NOT NULL,
    relative_position integer NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_extra_curricular_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_extra_curricular_sections_exam
        FOREIGN KEY (extra_curricular_id)
        REFERENCES actuals_examination_extra_curricular(id)
);

CREATE TABLE actuals_examination_extra_curricular_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_extra_curricular_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_extra_curricular_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_extra_curricular_sections(id),
    CONSTRAINT fk_actuals_examination_extra_curricular_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),
    CONSTRAINT ck_actuals_examination_extra_curricular_section_questions_exclusivity
        CHECK (exclusivity_type = 'extra-curricular'::examination_exclusivity_type_enum)

);

-- Add triggers for question exclusivity
CREATE TRIGGER check_practice_exam_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_practice_exam_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('practice-examination');

CREATE TRIGGER check_notebook_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_notebook_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('notebook');

CREATE TRIGGER check_study_group_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_study_group_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('study-group');

CREATE TRIGGER check_independent_study_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_independent_study_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('independent-study');

CREATE TRIGGER check_extra_curricular_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_extra_curricular_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('extra-curricular');

-- Add timestamp triggers for all tables
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_practice_exam
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_practice_exam_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_practice_exam_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_notebook
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_notebook_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_notebook_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_study_group
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_study_group_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_study_group_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_independent_study
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_independent_study_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_independent_study_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_extra_curricular
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_extra_curricular_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_extra_curricular_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Homework Extension
CREATE TABLE actuals_examination_homework (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    homework_debug_feature_json_string text,
    homework_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Scheduling fields
    visible_start_at timestamptz NOT NULL,
    visible_end_at timestamptz NOT NULL,
    due_by_at timestamptz NOT NULL,

    -- Grade fields (determined at the application level)
    credit_value decimal NOT NULL DEFAULT 0,
    numeric_grade decimal,

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_homework PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_homework_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id),
    CONSTRAINT ck_actuals_examination_homework_dates
        CHECK (
            visible_start_at <= visible_end_at AND
            visible_start_at <= due_by_at AND
            due_by_at <= visible_end_at
        )
);

-- Homework Sections
CREATE TABLE actuals_examination_homework_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    homework_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    relative_position integer NOT NULL,
    difficulty_distribution jsonb,
    topic_distribution jsonb,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_homework_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_homework_sections_exam
        FOREIGN KEY (homework_id)
        REFERENCES actuals_examination_homework(id)
);

CREATE TABLE actuals_examination_homework_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
    instructions text NOT NULL,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_homework_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_homework_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_homework_sections(id),
    CONSTRAINT fk_actuals_examination_homework_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),
    CONSTRAINT ck_actuals_examination_homework_section_questions_exclusivity
        CHECK (exclusivity_type = 'homework'::examination_exclusivity_type_enum)        
);

-- Add trigger for homework question exclusivity
CREATE TRIGGER check_homework_question_exclusivity
    BEFORE INSERT OR UPDATE ON actuals_examination_homework_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION check_question_exclusivity('homework');

-- Add timestamp triggers for homework tables
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_homework
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_homework_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_homework_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Study Guide Extension
CREATE TABLE actuals_examination_study_guide (
    -- ID fields (PK and FK to base examination)
    id uuid NOT NULL,

    -- Feature specific fields
    study_guide_debug_feature_json_string text,
    study_guide_notes text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Primary Key and Foreign Key to base table
    CONSTRAINT pk_actuals_examination_study_guide PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_study_guide_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination(id)
);

-- Study Guide Sections
CREATE TABLE actuals_examination_study_guide_sections (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    study_guide_id uuid NOT NULL,

    -- Trivial fields
    title character varying NOT NULL,
    instructions text NOT NULL,
    relative_position integer NOT NULL,
    difficulty_distribution jsonb,
    topic_distribution jsonb,
    user_defined_tags text NOT NULL DEFAULT ''::text,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT pk_actuals_examination_study_guide_sections PRIMARY KEY (id),
    CONSTRAINT fk_actuals_examination_study_guide_sections_exam
        FOREIGN KEY (study_guide_id)
        REFERENCES actuals_examination_study_guide(id)
);

CREATE TABLE actuals_examination_study_guide_section_questions (
    -- ID fields (PK and FK to base question)
    id uuid NOT NULL,
    section_id uuid NOT NULL,
    exclusivity_type examination_exclusivity_type_enum NOT NULL,

    -- Feature specific fields
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_actuals_examination_study_guide_section_questions PRIMARY KEY (id),

    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_study_guide_section_questions_section
        FOREIGN KEY (section_id)
        REFERENCES actuals_examination_study_guide_sections(id),
    CONSTRAINT fk_actuals_examination_study_guide_section_questions_base
        FOREIGN KEY (id)
        REFERENCES actuals_examination_section_questions(id),
    CONSTRAINT ck_actuals_examination_study_guide_section_questions_exclusivity
        CHECK (exclusivity_type = 'study-guide'::examination_exclusivity_type_enum)
);

-- Add trigger for study guide question exclusivity
-- CREATE TRIGGER check_study_guide_question_exclusivity
--     BEFORE INSERT OR UPDATE ON actuals_examination_study_guide_section_questions
--     FOR EACH ROW
--     EXECUTE FUNCTION check_question_exclusivity('study-guide');

-- Add timestamp triggers for study guide tables
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_study_guide
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_study_guide_sections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_study_guide_section_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- File Manager ENUMs
CREATE TYPE file_status_enum AS ENUM (
    'RECEIVED_UPLOAD_PENDING_ACCEPTANCE',
    'ACCEPTANCE_VIRUS_SCAN_SKIPPED_FOR_SHORT_TERM_TEMP_STORAGE',
    'ACCEPTANCE_VIRUS_SCAN_PENDING',
    'ACCEPTANCE_VIRUS_SCAN_COMPLETED',
    'ACCEPTANCE_VIRUS_SCAN_FAILED',
    'ACCEPTANCE_COMPLETED_ACCEPTED',
    'ACCEPTANCE_COMPLETED_REJECTED',
    'ACCEPTED'
);

CREATE TYPE file_transport_protocol_enum AS ENUM (
    'http',
    'https',
    'ftp',
    'sftp',
    'smb',
    'nfs'
);

CREATE TYPE file_storage_class_enum AS ENUM (
    'TEMPORARY_LESS_THAN_24_HOURS',    -- For very short-term storage like profile upload previews
    'SHORT_TERM_30_DAYS',              -- For temporary content like chat attachments
    'MEDIUM_TERM_90_DAYS',             -- For reports and temporary but longer-lived content
    'LONG_TERM_1_YEAR',                -- For important but not permanent content
    'INDEFINITE'                       -- For permanent storage
);

-- Credential Manager ENUMs
CREATE TYPE credential_type_enum AS ENUM (
    'SYSTEM',
    'API_KEY',
    'USERNAME_PASSWORD',
    'OAUTH',
    'SAML'
);

-- Storage Class ENUM
CREATE TYPE storage_class_enum AS ENUM (
    'TEMPORARY_LESS_THAN_24_HOURS',
    'SHORT_TERM_30_DAYS',
    'MEDIUM_TERM_90_DAYS',
    'LONG_TERM_1_YEAR',
    'INDEFINITE'
);

-- Credential schema versions table
CREATE TABLE credential_schemas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    credential_type credential_type_enum NOT NULL,
    schema_version varchar(10) NOT NULL,
    json_schema jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT pk_credential_schemas PRIMARY KEY (id),
    CONSTRAINT uq_credential_schemas_type_version UNIQUE (credential_type, schema_version)
);

-- Credentials table
CREATE TABLE credential_manager_credentials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    credential_type credential_type_enum NOT NULL,
    schema_version varchar(10) NOT NULL,
    encrypted_credentials text NOT NULL,
    description text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,

    CONSTRAINT pk_credential_manager_credentials PRIMARY KEY (id),
    CONSTRAINT fk_credentials_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT fk_credentials_schema 
        FOREIGN KEY (credential_type, schema_version) 
        REFERENCES credential_schemas(credential_type, schema_version)
);

-- Add timestamps trigger for credential tables
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON credential_schemas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON credential_manager_credentials
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create indexes for credentials table
CREATE INDEX idx_credentials_owner ON credential_manager_credentials(owner_id);
CREATE INDEX idx_credentials_type ON credential_manager_credentials(credential_type);
CREATE INDEX idx_credentials_active ON credential_manager_credentials(is_active) WHERE is_active = true;

/*
    File Manager Tables
    
    These tables handle file storage and management across the system.
    Files are owned by exactly one user but can be referenced in various contexts.
    Storage classes define retention and access patterns independent of content type.
*/

-- Storage class definitions
CREATE TABLE file_manager_storage_classes (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    
    -- Core fields
    name storage_class_enum NOT NULL,
    description text NOT NULL,
    
    -- Storage characteristics
    max_size_bytes bigint NOT NULL,
    min_size_bytes bigint NOT NULL DEFAULT 0,
    retention_days integer,  -- NULL for indefinite
    
    -- Storage location patterns
    root_storage_path text NOT NULL,    -- e.g., 'static.site.com/temp', 'file:///permanent'
    path_template text NOT NULL,        -- e.g., '{year}/{month}/{day}/{uuid}'
    
    -- Performance/Access patterns
    allows_batch_upload boolean DEFAULT false NOT NULL,
    requires_review boolean DEFAULT false NOT NULL,
    is_public_readable boolean DEFAULT false NOT NULL,
    cache_ttl_seconds integer,          -- NULL for no caching
    
    -- Status
    is_active boolean DEFAULT true NOT NULL,
    
    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    
    -- Primary Key
    CONSTRAINT pk_file_manager_storage_classes PRIMARY KEY (id),
    
    -- Unique constraint
    CONSTRAINT uq_storage_classes_name UNIQUE (name),
    
    -- Check constraints
    CONSTRAINT ck_storage_classes_size CHECK (max_size_bytes > min_size_bytes),
    CONSTRAINT ck_storage_classes_retention CHECK (
        (name = 'INDEFINITE' AND retention_days IS NULL) OR
        (name != 'INDEFINITE' AND retention_days IS NOT NULL)
    ),
    CONSTRAINT ck_storage_classes_cache_ttl CHECK (
        cache_ttl_seconds IS NULL OR cache_ttl_seconds > 0
    )
);

-- Files table
CREATE TABLE file_manager_files (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    storage_class_id uuid NOT NULL,
    
    -- URLs and locations
    authoritative_url text NOT NULL,
    fully_qualified_url text NOT NULL,
    
    -- File metadata
    size_in_bytes bigint NOT NULL,
    mime_type character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_extension character varying(50) NOT NULL,
    
    -- File verification
    file_hash character varying(255) NOT NULL,
    file_hash_type character varying(50) NOT NULL,
    file_hash_algorithm character varying(50) NOT NULL,
    
    -- Transport details
    transport_protocol file_transport_protocol_enum NOT NULL,
    transport_credentials uuid REFERENCES credential_manager_credentials(id),
    
    -- Status fields
    status file_status_enum NOT NULL DEFAULT 'RECEIVED_UPLOAD_PENDING_ACCEPTANCE',
    is_soft_deleted boolean DEFAULT false NOT NULL,
    
    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    
    -- Primary Key
    CONSTRAINT pk_file_manager_files PRIMARY KEY (id),
    
    -- Foreign Keys
    CONSTRAINT fk_files_owner 
        FOREIGN KEY (owner_id) 
        REFERENCES users(id),
    CONSTRAINT fk_files_storage_class 
        FOREIGN KEY (storage_class_id) 
        REFERENCES file_manager_storage_classes(id)
);

-- Indexes
CREATE INDEX idx_files_owner ON file_manager_files(owner_id);
CREATE INDEX idx_files_status ON file_manager_files(status);
CREATE INDEX idx_files_storage_class ON file_manager_files(storage_class_id);
CREATE INDEX idx_files_not_deleted ON file_manager_files(is_soft_deleted) WHERE is_soft_deleted = false;

-- Add triggers for updated_at
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON file_manager_storage_classes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON file_manager_files
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Seed storage classes
INSERT INTO file_manager_storage_classes 
(name, description, max_size_bytes, min_size_bytes, retention_days, root_storage_path, path_template, allows_batch_upload, requires_review, is_public_readable, cache_ttl_seconds)
VALUES
(
    'TEMPORARY_LESS_THAN_24_HOURS',
    'Very short-term storage for temporary uploads and previews',
    5242880, -- 5MB
    0,
    1,
    'static.site.com/temp',
    '{year}/{month}/{day}/{uuid}',
    false,
    false,
    false,
    300  -- 5 minutes cache
),
(
    'SHORT_TERM_30_DAYS',
    'Short-term storage for chat attachments and temporary content',
    10485760, -- 10MB
    0,
    30,
    'static.site.com/short-term',
    '{year}/{month}/{uuid}',
    true,
    false,
    false,
    3600  -- 1 hour cache
),
(
    'MEDIUM_TERM_90_DAYS',
    'Medium-term storage for reports and semi-temporary content',
    104857600, -- 100MB
    0,
    90,
    'static.site.com/medium-term',
    '{year}/{quarter}/{uuid}',
    false,
    false,
    false,
    7200  -- 2 hours cache
),
(
    'LONG_TERM_1_YEAR',
    'Long-term storage for important but not permanent content',
    52428800, -- 50MB
    0,
    365,
    'static.site.com/long-term',
    '{year}/{uuid}',
    false,
    true,
    false,
    86400  -- 24 hours cache
),
(
    'INDEFINITE',
    'Permanent storage for critical content',
    26214400, -- 25MB
    0,
    NULL,
    'static.site.com/permanent',
    '{year}/{uuid}',
    false,
    true,
    false,
    NULL  -- No caching for permanent content
);

-- Answer History Tables

-- Regular Answer History (for all non-secure exam questions)
CREATE TABLE actuals_examination_answer_history (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    
    -- Response fields
    user_response jsonb NOT NULL,  -- Structure depends on question's response_type
    exclusivity_type examination_actual_type_enum NOT NULL,
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Primary Key
    CONSTRAINT pk_actuals_examination_answer_history PRIMARY KEY (id),
    
    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_answer_history_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id),
    CONSTRAINT fk_actuals_examination_answer_history_question 
        FOREIGN KEY (question_id) 
        REFERENCES actuals_examination_section_questions(id),
        
    -- Constraints
    CONSTRAINT ck_actuals_examination_answer_history_no_secure_exam 
        CHECK (exclusivity_type != 'secure-examination')
);

-- Create index for finding latest response
CREATE INDEX idx_actuals_examination_answer_history_latest 
    ON actuals_examination_answer_history(user_id, question_id, created_at DESC);

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_answer_history
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Secure Exam Answer History
CREATE TABLE actuals_examination_secure_exam_answer_history (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    
    -- Response fields
    user_response jsonb NOT NULL,  -- Structure depends on question's response_type
    feature_debug_json_string text,        -- as we work out details of th feature we can store pseudo-fields
    
    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Primary Key
    CONSTRAINT pk_actuals_examination_secure_exam_answer_history PRIMARY KEY (id),
    
    -- Foreign Keys
    CONSTRAINT fk_actuals_examination_secure_exam_answer_history_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id),
    CONSTRAINT fk_actuals_examination_secure_exam_answer_history_question 
        FOREIGN KEY (question_id) 
        REFERENCES actuals_examination_secure_exam_section_questions(id)
);

-- Create index for finding latest response
CREATE INDEX idx_actuals_examination_secure_exam_answer_history_latest 
    ON actuals_examination_secure_exam_answer_history(user_id, question_id, created_at DESC);

-- Add timestamp trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON actuals_examination_secure_exam_answer_history
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

