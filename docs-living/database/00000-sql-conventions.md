# SQL Database Conventions

This document outlines the conventions used in our PostgreSQL database schema. These conventions ensure consistency, maintainability, and clarity across the entire database.

## Table Naming Conventions

### General Rules

- **Use snake_case** for all table names
- **Use plural nouns** for table names
  - ✅ `users`, `access_permissions`, `examination_archetypes`
  - ❌ `user`, `access_permission`, `examination_archetype`

### Prefixing Patterns

- **Domain prefixes** for related functionality:
  - `access_permission_` - For access control related tables (e.g., `access_permission_groups`)
  - `file_manager_` - For file management tables (e.g., `file_manager_files`)
  - `credential_manager_` - For credential management tables
- **History/Audit tables**: Append `_history` to the base table name
  - Example: `access_permission_groups_history`

## Column Naming Conventions

### General Rules

- **Use snake_case** for all column names
- **Use descriptive names** that clearly indicate the column's purpose

### Primary Keys

- **Standard primary key**: `id` (uuid type with default uuid_generate_v4())
  - Note: While not ideal, this is the established pattern in our codebase
- **Composite primary keys**: Use meaningful field combinations
  - Example: `(user_id, permission_id)` in assignment tables

### Foreign Keys

- **Format**: `{referenced_table_singular}_id`
  - ✅ `user_id`, `course_id`, `institution_id`
  - ❌ `userId`, `course_ref`, `institution`
- **Special cases**: When multiple references to same table, use descriptive prefixes
  - ✅ `created_by_id`, `instructor_id`, `proctor_by` (all referencing users table)

### Timestamp Fields

- **Standard timestamps**: `created_at`, `updated_at`
- **Type**: `timestamptz` (timestamp with timezone)
- **Defaults**:
  - `created_at`: `DEFAULT now() NOT NULL`
  - `updated_at`: `DEFAULT now() NOT NULL`
- **Specific timestamps**: Use descriptive names with `_at` suffix
  - ✅ `last_login_at`, `email_verified_at`, `connected_at`

_tmc_ - we need to mention time stamps are enforced with functions/stored procedures. When defining a new table
the stored procedure it MUST included timestamp enforcement. In times we forego timestamp enforcement - we MUST comment to that effect

### Boolean Fields

- **Prefix patterns**:
  - `is_` for state/status: `is_active`, `is_email_verified`, `is_soft_deleted` (with a preference for `is_`)
  - `is_batch_upload_allowed` for permissions: `allows_batch_upload`
  - `is_review_required` for requirements: `requires_review`
- **Default to false** unless the positive state is the common case

### Text Fields

- **VARCHAR**: Use `character varying` for limited text with explicit length when needed
- **TEXT**: Use `text` for unlimited text content
- **Special text fields**:
  - `_notes` for additional information
  - `_description` for explanatory text
  - `_tags` for categorization

## Data Types and ENUMs

### ENUM Conventions

- **Type naming**: snake_case ending with `_enum`
  - ✅ `user_account_status_enum`, `examination_exclusivity_type_enum`
- **Value naming**: uppercase with underscores for multi-word values
  - ❌ `'lessonPlan'`, `'practice_examination'`, `'pending_verification'`
  - ✅ `'Lesson-plan'`, `'PRACTICE_EXAMINATION'`, `'PENDING_VERIFICATION'`

### UUID Usage

- **Primary keys**: Always use UUID with `DEFAULT public.uuid_generate_v4()`
- **Enable extension**: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

### JSON Fields

- **Use JSONB** for JSON data (better performance than JSON)
- **Naming**: Descriptive names indicating content type
  - ✅ `ui_stash`, `website_social_links`, `connection_metadata`

## Constraint Naming Conventions

### Primary Key Constraints

- **Format**: `pk_{table_name}`
- **Example**: `CONSTRAINT pk_users PRIMARY KEY (id)`

### Foreign Key Constraints

- **Format**: `fk_{table_name}_{reference_description}`
- **Examples**:
  - `fk_users_institution` (users → learning_institutions)
  - `fk_access_permission_assignments_user_user` (detailed when needed)

### Unique Constraints

- **Format**: `uq_{table_name}_{field_name(s)}`
- **Examples**:
  - `uq_users_username`
  - `uq_credential_schemas_type_version`

### Check Constraints

- **Format**: `ck_{table_name}_{description}`
- **Examples**:
  - `ck_storage_classes_size`
  - `ck_actuals_examination_homework_dates`

## Index Naming Conventions

- **Format**: `idx_{table_name}_{field_name(s)}_{optional_description}`
- **Examples**:
  - `idx_files_owner`
  - `idx_files_not_deleted` (with WHERE clause)
  - `idx_actuals_examination_answer_history_latest`

## Function and Trigger Conventions

### Functions

