# Pseudo Robots

- Sub-project directory `src/robots`

We want to create a couple of 'fake' robots who's only purpose is to respond to requests.

The request _should_ all be the same but there are 3 different responses types

- immediate (up to 2 or 3 minute wait)
- multi-part (immediate - no delay, then some future message "complete" or "failed")
- stream.

### Parrot Functionality

The only functionality these Pseudo robots will do is a Parrot Function: Each robot will do pretty much the same thing. Accept a message and echo it back, prefixed with a random number, example: input "Some message", response "(random int: 2309) Some message".

The only purpose is for development. The true 'robot' design will be done when we are ready to actually work with robots, for now we are setting-up the application fundamentals.

###

All robots will be defined in `src/robots`.
We want to be isolate robots - there should never be the need for the robots to import from the larger project. That may change in the future

We should use a barrel file and only export concrete classes/types.

We consider "Robots" as entities with special security consideration, hence, its imperative all definitions are wll managed (in their own directory)

### Current state of play

- AbstractRobot
- AbstractRobotAgent
- AbstractRobotChat
- AgentRobotParrot
- ChatRobotParrot

> note to self, need to devise a naming convention for robots
