import openai, { OpenAI } from 'openai';
import { store } from '../state';
import { ThreadMessage } from 'openai/resources/beta/threads/messages/messages';
import { MarvApiError } from '../ApiRequester/MarvApiError';
import { IMarvApiUniversalResponse } from '../ApiRequester/fsApi/MarvApiUniversalResponse';
import { IOpenAiConfig } from './type';
import { IRobotInstructionSet } from '../robot-instruction-set/IRobotInstructionSet';
import { addListener } from '@reduxjs/toolkit';
import { chatSlice } from '../state/EntityAdapter';
import { messageActions } from '../state/EntityAdapter';
import { TChatMessage } from '../type';
import { APIPromise } from 'openai/core';
import { fsRestrictedApiFormLiteAdd } from '../robot-instruction-set/marv/openai-spec/fsRestrictedApiFormLiteAdd';
interface MarvOpenAiConfig {
  modelName: string;
  apiKey: string;
  openAiConfig: IOpenAiConfig;
  robotConfig: IRobotInstructionSet;
}

interface IOpenAiMessage {
  content: string;
  role: 'user';
}

class ChatEngine {
  #isReady: boolean = false;
  #assistant!: openai.Beta.Assistant;
  static #instance: ChatEngine;
  // @ts-ignore missing properties
  #openAiParams: MarvOpenAiConfig = { apiKey: '', modelName: '' };

  #openai!: OpenAI;
  #thread!: openai.Beta.Thread;
  #currentRun: openai.Beta.Threads.Run | undefined;
  #robotConfig: IRobotInstructionSet;

  private constructor(config: MarvOpenAiConfig) {
    this.#openAiParams.apiKey = config.apiKey;
    this.#openAiParams.modelName = config.modelName;
    this.#openAiParams.openAiConfig = config.openAiConfig;
    this.#openAiParams.robotConfig = config.robotConfig;
    this.#robotConfig = config.robotConfig;
    return this;
  }

  private openai() {
    return this.#openai;
  }

  private get assistantName(): string {
    return this.#robotConfig.robotName;
    // return "fsBuddy/Marv";
  }

  public get assistantId(): string {
    return this.#assistant.id;
  }

  private get assistantInstructions(): string {
    return this.#robotConfig.instruction;
  }

  /**
   *
   * @param MAX_RETRIES - MUST be between 3 and 20
   * @returns
   */
  public waitUntilInitialized(MAX_RETRIES = 10): Promise<ChatEngine> {
    const self = this;
    if (MAX_RETRIES < 3 || MAX_RETRIES > 20) {
      MAX_RETRIES = 5;
    }

    return new Promise((resolve, reject) => {
      let retryCount = 0;
      setInterval(() => {
        retryCount++;
        if (self.isReady) {
          resolve(self);
        } else if (retryCount > MAX_RETRIES) {
          reject(
            `Marv not ready after maximum retry count exceeded. MAX_RETRY_COUNT: ${MAX_RETRIES}.`
          );
        }
      }, 200);
    });
  }

  public get isReady(): boolean {
    return this.#isReady;
  }

