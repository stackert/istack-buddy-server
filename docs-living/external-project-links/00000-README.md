# External Projects

There are several features I like within these projects. There is several functional domain commonalities with some of our objectives. We should review the work that has already been done on other projects for: anti-pattern, pattern, or perhaps plane code "borrow".

Neither of these projects should be considered 'production' or 'complete'. They are both work in progress. If we 'borrow' we should only borrow code that comes with 90% + coverage (with rare exception).

I would like to be sure to mention the permission system(s) specifically. There has been a lot work done with this. We MUST implement similar permission systems. We may choose to clean-up a little. I am talking specifically about 'domain:function:action' convention. That resources have permissions requirements and users have permissions. We MUST maintain a very clear language, and document that convents. We SHOULD NEVER mix terminology. We'll use groups or permission-sets but not both. "permission" or "grant" - not both. (I think we want a conventions document it would be named 00010-conventions-permissions.md)

## How Do you know server (src)

- source: documentation-living/external-project-links/how-do-you-know-src

/mypart/tmc/projects/how-do-you-know-server_take2
/mypart/tmc/projects/how-do-you-know-server_take2/src/AI-README.md

- Authorization
- no chat
- uses permission/grant (contribute to language) @RequirePermissions('course:resources:practice-exam:common:read')

**"how-do-you-know-server_take2"**

### Main Functional Domains

• **Authentication & Authorization** - User authentication, JWT tokens, role-based access control, and security guards

• **User & Institution Management** - Multi-tenant user management with institutional hierarchies and access permissions

• **Educational Content Management** - Course resources, practice exams, and question archetype management for educational content

• **Assessment & Response Systems** - User response tracking, fodder pools for question management, and assessment delivery

• **File Management** - Secure file upload, storage, and retrieval system with ownership controls and content streaming

• **Background Processing** - Queue-based job processing using Bull/BullMQ for handling file operations and other async tasks

• **API Documentation & Testing** - Comprehensive Swagger/OpenAPI documentation with extensive E2E testing framework

The system appears to be production-ready with proper database management, environment configurations, testing infrastructure, and deployment scripts.

--- Ai-gabby-server-take1 - Nothing useful
--- how-do-you-know-server_take2 - File Manger, permissions, authentication - not groups/chat-rooms

---

## conversations-server

- source ./documentation-living/external-project-links/conversations-server-src
  See function domains below.

/mypart/tmc/projects/conversations-server-take2
/mypart/tmc/projects/conversations-server-take2/src/AI-README.md

### Functional Domains:

### **WebSocket Gateway & Real-time Communication**

- Manages WebSocket connections using Socket.IO with NestJS decorators
- Handles client connection/disconnection lifecycle
- Implements AsyncAPI documentation for WebSocket events
- Runs on dedicated port (3002) for WebSocket traffic
- Maintains active client registries for efficient message routing

### **Conversation Management**

- Creates and manages conversation rooms with unique UUIDs
- Stores conversation metadata (title, messages, participants)
- Provides conversation listing and discovery functionality
- Handles message persistence within conversations
- Supports conversation subscription for real-time updates

### **Participant & User Management**

- Implements user authentication via WebSocket handshake headers
- Manages participant profiles with roles and permissions
- Tracks user participation across multiple conversations
- Provides participant lookup and management services
- Supports role-based access control (`guest`, etc.)

### **Group/Room Management**

- Creates and manages chat groups/rooms dynamically
- Handles participant addition/removal from specific rooms
- Maintains group membership tracking and participant lists
- Provides group discovery and enumeration capabilities
- Manages room-specific subscriptions and client associations

### **Message Broadcasting System**

- Implements targeted message delivery to specific room participants
- Supports both room-specific and global broadcasting patterns
- Handles message routing based on conversation membership
- Provides efficient client lookup and message distribution
- Manages broadcast events for real-time synchronization

### **Authentication & Authorization**

- Implements WebSocket guard system for protected routes
- Uses role-based decorators for endpoint access control
- Validates JWT tokens from WebSocket handshake headers
- Manages session state and participant authentication
- Provides authorization middleware for secure operations

## How Do you know server (docs-living)

The IMPORTANT document is the create database script (`documentation-living/external-project-links/how-do-you-know-docs-living/database_002_build_schema.sql`). We may find some table definitions useful and if we "barrow" we will likely want to borrow in it's entirety, related tables, functions, stored procedures related to the table definition we barrow.

Most importantly is the convention used. We need to establish a sql convention for this project and our convention should be based off of that create database script. That means I would expect us to have a 00010-conventions-sql.md file for our project.
