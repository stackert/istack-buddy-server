# Chat Manager

We need to build a Chat Manager, that manages- Chat/Chat Rooms/Conversations.

Our Chat will be very similar to other Group Chats, except message visibility and functionality will be conditional based on user Role. cx-customer can always see their own messages. The should be able to see message 'shared' with them from the cx-agent. Most messages from the cx-agent will be visible to the customer. However, some messages will not be shared with the customer.

Messages with limited visibility

- cx-agent:robot
- robot:cx-agent
- cx-agent:cx-agent (colleagues or supervisors)
- no robot message will be directly visible to the customer
- all messages will be visible to any cx-agent/cx-supervisor

(hint cx-agent:robot is short hand for 'From cx-agent to robot', hence directionality is very important). I guess this means we'll need to add attributes to/from (more explicit naming) to our message/envelope. In all cases the messages will got "to" chat group/room, but to/from will effect visibility.

When we make requests of the robot, we only send conversation messages specified by cx-agent/cx-supervisor. I envision a list of message, some to/from robot. Only 'robot' message should be sent to robot. We will also need to monitor context window to summarize as we approach [robot].MAX_CONTENT_WINDOW_IN_TOKENS - where each robot has MAX_CONTENT_WINDOW_IN_TOKENS.

In order for the customer to see the robot chat messages the cx-agent will need to "share". For this, I think the best way is to duplicate the message on behalf of the cx-agent, and share the duplicate message. The duplicated message will change some values (author/to/from as example). We may want to implement a field 'originalMessageId' or 'duplicatedFromMessageId' similar to make distinction between original message.

We need to be able to allow cx-agent to invite other cx-agent/cx-supervisor to the chat.

We need to monitor how many chat conversations are active, their participants, number of messages. This should be a dashboard visible to any/all cx-agent/cx-supervisor.

I envision the flow to looks something like:

1. click button "Start chat now"
2. Chat window opens, end-user (cx-agent, customer, anybody) will type their request in the chat window and click "send"
3. This will queue the conversation until a cx-agent 'joins'.
4. Once the cx-agent joins they will respond to the customer. They will decide to send the question to the robot or try to answer it themselves (this means we need to be able to add more messages to the robot conversation, meaning, the agent can click a button to 'add to robot conversation', our ConversationList should provide function 'filterByRole').

### Router Robot (prerequisite)

This has been completed

<!-- We will require (prerequisite) a 'RouterRobot' that accepts all questions and determine(s) the best-fit robots. The original question/request will likely be kinda generic "I have a problem with my Form", "I am not receive email", it will be the cx-agent's responsibility to refine the question to something more direct/specific. That request goes to the RouterRobot which then return a list of robots to best suited for the task. Sometimes will need to simply provided the user with appropriate documentation sometimes it will require further conversation. The cx-agent will then choose which robots to send the request to, there may be more than one.

We need to figure out how to work with multiple robots and changing robots in mid conversation. The cx-agent/user may have an issue which will be best served by a specific robot, so the conversation participants will include those robots. However, we may not need all robots to participate so we need to exclude some robots. There is the case where the cx-agent/user work on a specific issue, and in conclusion the cx-agent may want to include documentation so they will send the request to the documentation robot. The documentation robot will not need to view the whole conversation, just the cx-agents one request.
I want to avoid multiple thread (or maybe threads is the solution.) -->

### Threaded conversation (prerequisite)

cx-agent should be able to create a 'thread' in which the cx-agent can have a side-bar conversation with the robot. When the cx-agent feels the side-bar conversation has been concluded, then can choose to share any/none of the robot message with the user.

A 'thread' can be shared with robot, other cx-agents/cx-supervisors but there will be NO THREADED THREADS. Will will limit threads in that it will not be able to spawn additional threads.

### Incoming Requests Phase I (no prerequisites)

An incoming request can come directly from cx-user/cx-agent/supervisor (our web chat client).
We can also start a conversation with a webhook. The idea here is that we can start the conversation in Slack, but continue outside of chat, within our chat client. This is useful to getting around Slack limitations. It is also useful if we ever allow customers to use it, they do not have access to slack.

At this time there are some significant security implications so we are not including customers as potential participants, but we will develop our application to expect that our customers will be able to use this feature in the future.

Our security concern is that we have authentication mechanisms for authenticating cx-agents but not user authentication.

With Slack we can ask fairly specific questions. However, sometimes we need to "do" more than just read the form's read-only information. Sometimes we need to change the form settings. THIS MUST BE DONE ONLY ON FORMS WITHIN THE cx-agent's own Formstack account. Cx-agents will have profiles with their API key. That API key is valid only test accounts own by the cx-agent.

Some of these functions include

- back-up logic
- back-up calculations
- uniquely identify fields

