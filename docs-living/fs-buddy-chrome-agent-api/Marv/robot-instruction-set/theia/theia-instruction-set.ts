import { IRobotInstructionSet } from "../IRobotInstructionSet";
import { fsRestrictedApiFunctionsForOpenApiSpec } from "./openai-spec/index";
import { performExternalApiCall } from "../../ChatEngine/performExternalApiCall";
import { MarvApiUniversalResponse } from "../../ApiRequester/fsApi/MarvApiUniversalResponse";
import IFsMarvRestrictedApi from "../../ApiRequester/fsApi/IFsMarvRestrictedApi";
import { TChatMessage } from "../../MarvTheAssistant/components/ChatContainer/types";
import { initialMessages } from "./initialMessages";

const messageQueue: TChatMessage[] = []; // *tmc* this doesn't belong here. Need to think about this object becoming a class
// *tmc* this would probably be better as a class;
const TheiaInstructionSet: IRobotInstructionSet = {
  robotName: "fsBuddy/Theai",
  instruction: `
        You are a supervisor robot.  You will assist the supervisor to monitor and manage conversations
        between other robots and customers. 

        You can rate a conversation between a robot and a customer assigning a numeric score between [-5, 5].
        -5 would suggest that the conversation went poorly, the customer issues was not resolved and the customer
        is frustrated.

        5 would suggest that the conversation went well, the customer issue was resolved and the customer seems happy.

        O will suggest that the conversation was neutral, neither good nor bad, customer's issue was not resolved but 
        they were provided a path to likely resolution.

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

export { TheiaInstructionSet };
