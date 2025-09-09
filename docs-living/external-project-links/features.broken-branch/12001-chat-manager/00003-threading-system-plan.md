# Threading System Plan

## Overview

This document outlines the threading system that enables cx-agents to have side-bar conversations with robots and other agents while maintaining the main conversation flow.

## Scope

- Thread creation by cx-agents/supervisors
- Thread visibility management using threadId
- Thread-to-main-conversation sharing mechanism
- Thread participant management
- Thread lifecycle within parent conversation

## Key Features

### Thread Creation

- Only cx-agent/cx-supervisor can create threads
- Thread as side-bar conversation within main conversation
- No nested threading (threads cannot spawn sub-threads)

### Thread Visibility

- Message visibility using threadId grouping
- UI-agnostic implementation (group-by effect)
- Toggle between main conversation and thread views

### Thread Sharing

- Agent can share thread messages back to main conversation
- Selective sharing of robot responses
- Message duplication mechanism for sharing

### Thread Participants

- Robots can participate in threads
- Other cx-agents/supervisors can be invited to threads
- Customer exclusion from threads

## Dependencies

- Message management system (threadId field)
- Room management system
- Robot integration system
- Message sharing/duplication mechanism

## Success Criteria

- Clean separation between main conversation and threads
- Flexible message sharing from threads to main conversation
- No threading complexity beyond single-level threads
- Maintains conversation context integrity

## Out of Scope

- Nested threading (explicitly forbidden)
- Thread-to-thread communication
- Thread persistence beyond parent conversation
- Thread search/indexing
