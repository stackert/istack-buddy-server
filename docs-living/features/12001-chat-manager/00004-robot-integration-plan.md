# Robot Integration Plan

## Overview

This document outlines the integration system between the chat manager and the robot services, including RouterRobot coordination and multiple robot management.

## Scope

- Robot service integration (internal services, not group members)
- RouterRobot coordination for robot selection
- Multiple robot management within conversations
- Robot context window monitoring
- Robot message routing and filtering
- Robot participation in threads

## Key Features

### Robot Service Architecture

- Robots as internal services (not chat participants)
- Robot message routing through internal APIs
- Robot response integration into chat flow

### RouterRobot Integration

- Leverage existing RouterRobot for robot selection
- Agent-refined questions to RouterRobot
- Multiple robot recommendation handling
- Agent choice in robot selection

### Context Management

- Monitor robot-specific MAX_CONTENT_WINDOW_IN_TOKENS
- Context summarization as window approaches limit
- Robot-specific conversation filtering
- Send only relevant messages to each robot

### Multiple Robot Coordination

- Handle multiple robots in single conversation
- Robot addition/removal mid-conversation
- Robot-specific message filtering
- Avoid robot cross-communication

## Dependencies

- Existing RouterRobot system (completed)
- Existing robot framework (RobotChatAnthropic, RobotChatOpenAI, etc.)
- Message management system
- Threading system
- ConversationList filtering capabilities

## Success Criteria

- Seamless robot integration without chat group membership
- Efficient context window management
- Flexible multi-robot conversations
- Clean robot message routing

## Out of Scope

- Robot development/training
- Robot response quality/accuracy
- Robot-to-robot communication
- Robot load balancing
- Robot failover mechanisms
