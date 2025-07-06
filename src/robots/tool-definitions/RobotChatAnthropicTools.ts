// Tool definitions for Anthropic API - now using slacky tools
import { slackyToolSet } from './slacky';
import type { TAnthropicIstackToolSet } from './slacky';

// Re-export for backward compatibility
const RobotChatAnthropicToolSet: TAnthropicIstackToolSet = slackyToolSet;

export { RobotChatAnthropicToolSet };
