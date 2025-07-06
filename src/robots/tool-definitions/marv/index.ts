// TAnthropicIstackToolSet

import { TAnthropicIstackToolSet } from 'src/robots/types';
import { marvToolDefinitions } from './marvToolDefinitions';
import { performMarvToolCall } from './performMarvToolCall';

const marvToolSet: TAnthropicIstackToolSet = {
  toolDefinitions: marvToolDefinitions,
  executeToolCall: performMarvToolCall,
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