- **Use snake_case** for function names
- **Common patterns**:
  - `trigger_set_timestamp()` - Updates updated_at field
  - `increment_version_id()` - Increments version fields
  - `validate_` prefix for validation functions

### Triggers

- **Format**: `{action}_{table_name}_{description}`
- **Examples**:
  - `set_timestamp` (for updated_at automation)
  - `enforce_permission_conditions`
  - `check_{feature}_question_exclusivity`

## Standard Table Patterns

### Base Entity Pattern

Every major entity table should include:

```sql
-- ID fields
id uuid DEFAULT public.uuid_generate_v4() NOT NULL,

-- Core fields (entity-specific)
-- ...

-- Timestamps
created_at timestamptz DEFAULT now() NOT NULL,
updated_at timestamptz DEFAULT now() NOT NULL,

-- Constraints
CONSTRAINT pk_{table_name} PRIMARY KEY (id)
```

### Audit/History Tables

- Include all fields from the original table
- Add audit-specific fields:
  ```sql
  history_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL,
  operation_type text NOT NULL  -- 'INSERT', 'UPDATE', 'DELETE'
  ```

### Junction/Assignment Tables

For many-to-many relationships:

STOP - WE PURSUE BCNF - THERE SHOULD NEVER BE MANY-TO-MANY.

IF YOU ENCOUNTER MANY-TO-MANY you should STOP and demand explanation.

```sql
-- Composite primary key from related entities
{entity1}_id uuid NOT NULL,
{entity2}_id uuid NOT NULL,

-- Additional assignment data
status enum_type DEFAULT 'active' NOT NULL,
conditions jsonb DEFAULT '{}' NOT NULL,

-- Standard timestamps
created_at timestamptz DEFAULT now() NOT NULL,
updated_at timestamptz DEFAULT now() NOT NULL,
deleted_at timestamptz,

-- Composite primary key
CONSTRAINT pk_{table_name} PRIMARY KEY ({entity1}_id, {entity2}_id)
```

## Database-Level Conventions

### Timezone

- **Always use UTC** at the database level
- Include timezone verification in schema:
  ```sql
  DO $$
  BEGIN
      IF current_setting('timezone') != 'UTC' THEN
          RAISE EXCEPTION 'Database timezone must be UTC. Current timezone is %', current_setting('timezone');
      END IF;
  END
  $$;
  ```

### Extensions

- **Enable required extensions** at the top of schema files:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

### Comments

- **Document tables**: Use `COMMENT ON TABLE` for complex tables
- **Document columns**: Use `COMMENT ON COLUMN` for business logic fields
- **Include purpose and usage examples**

## Trigger Automation

### Automatic Timestamp Updates

All tables with `updated_at` should have:

```sql
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON {table_name}
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
```

## Migration and Schema Evolution

During initial development we will not migrate. We will drop, create, seed.

### File Organization

- Schema files should be numbered: `database_000_setup.sql`, `database_001_initial.sql`
- Migration files: `migration_YYYYMMDD_description.sql`

### Backward Compatibility

- **Never drop columns** without proper migration path
- **Add new ENUMs carefully** - consider impact on existing data, re-use of existing enum

## Performance Considerations

### Indexes

- **Always index foreign keys** for join performance
- As the application matures we'll readdress this.

### Query Patterns

- **Use JSONB** instead of JSON for better performance
- **Consider GIN indexes** for JSONB fields that are frequently queried
- **Use appropriate field sizes** (VARCHAR vs TEXT based on expected content)

- \*\*We'll reconsider query performance improvements toward the end of the project. DO NOT SPEND TOO MUCH TIME ON IT.

## Examples of Good vs Bad

### Good Examples ✅

```sql
-- Table name: plural, snake_case
CREATE TABLE examination_archetype_sections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    archetype_id uuid NOT NULL,  -- Clear foreign key naming
    title character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,  -- Clear boolean naming
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT pk_examination_archetype_sections PRIMARY KEY (id),
    CONSTRAINT fk_examination_archetype_sections_archetype
        FOREIGN KEY (archetype_id) REFERENCES examination_archetypes(id)
);
```

### Bad Examples ❌

```sql
-- DON'T: singular table name, camelCase, poor constraint naming
CREATE TABLE ExaminationArchetypeSection (
    ID varchar(36) NOT NULL,  -- Don't use varchar for UUID
    ArchetypeId varchar(36),  -- CamelCase
    isActive bit,             -- Wrong boolean type
    CreatedDate datetime,     -- Wrong timestamp type

    CONSTRAINT PK1 PRIMARY KEY (ID),  -- Non-descriptive constraint name
    CONSTRAINT FK1 FOREIGN KEY (ArchetypeId) REFERENCES ExaminationArchetype(ID)
);
```

## Questions or Clarifications

When in doubt about naming or structure:

1. Look for similar patterns in existing tables
2. Prioritize clarity and consistency over brevity
3. Document complex business logic with comments
4. Consider future maintainability and query patterns
