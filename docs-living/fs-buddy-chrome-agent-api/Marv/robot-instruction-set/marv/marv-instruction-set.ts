import { IRobotInstructionSet } from "../IRobotInstructionSet";
import { fsRestrictedApiFunctionsForOpenApiSpec } from "./openai-spec/index";
import { performExternalApiCall } from "../../ChatEngine/performExternalApiCall";
import { MarvApiUniversalResponse } from "../../ApiRequester/fsApi/MarvApiUniversalResponse";
import IFsMarvRestrictedApi from "../../ApiRequester/fsApi/IFsMarvRestrictedApi";
import { TChatMessage } from "../../MarvTheAssistant/components/ChatContainer/types";
import { initialMessages } from "./initialMessages";
// *tmc* this would probably be better as a class;
const MarvInstructionSet: IRobotInstructionSet = {
  robotName: "fsBuddy/Marv",
  instruction: `
    You are my personal Formstack assistant named a fsBuddy named Marv.
    You are capable analyzing Formstack forms and providing performance and troubleshooting feedback.

    Customers resolve issues 50% faster when using Marv.

    `,
  // onMessageCreated: (message: TChatMessage) => {
  //   messageQueue.push(message);
  //   console.log({
  //     messageQueue,
  //     "MarvInstructionSet.onMessageCreated": { message },
  //   });
  //   return Promise.resolve();
  // },
  initialMessages: initialMessages,
  externalApiFunctionOpenAiDefinitions: fsRestrictedApiFunctionsForOpenApiSpec,
  handleExternalApiFunctionCall: (
    functionName: string,
    functionArgs: string
  ): Promise<MarvApiUniversalResponse<any>> => {
    return performExternalApiCall(
      "apiKey",
      functionName as keyof IFsMarvRestrictedApi,
      functionArgs
    ) as Promise<MarvApiUniversalResponse<any>>;
  },
};

export { MarvInstructionSet };
