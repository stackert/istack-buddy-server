# Feature Chat System

Should support:

- Group Chat
- Chat with robot
- Solo chat
- POST authentication (http)
- Chat communications will use websocket (wss)
  Authentication will be done through HTTP post, that will return an authenticate jwt token
  That toke will be used as bearer token for wss requests.
- All communication will be done in 'group' or 'chat room'. It may be a 1:1 conversation but that will
  be in a group/room that is restricted (we may allow supervisor break-in)
- We should maintain our own list of allowed users. We need to be clear about 'user' and 'user profile'
  We need to be clear about 'Authenticated Entity' and a user that needs to update their avatar
- We should maintain a lists of users, chatrooms, counts of people in chatrooms, make participants in chat group available to supervisors.
- We should support the notion 'guests'. Who are authenticated by not part of the 'employee' group.
- Each conversation will be centered around an 'issue'. We may invite/remove robots to the chat as necessary.
- Each 'issue' can be 'escalated'. I _think_ an escalation looks like A) Create new room (or not), Invited employee of higher support level (T1 < T2 < T3).
- No guest should be by themselves EVER, guests should only be invited to a room (for the time being)
- Only employees can send messages to Robot. Those messages go to chat and robot, robot response goes to chat (viewable to employee only), employee chooses to share with guest.
- We need to support message types of something like: 'streaming' (real-time), 'batch-delay'. A file upload or a Agent (robot) activity will see 'batch-delay' the messages created in chat immediately then updated when the job finish. Hence something like file-upload or agent-request is supported.
- We need file storage (I built this somewhere before, we need to use that or at least review it)
- We need to create a minimum set of robots to include: iStackBuddy.forms.diagnostics, iStackBuddy.docs.jokes, iStackBuddy.fsid.jokes, iStackBuddy.stream.jokes, iStackBuddy.sign.jokes. The _.jokes robots can be pretty much the same thing, and simply returns AI generated jokes (they will use specialized prompts with user input: iStackBuddy.stream.jokes.getOneDadJoke({customerName: 'John Q', observations: ObservationResults}) ) will return a dad joke addressed to {customerName} that includes some of the observations. The _.jokes robots are only for development purpose only. We only have forms diagnostic tools so that is the only 'real' robot.

I have done a lot of this work already, however that code is 'discovery' or 'proof of concept' and not production quality. To that end, most of that work should not be directly imported but rather only reviewed.

We have a notion of "ObservationMakers' and "ObservationResult" see imported library istackbuddy-utilities

Request Message will have types....
Response Message will have types:

- 'chat'
- 'graph
- 'image'
- 'file'

Every conversation should have a conclusion

- escalated
- resolve
- unresolved
- guest-disengaged (stop chatting)
