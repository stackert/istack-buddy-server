import IFsMarvRestrictedApi from '../ApiRequester/fsApi/IFsMarvRestrictedApi';
import { MarvApiUniversalResponse } from '../ApiRequester/fsApi/MarvApiUniversalResponse';
import { ChatEngine } from '../ChatEngine';
import { performExternalApiCall } from '../ChatEngine/performExternalApiCall';
import { RobotInstructionSet } from '../robot-instruction-set';
import type { IRobotInstructionSet } from '../robot-instruction-set/IRobotInstructionSet';
import { TChatMessage } from '../MarvTheAssistant/components/ChatContainer/types';
import { IOpenAiConfig } from '../ChatEngine/type';

const messageQueue: TChatMessage[] = [];
const onMessageCreated = (message: TChatMessage): Promise<void> => {
  // at this time, onMessageCreated is called multiple times for the same message.
  // That likely a side-effect of using state/react components.
  messageQueue.findIndex((m) => m.messageId === message.messageId) === -1 &&
    messageQueue.push(message);

  console.log({ messageQueue });
  return Promise.resolve();
};
// IOpenAiConfig

const getRobotInstanceFactory = (
  overrides: Partial<
    IRobotInstructionSet & IOpenAiConfig & { fsApiKey?: string }
  >
) => {
  return async () => {
    try {
      const credentials = {
        apiKey: overrides.apiKey || '_MISSING_OAI_KEY_',
        modelName: 'gpt-4-1106-preview',
      };
      const robotConfig = {
        robotName: RobotInstructionSet.robotName, // "fsBuddy/Marv",
        instruction: RobotInstructionSet.instruction,
        externalApiFunctionOpenAiDefinitions:
          RobotInstructionSet.externalApiFunctionOpenAiDefinitions,
        onMessageCreated: overrides.onMessageCreated || onMessageCreated,
        initialMessages: overrides.initialMessages || [],
        handleExternalApiFunctionCall: (
          functionName: string,
          functionArgs: string
        ): Promise<MarvApiUniversalResponse<any>> => {
          if (!overrides.fsApiKey) {
            return Promise.resolve(
              new MarvApiUniversalResponse('error', null, {
                error: 'fsApiKey not provided',
              }) as MarvApiUniversalResponse<any>
            );
          }
          return performExternalApiCall(
            overrides.fsApiKey,
            // 'cc17435f8800943cc1abd3063a8fe44f',
            functionName as keyof IFsMarvRestrictedApi,
            functionArgs
          ) as Promise<MarvApiUniversalResponse<any>>;
        },
      } as IRobotInstructionSet;
      const chatEngine = await ChatEngine.getInstance(credentials, robotConfig);
      return chatEngine;
    } catch (e) {
      // *tmc* - need to handle this error,  Create a message to the user - "API Broke, bad network, bad credentials, etc."
      console.log({
        getRobotInstance: { message: 'failed to initialize robot', error: e },
      });
      throw e;
    }
  };
};

const colorScheme = {
  // const userRoleColor = "#daeaf7";
  // const nonuserRoleColor = "#e7c8e7";

  messageContainer: {
    user: '#daeaf7',
    // assistant: "green",
    assistant: '#e7c8e7',
    error: '#ffc5c5', // salmon/pink/red
    other: 'white',
    guest: 'white', // maybe one day we'll multiple guest chat sessions
  },
};

export { getRobotInstanceFactory, colorScheme };
