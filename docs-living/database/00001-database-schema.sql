-- PostgreSQL database schema for User and Permission Management
-- Includes users, access control, and permission management tables

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

-- User Profile ENUMs
CREATE TYPE user_profile_visibility_enum AS ENUM (
    'PRIVATE',              -- Only the user can see their profile
    'CONNECTIONS_ONLY',     -- Only connected users can see the profile
    'INSTITUTION_ONLY',     -- Only users in the same institution can see the profile
    'PUBLIC'               -- Anyone can see the profile
);

CREATE TYPE user_account_status_enum AS ENUM (
    'PENDING_VERIFICATION',  -- New account pending email verification
    'ACTIVE',               -- Account is active and in good standing
    'SUSPENDED',            -- Account has been temporarily suspended
    'BANNED',               -- Account has been permanently banned
    'INACTIVE'              -- Account has been deactivated by the user
);

CREATE TYPE user_account_type_informal_enum AS ENUM (
    'STUDENT',              -- Regular student account
    'INSTRUCTOR',           -- Teaching staff
    'ADMINISTRATOR',        -- System administrator
    'OBSERVER',             -- Parent/Guardian/Auditor
    'GUEST'                 -- Guest/Limited access account
);

CREATE TYPE access_permission_conditions_enum AS ENUM (
    'ALLOWED_TO_OBSERVE_COURSES_OF_CONDITIONS',
    'ALLOWED_TO_OBSERVE_STUDENTS_OF_CONDITIONS',
    'NO_CONDITIONS_APPLY_ALLOW',
    'NO_CONDITIONS_APPLY_DENY'
);

-- Access Control ENUMs
CREATE TYPE allow_deny_enum AS ENUM ('ALLOW', 'DENY');
CREATE TYPE user_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'PENDING_VERIFICATION',
    'PENDING_APPROVAL'
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



-- Users (must be first as it's referenced by many tables)
-- Minimal core table with only essential fields
CREATE TABLE users (
    -- ID fields
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_users PRIMARY KEY (id)
);

-- Timestamp enforcement trigger for users table
CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- User Logins (extension table for authentication)
CREATE TABLE user_logins (
    -- Primary key is also FK to users
    user_id uuid NOT NULL,
    
    -- Authentication fields
    password_hash character varying NOT NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_user_logins PRIMARY KEY (user_id),
    
    -- Foreign Key
    CONSTRAINT fk_user_logins_user FOREIGN KEY (user_id) 
        REFERENCES users(id)
);

-- Timestamp enforcement trigger for user_logins table
CREATE TRIGGER set_timestamp_user_logins
    BEFORE UPDATE ON user_logins
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- User Profiles (extension table for profile information)
-- Contains all user data except ID and timestamps from core users table
CREATE TABLE user_profiles (
    -- Primary key is also FK to users
    user_id uuid NOT NULL,
    
    -- Core user fields (moved from users table)
    username character varying NOT NULL,    -- user chosen.  must be unique, we should be requiring character validation 
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    email character varying NOT NULL,
    user_defined_tags text DEFAULT ''::text NOT NULL,  -- this would be, maybe, used by teacher to 'group' students.  Its real purpose isn't fully understood.

    -- Account status fields (moved from users table)
    current_account_status user_account_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
    is_email_verified boolean NOT NULL DEFAULT false,
    email_verified_at timestamptz,
    last_login_at timestamptz,
    account_type_informal user_account_type_informal_enum NOT NULL DEFAULT 'STUDENT',
    
    -- Profile display fields
    ui_handle character varying,     -- how the user wishes to be seen
    display_name character varying,  -- how the system will display user (likely same as username)
    avatar_url character varying,
    bio_about_me text,
    location_text character varying, -- "Austin TX."  - "Remote Location" 
    
    -- Profile data and settings
    ui_stash jsonb NOT NULL DEFAULT '{}',
    website_social_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    publicly_visible_fields character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    profile_visibility user_profile_visibility_enum NOT NULL DEFAULT 'PRIVATE',

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_user_profiles PRIMARY KEY (user_id),
    
    -- Foreign Key
    CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) 
        REFERENCES users(id),

    -- Unique Constraints (moved from users table)
    CONSTRAINT uq_user_profiles_username UNIQUE (username),
    CONSTRAINT uq_user_profiles_email UNIQUE (email)
);

-- Timestamp enforcement trigger for user_profiles table
CREATE TRIGGER set_timestamp_user_profiles
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- User Permission Groups
CREATE TABLE user_permission_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying(1024),
    icon character varying(50),          -- Example trivial attribute
    color_code character varying(7),     -- Example trivial attribute
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_user_permission_groups PRIMARY KEY (id),
    -- Unique Constraints
    CONSTRAINT uq_user_permission_groups_name UNIQUE (name)
);

-- Timestamp enforcement trigger for user_permission_groups table
CREATE TRIGGER set_timestamp_user_permission_groups
    BEFORE UPDATE ON user_permission_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- User Permission Group Membership
CREATE TABLE user_permission_group_membership (
    user_id uuid NOT NULL,
    permission_group_id uuid NOT NULL,
    status user_status_enum DEFAULT 'ACTIVE'::user_status_enum NOT NULL,
    joined_date timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key (composite)
    CONSTRAINT pk_user_permission_group_membership PRIMARY KEY (user_id, permission_group_id),
    -- Foreign Keys
    CONSTRAINT fk_user_permission_group_membership_user FOREIGN KEY (user_id) 
        REFERENCES users(id),
    CONSTRAINT fk_user_permission_group_membership_group FOREIGN KEY (permission_group_id) 
        REFERENCES user_permission_groups(id)
);

