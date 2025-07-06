// Abstract base classes
export { AbstractRobot } from './AbstractRobot';
export { AbstractRobotChat } from './AbstractRobotChat';
export { AbstractRobotAgent } from './AbstractRobotAgent';

// Concrete robot implementations
export { ChatRobotParrot } from './ChatRobotParrot';
export { AgentRobotParrot } from './AgentRobotParrot';
export { RobotChatOpenAI } from './RobotChatOpenAI';
export { RobotChatAnthropic } from './RobotChatAnthropic';
export { AnthropicMarv } from './AnthropicMarv';

// Pseudo robot implementations
// Note: PseudoRobot exports commented out as files are in .hidden
// export { PseudoRobotRouterSuggestions } from './PseudoRobotRouterSuggestions.ts.hidden';
// export { PseudoRobotRouter } from './PseudoRobotRouter.ts.hidden';
// export { PseudoRobotDocumentationSuggestions } from './PseudoRobotDocumentationSuggestions.ts.hidden';

// Slack Agent implementations
export { SlackAgentCoreFormsParrot } from './SlackAgents/SlackAgentCoreFormsParrot';
export { SlackAgentCoreFormsSsoAutofillParrot } from './SlackAgents/SlackAgentCoreFormsSsoAutofillParrot';

// Types
export type {
  TConversationTextMessage,
  TConversationTextMessageEnvelope,
} from './types';

// Services and Modules
export { RobotService } from './robot.service';
export { RobotModule } from './robot.module';
