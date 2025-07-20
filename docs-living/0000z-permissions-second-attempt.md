# Permission System Overview

## What This Is

This document provides a high-level overview of our permission system, based on the proven patterns from the how-do-you-know project. We're implementing nearly identical permission systems.

**Reading time: 5 minutes**

## Vocabulary Statement

We use very strict/specific vocabulary when talking about permissions:

- **`actor`** - someone/service attempt an action
- **`resource`** - an action someone/service can access
- **`permission`** - A string token representing a specific capability
- **`permission-requirement`** - Resources have permission requirements (what they need to allow access)
- **`permission-assignment`** - Users have permission assignments (what they've been given)
- **`permission-group`** - A collection of permissions commonly added together (e.g., 'user:profile:add', 'user:profile:update', 'user:profile:edit'). Users are `members` of groups. These permissions are assigned at login and the user never 'has' those permissions directly.
- **`permission-set`** or **`permission-chain`** - The calculated permissions for a given user. ALL USERS HAVE A PERMISSION SET (anonymous may have an empty set).
- **`permission-domain`** - The top-level functional domain (e.g., 'user' or 'user:profile' in 'user:profile:edit'). Determined by lookup table.
- **`deny`** - A very special permission that is almost never used. If found in any permission chain, the whole chain fails.

### Key Facts

- We use the naming convention `domain:sub-domain-0:sub-domain-1:verb` to define permissions
- Permission chains are calculated at login by combining individual permissions and group membership permissions.
  -- A. combine both sets of permissions
  -- B. Remove any exact duplicates (without conditions)
  -- C. Remove duplicates based on conditions (if two permissoins and one has a condition, remove the non condition). If two have conditions combine conditions? (this part is not implemented)

- Authorization evaluation happens when an actor attempt to access a resource. All resources MUST have permission requirement (access control). When the actor attempts to access the resource, the system review the requirement and the actor's permission chain, if the permission exists within the chain and any conditions are met, then access is granted.
- Permission chains are associated with the user/login. Changes to the permission chain will not take effect to the next login (this may need to be fix such that we have for login time-out if permission change.) Admin deactives a user, it may mean we need to immediately revoke the user - as this write we do not have this functionality.
- If there are conflicting permissions without conditions, they are identical so no resolution is needed. Because we have only allow permission - there can not be allow/deny conflict
- If one permission has conditions and another doesn't, the permission chain gets the one with conditions
- Permission conditions are evaluated at the time of resource access
- Actual permission chains WILL NEVER have duplicate permissions (not possible)
- Permission-requirements are the set of permissions on a resource. THESE NEVER HAVE CONDITIONS. We keep this list as small as possible, usually one or two only.
- There are never 'group' or 'wildcard' permissions. ANY RESOURCE MUST HAVE DISTINCT PERMISSIONS, nothing is inferred or granted 'by virtue of...'
- Users get permissions through group membership and individual assignment
- Permission groups are convenience - there are no true 'groups', just groupings of permissions for easier assignment
- We do not allow groups of groups
- We will never assign permission groups as permission-requirements on resources
- We use JWT tokens expected to come as cookies, but during implementation/launch we'll allow GET parameters
- Our initial launch has very little need for user permissions - we build it now because we need a permission system and this system was/is already designed, it's robust and well defined
- We don't actually hope to replace other permission systems or do our own auth. However, internally we MUST guard and this seems pretty good for that purpose
- Permission groups include: 'external-service', 'cx-agent', 'cx-user'
- when permission condition evaluation the permision is not 'deny' it is simply removed from the chain. Because the chain is created by add all permissions removing duplicate (without conditions, we keep the ones with conditions) permision, if a chain has two identical permission, one with a condition, the failed condition removes both permissions

## Core Philosophy

We pursue a **pessimistic permission evaluation** - we fail for ANY reason. In the absence of a specific allow, deny is assumed. We always solve for truth, always solve for allow.

## Root Entities

### Permission

A permission is a string token that represents a specific capability. It's a root entity - it exists independently and has no inherent meaning until combined with other entities.

### Permission Assignment

A permission assignment is an assignment of a permission to a user or group. It's how we give someone a specific capability.

### Permission Requirement

A permission requirement is what a resource (like an endpoint) needs to allow access. It's what the resource demands.

**The Magic**: Access is only granted when all three align:

1. A resource requires a specific permission
2. A user has been assigned that exact permission
   2.1 if the assigned-permission has condition it evaluates to true
3. No deny permissions override it

- convention - conditions should be written in the positive 'isAllowed', 'user is in[]'. Avod the negative 'isNotAllowed' 'user isNotIn[]'

## Naming Conventions

### Permission Format

Permissions follow the pattern: `domain:sub-domain:sub-domain:verb`

**Examples:**

- `chat:conversation:read`
- `auth:user:profile:me`
- `admin:debug:system`

### Important: No Hierarchy, No Inheritance

Despite the colon-separated appearance, there is **no hierarchy, no layers, no inheritance**. A permission like `chat:conversation:*` has no special meaning and is invalid due to special character restrictions.

Permissions are simply tokens - they represent specific capabilities, nothing more.

## Domains

Domains are the first part of a permission and represent functional areas of the system. We use a limited set of well-known domains:

- **chat** - Chat conversation management
- **auth** - User authentication and profiles
- **admin** - Administrative debugging tools
- **system** - System-level operations

## Groups

### What Groups Are

Groups are collections of permissions for administrative convenience. They exist to make permission management easier.

### What Groups Are NOT

- Groups are NOT inheritance relationships
- Groups are NOT structural constructs
- Groups are NOT permission hierarchies
- Groups are NOT roles

### How Groups Work

- Users can belong to multiple groups
- Groups can have permissions assigned to them
- When a user joins a group, they get all the group's permissions added to their permission chain
- Groups are purely for convenience - there's no "group permission" concept

## Atomic Permissions

### What "Atomic" Means

Each permission is completely independent. There's no such thing as:

- Permission inheritance
- Permission hierarchies
- Permission dependencies
- Permission relationships

### Permission Name Conflicts Are Impossible

Since permissions are just string tokens, there can never be two permissions with the same name. You can't have:

- `grantx:{condition: always_true}`
- `grantx:{condition: sometimes_true}`

**THERE CAN ONLY EVER BE ONE `grantx`**

## Permission Conditions

### What Conditions Are

Conditions are extra rules that apply to permissions. They allow for fine-grained control beyond simple allow/deny.

### Common Condition Types

- **Self-access conditions**: Users can only access their own data
- **Observer conditions**: Users can only observe specific courses or students
- **Time-based conditions**: Permissions that expire or are time-limited

### How Conditions Work

Conditions are evaluated as part of the permission checking process. If a condition fails, the permission is removed from the user's effective permission chain.

## Reserved Words and Special Permissions

### Observer Permission

- **Slug**: `observer`
- **Effect**: Converts the entire permission chain to read-only
- **Usage**: Any permission containing `observer` makes the user read-only
- **Example**: `observer:student:view` makes the user a read-only observer

### Deny Permission

- **Slug**: `deny`
- **Effect**: Converts the entire permission chain to deny all
- **Usage**: Any permission containing `deny` blocks everything
- **Example**: `deny:all` blocks all access regardless of other permissions

## Permission Chains

### What Is a Permission Chain

A permission chain is the complete collection of all permissions for a user. It includes:

- Direct user permissions
- Group permissions (from all groups the user belongs to)

### How Permission Chains Work

The system combines all user permissions into a single chain, then evaluates that chain against what a resource requires. The evaluation process includes:

- Checking for banned permission types
- Processing any deny permissions
- Evaluating conditions
- Applying special cases (like observer restrictions)

## Language Rules

### Pursue 'True' Language

We use language that seeks 'true' and avoid language with negation. This makes logic discussions clearer.

**Good Language:**

- ✅ "Solve for allow"
- ✅ "Permission granted"
- ✅ "Access permitted"
- ✅ "User has capability"

**Avoid Language:**

- ❌ "Not denied"
- ❌ "False permission"
- ❌ "Deny access"
- ❌ "No permission"

### Forbidden Terms

- **"Role"** - Use "permission" instead
- **"Grant"** - Use "permission" instead
- **"Permission Set"** - Use "group" instead
- **"Access Control"** - Use "permission" instead

## Resource Access Pattern

### How Resources Work

- A resource can require **zero or more permissions**
- **Zero permissions** = denied for all
- **One permission** = that permission must match the user's permission chain
- **Multiple permissions** = only one permission must match (OR operation)
- **Any deny permission** = whole chain is denied

### Examples

- A chat endpoint might require `chat:conversation:read`
- An admin endpoint might require `admin:debug`
- A public health check requires no permissions
- A sensitive endpoint might require multiple permissions (any one grants access)

## Key Principles

### 1. Pessimistic Security

- **Default**: Deny access
- **Grant**: Only when explicitly permitted
- **Override**: Any deny permission blocks everything

### 2. Atomic Permissions

- Each permission is independent
- No inheritance between permissions
- No permission hierarchies

### 3. Exact Matching

- Permission strings must match exactly
- No wildcards or pattern matching
- Case-sensitive comparison

### 4. Group Convenience

- Groups exist for administrative convenience only
- No structural meaning to groups
- Users can belong to multiple groups
- Group permissions are added to user's permission chain

### 5. Always Solve for Truth

- We always solve for allow
- We avoid negation in our logic
- We pursue clear, positive language

## What This Means for Our Chat Application

Our chat application will use this permission system to control access to:

- Chat conversations and messages
- User profiles and authentication
- Administrative debugging tools
- System operations like Slack integration

Each endpoint will have specific permission requirements, and users will be assigned the permissions they need based on their role in the system.

## Summary

Our permission system is:

- **Pessimistic** - deny by default
- **Atomic** - each permission is independent
- **Exact** - strings must match precisely
- **Convenient** - groups for administration only
- **Clear** - always solve for truth

The system provides predictable, secure access control while maintaining simplicity and clarity.

```
GET /                                    - public
POST /auth/user                          - auth:user
GET /auth/profile/me                     - auth:user:{self}
POST /chat/messages                      - chat:conversations:message:send
GET /chat/conversations                  - chat:conversations:read
GET /chat/conversations/:id/messages     - chat:conversations:message:read
GET /chat/conversations/:id/messages/last/:count - chat:conversations:message:read
POST /chat/conversations/:id/join        - chat:conversations:join
GET /chat/conversations/:id/participants - chat:conversations:read
GET /chat/dashboard/stats                - chat:dashboard:stats
POST /chat/conversations/start           - chat:conversations:create
POST /chat/conversations/:id/leave       - chat:conversations:leave
POST /dev-debug/auth                     - admin:debug
GET /dev-debug/user-details/:userId      - admin:debug
GET /dev-debug/users                     - admin:debug
GET /dev-debug/auth-status/:userId       - admin:debug
GET /istack-buddy/slack-integration/health - public
GET /istack-buddy/slack-integration/debug - admin:system
POST /istack-buddy/slack-integration/slack/events - system:slack:events
```
