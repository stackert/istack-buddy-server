# Database Conventions

## Overview

This document defines the database conventions used throughout the iStack Buddy project. These conventions ensure consistency, maintainability, and clarity across all database objects.

## Table Naming

- **Format**: `snake_case` with pluralized nouns
- **Examples**: `users`, `user_profiles`, `access_permissions`, `user_permission_groups`
- **Domain Prefixes**: Use domain prefixes for related functionality
  - `user_` for user-related tables
  - `access_` for access control tables
  - `actuals_` for actual/live data tables

## Column Naming

- **Format**: `snake_case`
- **ID Fields**: `id` for primary keys, `table_name_id` for foreign keys
- **Timestamps**: `created_at`, `updated_at`
- **Booleans**: Use `is_` prefix (e.g., `is_active`, `is_email_verified`)
- **Status Fields**: Use descriptive names with ENUM types (e.g., `current_account_status`)

## ENUM Naming

- **Format**: `UPPERCASE_WITH_UNDERSCORES`
- **Suffix**: Always end with `_enum`
- **Values**: Use `UPPERCASE_WITH_UNDERSCORES` for enum values
- **Examples**:
  - `user_account_status_enum` with values `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`
  - `access_permission_conditions_enum` with values `NO_CONDITIONS_APPLY_ALLOW`

## Primary Keys

- **Type**: UUID using `uuid_generate_v4()`
- **Default**: `DEFAULT public.uuid_generate_v4()`
- **Constraint Name**: `pk_table_name`
- **Example**: `CONSTRAINT pk_users PRIMARY KEY (id)`

## Foreign Keys

- **Constraint Name**: `fk_table_reference_column`
- **Example**: `CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)`

## Unique Constraints

- **Constraint Name**: `uq_table_column` or `uq_table_columns` for composite
- **Example**: `CONSTRAINT uq_user_profiles_username UNIQUE (username)`

## Indexes

- **Name Format**: `idx_table_column` or `idx_table_columns`
- **Purpose-based**: Include purpose when not obvious
- **Examples**:
  - `idx_user_permission_group_membership_user_id`
  - `idx_files_not_deleted` (with WHERE clause)

## Timestamps

- **Standard Fields**: Every table must have `created_at` and `updated_at`
- **Type**: `timestamptz` (timestamp with timezone)
- **Defaults**:
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz DEFAULT now() NOT NULL`
- **Triggers**: Use `trigger_set_timestamp()` function for `updated_at`

## Trigger Naming

- **Format**: `set_timestamp_table_name`
- **Function**: Use standard `trigger_set_timestamp()` function
- **Example**: `CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users`

## Extension Table Pattern

- **Core Tables**: Minimal fields (id, created_at, updated_at)
- **Extension Tables**: Additional fields with same primary key as foreign key
- **Examples**:
  - `users` (core) → `user_profiles` (extension)
  - `users` (core) → `user_logins` (extension)

## Check Constraints

- **Name Format**: `ck_table_description`
- **Examples**:
  - `ck_access_permission_domains_prefix_pattern`
  - `ck_storage_classes_size`

## JSON/JSONB Fields

- **Default Values**: Provide meaningful defaults
- **Examples**:
  - `ui_stash jsonb NOT NULL DEFAULT '{}'`
  - `website_social_links jsonb DEFAULT '[]'::jsonb NOT NULL`

## Comments

- **Tables**: Add comments for complex or domain-specific tables
- **Columns**: Document business rules and purposes
- **Format**: Use SQL `COMMENT ON` statements

## Normalization

- **Target**: Boyce-Codd Normal Form (BCNF)
- **No Many-to-Many**: Use explicit junction tables with additional fields
- **Extension Tables**: Use for optional or domain-specific data

## Development Workflow

- **Approach**: Drop/Create/Seed during development
- **Scripts**: TypeScript-based for consistency and type safety
- **Transactions**: Wrap seeding operations in transactions
- **Validation**: Include schema validation in scripts

## Permission System Conventions

- **Permission IDs**: `domain:resource:action` format
- **Domain Prefixes**: Must exist in `access_permission_domains`
- **Conditions**: Use JSONB with standardized structures
- **Observer Pattern**: `observer:` prefix for read-only permissions

## File Organization

- **Schema Files**: `00001-database-schema.sql` for core schema
- **Scripts Directory**: TypeScript files in `docs-living/database/scripts/`
- **Configuration**: JSON-based database configuration
- **Seeders**: Separate functions for each entity type

## Error Handling

- **Constraints**: Use descriptive constraint names for better error messages
- **Triggers**: Include validation in trigger functions
- **Types**: Use ENUMs for constrained values

## Performance Considerations

- **Indexes**: Create indexes for foreign keys and frequent queries
- **Partitioning**: Consider for large tables (not implemented yet)
- **Soft Deletes**: Use `deleted_at` fields when needed
