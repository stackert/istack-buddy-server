# Retired Robots

This directory contains robot implementations that are no longer actively used in the application.

## Retired Robot Files

- `ChatRobotParrot.ts` - Testing/demo robot that parrots messages
- `RobotChatOpenAI.ts` - Generic OpenAI chat robot
- `RobotChatAnthropic.ts` - Generic Anthropic chat robot
- `SlackyAnthropicAgent.ts` - Alternative Slack robot (not used)
- `MarvOpenAiAgent.ts` - Alternative Marv robot (not used)
- `SlackAgentCoreFormsParrot.ts` - Slack agent for core forms
- `SlackAgentCoreFormsSsoAutofillParrot.ts` - Slack agent for SSO autofill
- `AbstractSlackRobotAgent.ts` - Abstract base for Slack agents
- `types.ts` - Types for Slack agents

## Currently Active Robots

The following robots remain active in the main robots directory:

- `AnthropicMarv` - Used for Marv sessions (Formstack API operations)
- `SlackyOpenAiAgent` - Used for Slack interactions
- `AgentRobotParrot` - Testing/demo robot (kept for testing purposes)

## Notes

- These robots were moved here to reduce clutter while preserving the code for potential future use
- The robot service has been updated to only register the active robots
- Tests for these robots have been moved here as well
- Import statements throughout the codebase have been updated to remove references to these retired robots
