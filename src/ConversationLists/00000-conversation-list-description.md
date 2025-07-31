# Conversation List Description

A Conversation List is a central conversation on a specific subject matter. The subject matter is not relevant to our present concerns.
The conversation will be multi-party: (x-agent and AI, cx-agent and cx-supervisor, cx-agent robot and cx-customer). At no time will cx-customer have a conversation with robot. Only cx-agent or cx-supervisor can initiate conversation with the robot. The customer will NEVER see robot messages directly, only the cx-agent/cx-supervisor may "share" messages with cx user.

Another way of thinking of 'Conversation List' a collection of messages within a chat conversation or chat groupd. However, the conversation will have multiple views. Only certain messages will be visible to certain individuals. We are not trying to replace Private Message or similar chat like applications.

Ultimately our goal is to create conversation to serve the needs of the customer, while maintaining some organizational privacy (cx-agent:cx-supervisor as example should not be shared with cx-customer who will also be in the conversation). It is expected that there will be one or more individuals in a chat group/room/conversation. Its expected the cx-agent will use the 'conversation' to chat with robots. We want the flexibility of allowing the customer and robot share the same conversation but be unaware of each other.

We do it this way because we may not want to share all robot messages with the customer nor do we necessarily want share message cx-agent:cx-supervisor messages.

We will always share cx-user messages with the conversation but we do not necessarily share those messages with the robot.

ONLY cx-agent/cx-supervisor can send message to the robot and view robot messages.

## Limit in scope. **VERY IMPORTANT**

These classes in the 'ConversationList' directory are to serve as the conversation represented in the Chat Room or Chat Group. NOTHING MORE.
We simply want a list of 'messages' and will need to act upon that list (insert new message, calculate size, etc) VERY IMPORTANT.

We allow client code to add, or insert, messages- we take no responsibility for creation of messages.

This class using a type generic to allow extending the "messages" type.

## Discussion

A conversation is a list of ConversationListItems (eg messages).
There will be an idea of 'view' in which each participant will see
certain items while other are not visible.

As example the following roles will have different visibilities:

- 'cx-customer' See only message between them and their cx-agent
- 'cx-supervisor' Should see all messages (excluding those we duplicate)
- 'conversation-admin' // sees all, this is a special role 'system' or similar that may add/duplicate message or edit message visibility.

Many of these messages will be sent to AI. For those we need to keep tract of tokenCount, the others, it wont be possible.

Some of the messages will not be
appropriate for AI (such as messages between cx-agent and cx-supervisor, cx-agent:cx-customer, cx-agent:cx-supervisor).
At this time only cx-agent or cx-supervisor can send messages to AI. Either can 'share' a message with the customer.
"Shared" message should be duplicated with author of 'cx-robot' and the duplicated message will be shared. This will help us
monitor/edit what will be share with the cx-customer. The cx-agent will be about to 'share' and presented with the
message, and allowed to edit the content before committing the shared message to the conversation (making it visible to the cx-customer).

I suppose this means, on the front end, the cx-agent will need an option to set visibility of messages. The cx-customer would not see that option
all of their messages get committed to the conversation. FE is not our concern but it is healthy to make note of it now.

As an example, we have a roles 'cx-customer' and a role 'cx-supervisor'.
The 'cx-customer' will see all messages while the 'cx-supervisor' will see only messages between them and the 'cx-customer'.

We should NEVER allow editing of message content.

Internally the first message will have index 0, this is fixed and never changes.

As such, we need an accessor to 'getLastMessage()' or better 'getMostRecentMessage'
this will be something to the effect \_messageList[_messageList.length-1], except, of course, when there are 0 messages.

### Frontend considerations

Cx-customer - will only be able to send messages to the conversation

###

Never remove items from conversation. Conversations (at this time) are ephemeral. We may find a way to store permanently but now it will only be stored in memory (not disk).
