# Pseudo Robots

We want to create a couple of 'fake' robots who's only purpose is to respond to requests.

The request _should_ all be the same but there are 3 different responses types

- immediate (up to 2 or 3 minute wait)
- multi-part (immediate - no delay, then some future message "complete" or "failed")
- stream.

### Parrot Functionality

The only functionality these Pseudo robots will do is a Parrot Function: Each robot will do pretty much the same thing. Accept a message and echo it back, prefixed with a random number, example: input "Some message", response "(random int: 2309) Some message".

The only purpose is for development. The true 'robot' design will be done when we are ready to actually work with robots, for now we are setting-up the application fundamentals.