These functionalities are already built are will get built but its not possible to perform these operations within Slack, due to the necessity to authorize the user (Slack wont provide us user details for Formstack accounts, hence this must be done outside of Slack. )

### Conversation Life-Cycle

Conversations mostly do not terminate for phase one. Because there is no persistence (Phase I). We do not need to "close" conversation (no more new messages), nor will we "Archive" conversations. However, phase two will require we make these decisions.

### Incoming Requests Phase II (has prerequisites)

We are not doing this anytime in the near future. However, if we decide to offer the use of our chat systems to customers, we need to be able to Authenticate, verify Authorization, query account details, potentially creating an API key for them.

### Off handed comments

Any messages that come from slack must be responded to via slack. We'll keep the room and it will be available to 'continue' conversation but we'll assume slack is handling the chat interface and we'll server as the backend.

### Infrastructure

For proof of concept we're going to use our current database. This makes a poor production choice but before we can take the chat client to production we need to secure budget, to secure budget we most show proof of concept, and so the cycle goes. Our design choice should embrace that A) we will change to a memory cache from standard database and B) today we are using database.

#### _Thought_ - there may be no reason to use a database at all.

As a proof a concept we do not need persistence. Perhaps performance outweighs the need for persistence, for proof of concept.

### Database Design / Table Layout

We will flesh-out this in our requirement documents

### API Specification

We will flesh-out this in our requirement documents

### Websockets / API / Webhook

We will primarily use websockets but we MUST support api calls

- put/POST message (most likely "POST")
- get message details
- get conversation list
- get all messages
- get last n messages (default to last 1 message), applications can get last 5 (or whatever) messages so they can check to see if they're missing any messages. Application would do something like - get last 10 messages, add to chat UI only missing messages (which may be one or two or three..).

#### Security

We'll use this system's current security implementation. That is not a concern for this sub-project. Websocket with get the jwt token from the bearer token field.
Our API should support reading jwt from cookie or from bearer token.

### Robot integration

Robots will never truly join a group. Robots will be an internal service. We should be able to send messages (robot centric conversation) to any robot. We have a RobotRouter to send to message to several robots at one time.

### Conversation Life Cycle (Phase II)

This will require persistence.

- we want to determine "success" of a conversation. Did it conclude with positive resolution. Is no conclusion, conclude with negative? All conversations "should" conclude but likely several conversations will not have clear termination. When possible we'll make effort to promote conclusion (Example: Slack app can ping thread after 3 days - "hey tell me what happened").
- We want to be able to train/teach/refine our knowledge base. Our conversations will serve as feedback loop to improve knowledge base.

### Knowledge base

- WE WILL NOT BE RELAYING ON CUSTOMER FACING HELP DOCUMENTS.
- we relay on previous conversations and context documents provided codebase owner to outline process and technical details (error messaging, data-flow/process life-cycle).
- Customer facing help documents tend to be written to assist low-tech customers. We are neither low tech nor customers. With customer documents will avoid mention of complicated nuances or known issues - we embrace these.

### Conversation Threading

- Only cx-agent/cx-supervisor can open a thread. These are side conversation within the context of the main conversation. All "threads" will be accomplished by using message visibility (which means we may need to add 'threadId' or similar). The "true" conversation will be one simple list of messages. With thread/threadId we can accomplish a group-by effect. How UI implements is their concern (not ours), however a simple recommendation is that there is a visibility toggle to allow cx-agent/cx-supervisor to switch view (conversation/thread 1/thread 2/ etc).

Life-cycle fits within the larger conversation life-cycle. Phase I - no life cycle, phase II+ we'll archive conversations for 90 days, we'll pursue 'termination' as success/unknown/negative/jira (issue or bug report)

### Scalability

#### Phase I

Phase I will support a maximum of 10 users with no more than 100 conversations, 25 messages per conversation. We will implement 'warning' when message exceed maximum message limit. This is an artificial limit so we need not take further action than 'warn'. For users and conversation limit - we will not implement at limits at this time. Phase II is more or less support for the slack application which is request/response.

HOWEVER, we need to implement 'inactive' conversation and do garbage collection around that.

Maybe for each new conversation scan for existing in active conversation.

Conversation is considered inactive if last message is more than MAX_TTL_INACTIVE_CONVERSATIONS (I am not sure. In real-life 3-5 days would be appropriate but in Phase I were we may have significant limitations 10 minutes may be the right number. Because this is only 'warn' I am not sure we care too much, increase swap?1q).

This creates the expectation that most conversations will be created within slack. There will be several (100+) in a day, and we will wipe-out most within minutes/hours of creation.

Effectively, in phase I, the "conversation" server will be invisible and serve no real purpose. We MUST keep the conversation server to make Phase II easier to implement. We do not want to redo phase I work when we implement phase II.

#### Phase II

We will consider phase II scalability at a later date, when we flesh-out phase II designs
