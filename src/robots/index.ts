// Abstract base classes
export { AbstractRobot } from './AbstractRobot';
export { AbstractRobotChat } from './AbstractRobotChat';
export { AbstractRobotAgent } from './AbstractRobotAgent';

// Concrete robot implementations
export { AgentRobotParrot } from './AgentRobotParrot';
export { AnthropicMarv } from './AnthropicMarv';
export { SlackyOpenAiAgent } from './SlackyOpenAiAgent';

// Types
export type { TConversationTextMessage } from './types';

// Services and Modules
export { RobotService } from './robot.service';
export { RobotModule } from './robot.module';