-- Timestamp enforcement trigger for user_permission_group_membership table
CREATE TRIGGER set_timestamp_user_permission_group_membership
    BEFORE UPDATE ON user_permission_group_membership
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Permission Domains (moved before access_permissions)
CREATE TABLE access_permission_domains (
    permission_prefix character varying(255) NOT NULL,
    description character varying(1024) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key
    CONSTRAINT pk_access_permission_domains PRIMARY KEY (permission_prefix),
    
    -- Ensure prefix only contains allowed characters
    CONSTRAINT ck_access_permission_domains_prefix_pattern CHECK (
        permission_prefix ~ '^[a-z0-9_:-]+$'
    )
);

-- Timestamp enforcement trigger for access_permission_domains table
CREATE TRIGGER set_timestamp_access_permission_domains
    BEFORE UPDATE ON access_permission_domains
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Function to check if permission_id starts with valid domain prefix
-- NOTE: This function is placed here AFTER access_permission_domains table creation
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

-- Timestamp enforcement trigger for access_permissions table
CREATE TRIGGER set_timestamp_access_permissions
    BEFORE UPDATE ON access_permissions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Function to validate permission conditions format
-- NOTE: This function is placed here AFTER access_permissions table creation
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

-- Access Permission Group Assignments
CREATE TABLE access_permission_assignments_group (
    permission_group_id uuid NOT NULL,
    permission_id character varying(255) NOT NULL,
    allow_deny allow_deny_enum NOT NULL,
    conditions jsonb DEFAULT '{"requiredConditions": false, "alwaysEvaluateAs": true}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Primary Key (composite)
    CONSTRAINT pk_access_permission_assignments_group PRIMARY KEY (permission_group_id, permission_id),
    -- Foreign Keys
    CONSTRAINT fk_access_permission_assignments_group_group FOREIGN KEY (permission_group_id) 
        REFERENCES user_permission_groups(id),
    CONSTRAINT fk_access_permission_assignments_group_permission FOREIGN KEY (permission_id) 
        REFERENCES access_permissions(permission_id)
);

-- Add trigger for group assignments
CREATE TRIGGER validate_group_permission_conditions
    BEFORE INSERT OR UPDATE ON access_permission_assignments_group
    FOR EACH ROW
    EXECUTE FUNCTION validate_permission_assignment_conditions();

-- Timestamp enforcement trigger for access_permission_assignments_group table
CREATE TRIGGER set_timestamp_access_permission_assignments_group
    BEFORE UPDATE ON access_permission_assignments_group
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Access User Permissions (formerly user_grants)
CREATE TABLE access_permission_assignments_user (
    user_id uuid NOT NULL,
    permission_id character varying(255) NOT NULL,
    allow_deny allow_deny_enum NOT NULL,
    conditions jsonb DEFAULT '{"requiredConditions": false, "alwaysEvaluateAs": true}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

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

-- Timestamp enforcement trigger for access_permission_assignments_user table
CREATE TRIGGER set_timestamp_access_permission_assignments_user
    BEFORE UPDATE ON access_permission_assignments_user
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create indexes for access control tables
CREATE INDEX idx_user_permission_group_membership_user_id ON user_permission_group_membership(user_id);
CREATE INDEX idx_user_permission_group_membership_group_id ON user_permission_group_membership(permission_group_id);
CREATE INDEX idx_access_permission_assignments_group_group_id ON access_permission_assignments_group(permission_group_id);
CREATE INDEX idx_access_permission_assignments_group_permission_id ON access_permission_assignments_group(permission_id);
CREATE INDEX idx_access_permission_assignments_user_user_id ON access_permission_assignments_user(user_id);
CREATE INDEX idx_access_permission_assignments_user_permission_id ON access_permission_assignments_user(permission_id);

-- Seed initial permission domains
INSERT INTO access_permission_domains (permission_prefix, description) VALUES
    ('deny', 'Special deny permissions'),
    ('file-manager', 'File management operations'),
    ('institution:user:admin', 'Institution user administration permissions'),
    ('instructor:course', 'Course management permissions'),
    ('instructor:exams', 'Examination management permissions'),
    ('instructor:lesson', 'Lesson plan management permissions'),
    ('instructor:practice', 'Practice examination management permissions'),
    ('observer:course', 'Course monitoring (read-only)'),
    ('observer:institution', 'Institution monitoring (read-only)'),
    ('observer:student', 'Student monitoring (read-only)'),
    ('student:course', 'Student course participation permissions'),
    ('student:exams', 'Student examination permissions'),
    ('student:notebook', 'Student notebook permissions'),
    ('student:practice', 'Student practice permissions'),
    ('student:study', 'Student study group permissions'),
    ('user:profile:public:view', 'Public profile viewing permissions'),
    ('user:profile:me', 'User''s own profile management permissions'),
    ('ws-sys', 'WebSocket system operations');

COMMENT ON TABLE users IS 'Core user accounts with basic information and status';
COMMENT ON TABLE user_logins IS 'Authentication credentials for users (extension of users table)';
COMMENT ON TABLE user_profiles IS 'User profile information and display settings (extension of users table)';
COMMENT ON TABLE user_permission_groups IS 'Groups of permissions that can be assigned to users';
COMMENT ON TABLE user_permission_group_membership IS 'Which users belong to which permission groups';
COMMENT ON TABLE access_permission_domains IS 'Valid permission domain prefixes for organizing permissions';
COMMENT ON TABLE access_permissions IS 'Individual permissions that can be granted or denied';
COMMENT ON TABLE access_permission_assignments_group IS 'Permissions assigned to permission groups';
COMMENT ON TABLE access_permission_assignments_user IS 'Permissions assigned directly to individual users';
