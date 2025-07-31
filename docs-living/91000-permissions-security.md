# Introduction Permissions and Security

The permissions and security system provides access control across application components using a domain-based permission model with conditional permissions and minimal infrastructure requirements.

Security is maintained through signature verification, JWT token validation, and permission checking on externally available resources (end-points).

### Infrastructure Security

The application is expected to be deployed behind an application load balancer with only five publicly accessible endpoints:

1. `/istack-buddy/slack-integration/slack/events` - Slack webhook events
2. `/public/form-marv/{sessionId}/{formId}` - Form troubleshooting sessions (formId used for verification)
3. `/public/form-marv/{sessionId}/get-form-json` - Get form data for session
4. `/public/form-marv/{sessionId}/post-marv-message` - Send messages to Marv
5. `/public/form-marv/{sessionId}/get-marv-last-messages` - Poll messages from Marv

<!--
_TMC_ We need to build those endpoints
They all have the same permissions (or we need to create some others)
-->

### Data Protection

We do not store ANY information or data. We read from Intellistack's internal read-only API to view forms. For form troubleshooting sessions (Marv), we update only forms within iStackBuddy's account using the public API - no writing to customer accounts.

**Disclaimer:** This is a living document and is not guaranteed to be accurate. Our objective is to be informative over factual. We'll avoid making factual statements but provide generalizations. The objective is to make them timeless. Source of truth is ALWAYS CODE.

<!--

AI DO NOT REMOVE THIS COMMENT

WE need to get form json
WE need to send messages to marv
WE need to poll messages from marv
WE want websockets will be using socket.io which should do this for us
 TODO WE NEED TO THINK THIS THROUGH

 -->

# Features

- **Domain-based Permission Format**: `domain:resource:action:role` (e.g., `chat:conversation:read`, `external-service:slacky:events`)

- **Three-part Access Control**:
  - **User/External-Service** (gets permission-assignment)
  - **Resource** (has permission-requirement)
  - **Resource evaluation** - if the effective permission chain contains the permission, the agent (service/user) is granted access. Effective permission chain combines both 'own' and 'membership' permissions, removes duplicates, evaluates conditions (removes those that fail condition) and the result is effective/actual permission set.

- **OR Logic for Multiple Permissions**: Having ANY of the required permissions grants access

- **Conditional Permissions**: Support for time windows and date ranges (minimal set - expandable when needed)

- **Permission Groups**: Can be role-based (read,write,update,delete for a given resource) or team-based (cx-tier-1, cx-admin, cx-supervisor). Groups cannot contain other groups. We discourage over-use of groups.

- **Authentication Methods**:
  - JWT tokens for user sessions
  - HMAC signature signing for external services (Slack)
  - Temporary UUID URLs for form troubleshooting sessions (in-memory, time-to-live)

- **Service Users**: Minimal 'static' users for operational purposes (e.g., Slack Service user)

- **File-based Configuration**: All permissions stored in JSON files - no external database required

- **Specific Vocabulary**: permission, permission-assignment, permission-requirement, permission-group. We NEVER use "deny" NEVER.

- **External Service Security**: Slack webhook signature verification using HMAC-SHA256 with timestamp validation

- **Minimal Infrastructure**: No external database, authentication service, or cache required. This is minimum setup - obviously if project expands more resources will be required.

- **Future Integration**: Initial roll-out setup. Later may integrate with larger Streamline ecosystem.

# Summary

The security system operates on three simple principles: users/services get permission assignments, resources have permission requirements, and access is granted when the effective permission chain contains any required permission. The effective permission chain combines user permissions and group memberships, removes duplicates, and evaluates conditions to create the final permission set.

This creates a comprehensive yet simple security model where external services authenticate through signature verification (like Slack's HMAC), users authenticate through JWT tokens, and all access decisions are made by comparing the effective permissions against resource requirements using OR logic. The file-based configuration approach eliminates external dependencies while maintaining full audit trails and version control, making the system both secure and operationally simple.
