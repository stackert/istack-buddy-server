# Post Release: Decouple Robot from Conversation

## Work Overview

This work will refactor the robot architecture to remove the tight coupling with conversation/chat message structures. Robots should be domain-specific components that accept parameters and return values within their own domain, rather than being forced to conform to conversation message formats.

## Key Areas to Address

1. **Define Robot Response Interface**: Implement the standardized response format with lastMessage containing author, content type, and payload
2. **Update Robot Implementations**: Refactor existing robots to return domain-specific responses rather than conversation messages
3. **Create Response Adapters**: Build adapters to transform robot responses into conversation messages when needed
4. **Update Integration Points**: Modify ChatManager and other components to work with the new robot response format

## Expected Deliverables

- New robot response interface with EXTENDED_MEDIA_TYPE support
- Refactored robot implementations (AnthropicMarv, RobotChatOpenAI, etc.)
- Response adapters for conversation integration
- Updated integration points throughout the system

## Notes

Robot should only return response that look something like

```json
{
    lastMessage: {
        contentType: [project's extended media types],
        payload: 'string'
        author: 'robot' [maybe robot classId],
        robotClassName: [maybe robot classId]
    }

}
```

Conversation will only handle/process messages that look like:

```json
{
        contentType: [project's extended media types],
        payload: 'string'
        author: 'robot' [maybe robot classId],
        robotClassName: [maybe robot classId]
        maybe_conversation_id?
        maybe_other_necessary_conversation_detail (author)
}
```

**Take Away** - we need to introduce transformerRobotToConversation
to decoupled these
