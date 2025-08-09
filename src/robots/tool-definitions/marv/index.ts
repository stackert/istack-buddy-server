// TAnthropicIstackToolSet

import { TAnthropicIstackToolSet } from '../../types';
import { marvToolDefinitions } from './marvToolDefinitions';
import { performMarvToolCall } from './performMarvToolCall';
import { transformMarvToolResponse } from './transformMarvToolResponse';

const marvToolSet: TAnthropicIstackToolSet = {
  toolDefinitions: marvToolDefinitions,
  executeToolCall: (toolName: string, toolArgs: any) => {
    // Check if this tool is in our definitions
    const toolExists = marvToolDefinitions.some(
      (tool) => tool.name === toolName,
    );
    if (!toolExists) {
      return undefined; // We don't handle this tool
    }
    return performMarvToolCall(toolName, toolArgs);
  },
  transformToolResponse: transformMarvToolResponse,
};

// Export types from types.ts
export type {
  IMarvApiUniversalResponse,
  TFsRestrictedApiFunctionNames,
  TFsFormJson,
  TFsFieldJson,
  IAddFsLiteFieldProps,
  TFsLiteFormAddResponse,
  IFormAndRelatedEntityOverview,
} from './types';

export { FsRestrictedApiRoutesEnum } from './types';
export { FsApiClient, fsApiClient } from './fsApiClient';

export { marvToolSet };
export { formOverviewToolSet } from './formOverviewToolSet';
export { marvToolDefinitions, performMarvToolCall };