  private async initialize() {
    //
    console.log({
      openai: this.#openai,
      assistant: this.#assistant,
      openAiParams: this.#openAiParams,
    });

    if (this.#openai !== undefined) {
      return;
    }

    try {
      this.#openai = new OpenAI({
        apiKey: this.#openAiParams.apiKey,
        dangerouslyAllowBrowser: true, // so it can run in the browser
      });
    } catch (e) {
      // *tmc* need to handle this error in a user friendly manor
      console.log({
        'ChatEngine.initialize.newOpenAI': {
          message: 'Error initializing openai',
          error: e,
        },
      });
      store.dispatch(
        messageActions.messageAdded(
          createErrorMessage(
            'Failed to create Assistant. OpenAI Disabled. (Is the API key correct?)'
          )
        )
      );
      console.log({ error: e }); // maybe 'e' will cause issues circular reference, trying to json stringify it ??
      return;
    }

    const marvToolChain = [
      { type: 'code_interpreter' },
      ...this.#robotConfig.externalApiFunctionOpenAiDefinitions,
    ] as ( // @ts-ignore - not sure where these types come fom
      | AssistantToolsCode
      // @ts-ignore - not sure where these types come fom
      | AssistantToolsRetrieval
      // @ts-ignore - not sure where these types come fom
      | AssistantToolsFunction
    )[];

    try {
      this.#assistant = await this.openai().beta.assistants.create({
        name: this.assistantName,
        instructions: this.assistantInstructions,
        /// should these be tied to the enum from openapi-spec ?  Tightly coupled??
        tools: marvToolChain,
        // tools: [
        //   { type: 'code_interpreter' },
        //   {
        //     type: 'function',
        //     function: fsRestrictedApiFormLiteAdd,
        //     // ...this.#robotConfig.externalApiFunctionOpenAiDefinitions,
        //   },
        // ],
        model: 'gpt-3.5-turbo',
        // model: this.#openAiParams.modelName,
      });
    } catch (e) {
      store.dispatch(
        messageActions.messageAdded(
          createErrorMessage(
            'Failed to create Assistant. OpenAI Disabled. (Is the API key correct?)'
          )
        )
      );
      // *tmc* need to handle this error in a user friendly manor
      console.log({
        'ChatEngine.initialize.assistants.create': {
          message: 'Error initializing openai',
          error: e,
        },
      });
      return;
      // throw e;
    }

    // can use file_ids to include relevant pre-conversation messages.
    // Messages can be text, image, or files
    // this.#thread = await this.#openai.beta.threads.create();
    this.#thread = await this.openai().beta.threads.create();

    // *tmc* maybe put a guard that this is callable?
    if (this.#robotConfig.handleExternalApiFunctionCall !== undefined) {
      store.dispatch(
        addListener({
          actionCreator: chatSlice.actions.messageAdded,
          effect: async (action, listenerApi) => {
            this.#robotConfig.onMessageCreated &&
              (await this.#robotConfig.onMessageCreated(action.payload));

            console.log({ addListener: { action, listenerApi } });
          },
        })
      );
    }
    this.#isReady = true;
    return this;
  }

  async fetchMarvFile(fileId: string): Promise<string> {
    const response = await this.openai().files.content(fileId);

    // Extract the binary data from the Response object
    const image_data = await response.arrayBuffer();

    // This step is only necessary if you don't already have a Buffer Object
    const buffer = Buffer.from(image_data);

    const imageB64 = buffer.toString('base64');
    return imageB64;
  }

  async pushMessage(message: IOpenAiMessage): Promise<ThreadMessage> {
    const effectiveMessage: IOpenAiMessage = {
      ...{ role: 'user', content: '' },
      ...message,
    };
    if (this.#thread === undefined) {
      this.#thread = await this.openai().beta.threads.create();
    }
    return await this.openai().beta.threads.messages.create(this.#thread.id, {
      role: effectiveMessage.role,
      content: effectiveMessage.content,
    });
  }

  async startThreadRun(
    threadId: string,
    assistantId: string
  ): Promise<openai.Beta.Threads.Runs.Run> {
    return await this.openai().beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });
  }

  async startRun() {
    this.#currentRun = await this.openai().beta.threads.runs.create(
      this.#thread.id,
      {
        // can switch robots at this point
        // options in the create assistant call, can be overridden here.
        assistant_id: this.#assistant.id,
      }
    );
  }

  async getAllThreadMessages(): Promise<
    OpenAI.Beta.Threads.Messages.ThreadMessage[]
  > {
    const messages = await this.openai().beta.threads.messages.list(
      this.#thread.id
    );
    return messages.data;
  }

  async getLastMessage(
    threadId: string,
    runId: string
  ): Promise<OpenAI.Beta.Threads.Messages.ThreadMessage> {
    return new Promise(async (resolve, reject) => {
      // Get the last assistant message from the messages array
      const messages = await this.openai().beta.threads.messages.list(threadId);

      // Find the last message for the current run
      const lastMessageForRun = messages.data
        .filter(
          (message) =>
            // @ts-ignore -  this.#currentRun may be undefined
            message.run_id === runId && message.role === 'assistant'
        )
        .pop();

      if (lastMessageForRun) {
        console.log({ lastMessageForRun });
        resolve(lastMessageForRun);
      }
    });
  }

  /**
   * @deprecated - use getLastMessage instead
   * @returns
   */
  async getLastAssistantMessage(): Promise<OpenAI.Beta.Threads.Messages.ThreadMessage> {
    return new Promise(async (resolve, reject) => {
      if (this.#currentRun === undefined) {
        throw new Error('No current run');
      }

      // Get the last assistant message from the messages array
      const messages = await this.openai().beta.threads.messages.list(
        this.#thread.id
      );

      // Find the last message for the current run
      const lastMessageForRun = messages.data
        .filter(
          (message) =>
            // @ts-ignore -  this.#currentRun may be undefined
            message.run_id === this.#currentRun.id &&
            message.role === 'assistant'
        )
        .pop();

      if (lastMessageForRun) {
        console.log({ lastMessageForRun });
        resolve(lastMessageForRun);
      }
    });
  }

  /**
   * This is a "helper" function that will monitor the run until it is completed.
   * It is recommend to use `retrieveActualRun` instead and write your own polling logic.
   */
  async monitorCompletedRun(
    onPollingHeartBeat?: (pollCount: number, statusMessage?: string) => void,
    onErrorNotifyUi?: (error: IMarvApiUniversalResponse<any>) => void,
    newErrorHandler?: (error: MarvApiError) => void
  ): Promise<openai.Beta.Threads.Messages.ThreadMessage> {
    return new Promise(async (resolve, reject) => {
      let pollCount = 0;
      if (!this.#currentRun) {
        throw new Error('No current run');
      }
      let actualRun = await this.retrieveActualRun();

      while (
        actualRun.status === 'queued' ||
        actualRun.status === 'in_progress' ||
        actualRun.status === 'requires_action'
      ) {
        onPollingHeartBeat && onPollingHeartBeat(pollCount, actualRun.status);
        if (actualRun.status === 'requires_action') {
          console.log({
            required_action: actualRun,
          });
          // extra single tool call
          const toolCall =
            actualRun.required_action?.submit_tool_outputs?.tool_calls[0];

          const functionName = toolCall?.function.name;
          const functionArgs = toolCall?.function.arguments;

          let response: IMarvApiUniversalResponse<any>;
          try {
            if (this.#robotConfig.handleExternalApiFunctionCall === undefined) {
              throw new Error('No function to handle external api call');
            }
            response = await this.#robotConfig.handleExternalApiFunctionCall(
              functionName || '_NO_FUNCTION_NAME_PROVIDED_',
              functionArgs || '_NO_FUNCTION_ARGS_PROVIDED_' // I am not sure about this, should args be optional?
            );
          } catch (e: any) {
            // this will need to be replaced with ResponseUniversal
            // This error will be piped into the assistant which gives a nice uninformative user message
            // want create a message for the user that has more details "cors" "authentication" etc error
            response = {
              isSuccess: false,
              response: null,
              errorItems: [
                `ChatEngine failed to call external api. function name: '${functionName}'.`,
                { message: e.message, stack: 'stack' in e ? e.stack : null },
              ],
            } as IMarvApiUniversalResponse<any>;

            console.log({ e });
          }

          // I think the run will need to be cancelled here
          if (!response || response.isSuccess === false) {
            response.errorItems = (response.errorItems || []).map((item) => {
              if (item instanceof Error) {
                return {
                  Error: { message: item.message, stack: item.stack },
                };
              }
              return item;
            });
            helpers.pushErrorMessage(response, 'Function call failed.');

            response.errorItems?.push({
              error: `FS Api Function call failed. functionName: '${functionName}'.`,
              functionName,
            });
            onErrorNotifyUi && onErrorNotifyUi(response);

            // choosing *not* to cancel at this time. The returned user facing error message is good UX
            await this.openai().beta.threads.runs.submitToolOutputs(
              this.#thread.id,
              actualRun.id,
              {
                tool_outputs: [
                  {
                    tool_call_id: toolCall?.id,
                    output: JSON.stringify(response),
                  },
                ],
              }
            );
            actualRun = await this.retrieveActualRun();
          } else {
            await this.openai().beta.threads.runs.submitToolOutputs(
              this.#thread.id,
              actualRun.id,
              {
                tool_outputs: [
                  {
                    tool_call_id: toolCall?.id,
                    output: JSON.stringify(response),
                  },
                ],
              }
            );

            actualRun = await this.retrieveActualRun();
          }
        }
        // keep polling until the run is completed
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            if (onPollingHeartBeat) {
              onPollingHeartBeat(pollCount++);
            }
            console.log('polling');
            resolve();
          }, 2000)
        );
        actualRun = await this.retrieveActualRun();
        console.log({ actualRunStatus: actualRun.status, actualRun });
      }
      // at this point the conversation response has been received (errored or completed)
      // run 'steps' should also be available now, this maybe interesting for dev.
      const lastMessageForRun = await this.getLastAssistantMessage();

      resolve(lastMessageForRun);
    });
  }

  public async getRun(runId: string, threadId: string) {
    return await this.openai().beta.threads.runs.retrieve(threadId, runId);
  }

  public async retrieveActualRun() {
    if (!this.#currentRun) {
      throw new Error('No current run');
    }
    try {
      return await this.openai().beta.threads.runs.retrieve(
        this.#thread.id,
        this.#currentRun.id
      );
    } catch (e) {
      console.log({ retrieveActualRun: { error: e } });
      throw e;
    }
  }

  static async resetInstance() {
    // const newInstance = new ChatEngine({
    //   apiKey: ChatEngine.#instance.#openAiParams.apiKey,
    //   modelName: ChatEngine.#instance.#openAiParams.modelName,
    //   openAiConfig: ChatEngine.#instance.#openAiParams.openAiConfig,
    //   robotConfig: ChatEngine.#instance.#robotConfig,
    // });
    // ChatEngine.#instance = newInstance;
    // ChatEngine.#instance.initialize();
  }

  static async getInstance(
    openAiConfig: IOpenAiConfig,
    robotConfig: IRobotInstructionSet
  ): Promise<ChatEngine> {
    if (!ChatEngine.#instance) {
      ChatEngine.#instance = new ChatEngine({
        apiKey: openAiConfig.apiKey,
        modelName: openAiConfig.modelName,
        openAiConfig: openAiConfig,
        robotConfig: robotConfig,
      });

      // intentionally not awaiting the initialize, so that the instance can be returned immediately
      // its possible that the instance will be returned before the initialize is complete
      // this is fine, because the initialize is idempotent.
      // This may lead to *problems* if the instance is used before the initialize is complete.
      // This is a proof of concept and no further work will be done on this project
      ChatEngine.#instance.initialize();
    }
    return ChatEngine.#instance;
  }
}

const helpers = {
  isSuccessfulResponse: (apiResponse: IMarvApiUniversalResponse<any>) =>
    apiResponse.isSuccess && apiResponse.response !== null,

  pushErrorMessage: (
    apiResponse: IMarvApiUniversalResponse<any>,
    message: string
  ) => {
    if (apiResponse.errorItems === null) {
      apiResponse.errorItems = [];
    }
    apiResponse.errorItems.push(message);
  },
};

export { ChatEngine };

const createErrorMessage = (errorText: string): TChatMessage => {
  return {
    contentText:
      errorText ||
      'Failed to create Assistant. OpenAI Disabled. (Is the API key correct?)',
    messageId: Date.now().toString(),
    // @ts-ignore - types has been extended to include role: 'error'
    role: 'error',
    created_at: Date.now(),
  };
};
