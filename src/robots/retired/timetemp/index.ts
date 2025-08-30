import { TAnthropicIstackToolSet } from '../../types';
import { timeTempToolDefinitions } from './timeTempToolDefinitions';
import { performTimeTempToolCall } from './performTimeTempToolCall';

const timeTempToolSet: TAnthropicIstackToolSet = {
  toolDefinitions: timeTempToolDefinitions,
  executeToolCall: (toolName: string, toolArgs: any) => {
    // Check if this tool is in our definitions
    const toolExists = timeTempToolDefinitions.some(
      (tool) => tool.name === toolName,
    );
    if (!toolExists) {
      return undefined; // We don't handle this tool
    }
    return performTimeTempToolCall(toolName, toolArgs);
  },
};

export { timeTempToolSet };
export { timeTempToolDefinitions, performTimeTempToolCall };
