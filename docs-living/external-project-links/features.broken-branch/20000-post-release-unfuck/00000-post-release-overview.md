# Post Release fixes

## Decouple robot from chat manager

Robots are defined to return conversation/chat messages. This is a mistake, then should
accept parameters and return values within their own domain. A simple 'lastMessage'
with nothing more that the thing(s) the robots know about

```
 lastMessage: {
    author: robot
    content: {
        type: EXTENDED_MEDIA_TYPE
        payload: T extends SUPPORT_TYPES
    }
 }
```

where  
 type: EXTENDED_MEDIA_TYPE - we have specialized media type already defined
payload: T extends SUPPORT_TYPES - in most cases this will be a string
string content, file url, speech/audio file

We will not define message type, messageId, etc. Those are function of the larger conversation.

## Decouple / Define clear separation of concern Conversation Manager/Chat Manager/Robot/User

The last I knew ChatManager was maintaining it's own list of message AND adding message to the ConversationListManager. It should be adding messages to only ConversationListManager. However, the flaw was not discovered until ChatManager was in heavy use so changing became more challenging

We may want to
A) Remove `ConversationListManager` to assure there is no misuse
B) Introduce 'ConversationManager' with clearer definition
C) Restructure EVERY ChatManager interaction to assure its using ConversationListManager

- Robot -> semi dumb. Accept Request, provide response. No outer integration
- ChatManager -> Manages interaction between 'Chat' user (websocket) and internal resources (Robot, FileManger [does not exist])
- ConversationListManager -> insert message, get message(s), filterMessage

# Security Audit

We dismantled security features because we were having problems with request routing related primarily hosting static app within a secured directory structure.

We had a static page that was given false understanding of the underlying issues. Specifically we were seeing the hosted page and thinking it was the app.

We had issues with using shared route and /create-test-session (not sure of the name),
which is an unprotected resource that lives in the parent of the protect resource

- /marv-form/create-temp-session
- /marv-form/{sessionId}/{formId}

Where 'marv-form' host only `create-temp-session'`(unprotected) and `/marv-form/{sessionId}/` (protected). It may be easier/wiser to remove the unprotected resource to a /dev-debug/end/point.

## Upgrade to V2025

We built this form/field related object based off of V2. V2025 is now widely available. We did develop against v2025 but we need to verify it is still valid. V2 is known to have calculation issues specifically related to date calculation. That means marv/iStackBuddy also suffer those issues (missing calculation fields). Hence we want/need overcome the limitation before we can be consider reliable/trust worthy
