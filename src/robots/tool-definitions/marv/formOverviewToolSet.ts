import { TAnthropicIstackToolSet } from '../../types';
import { FsRestrictedApiRoutesEnum } from './types';
import { performMarvToolCall } from './performMarvToolCall';
import { marvToolDefinitions } from './marvToolDefinitions';

// Limited tool set containing only FormAndRelatedEntityOverview
const formOverviewToolSet: TAnthropicIstackToolSet = {
  toolDefinitions: marvToolDefinitions.filter(
    (tool) =>
      tool.name === FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
  ),
  executeToolCall: (toolName: string, toolArgs: any) => {
    // Only handle FormAndRelatedEntityOverview
    if (toolName === FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview) {
      return performMarvToolCall(toolName, toolArgs);
    }
    return undefined; // We don't handle this tool
  },
};

export { formOverviewToolSet };
