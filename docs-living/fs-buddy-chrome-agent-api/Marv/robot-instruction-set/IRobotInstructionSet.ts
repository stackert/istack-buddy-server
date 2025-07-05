import OpenAI from 'openai';
import { MarvApiUniversalResponse } from '../ApiRequester/fsApi/MarvApiUniversalResponse';
import { TChatMessage } from '../MarvTheAssistant/components/ChatContainer/types';
interface IRobotInstructionSet {
  robotName: string;
  instruction: string;
  externalApiFunctionOpenAiDefinitions: OpenAI.Beta.Assistants.Assistant.Function[];
  initialMessages: TChatMessage[]; // (context building messages) These are not sent to chat until user's first message
  handleExternalApiFunctionCall: <T>(
    functionName: string,
    functionArgs: string
  ) => Promise<MarvApiUniversalResponse<T>>;
  onMessageCreated?: (message: TChatMessage) => Promise<void>; // this is all messages.

  // The purpose is to give the client code access for logging or recording conversations somewhat realtime
  // This will be all messages, including openai (assistant, user), and custom error possible others
}

export { IRobotInstructionSet };
