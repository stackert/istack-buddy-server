import { AbstractRobotChat } from './AbstractRobotChat';
import { TMessageEnvelope, TRobotMessage } from './types';
import { OpenAI } from 'openai';
const OPEN_AI_API_KEY =
  ' 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';
// OpenAI.Responses.Tool[]
type OpenAiTool = OpenAI.Responses.Tool;
const tools: OpenAiTool[] = [
  {
    type: 'function',
    name: 'get_weather',
    strict: true, // false -> best effort, true -> adhere to the schema.
    // I assume it will abort if not able to determine function/parameters to high degree of certainty.
    description: 'Get current temperature for a given location.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City and country e.g. Bogotá, Colombia',
        },
      },
      required: ['location'],
      additionalProperties: false,
    },
  },
];

type TOpenAIFunctionCallRequest = {
  id: string; // "fc_6856bd53d0288191b5dde94d741e04f503d0b60e2bffb674",
  type: 'function_call'; // could be others  "function_call",
  status: 'completed'; // seems odd but that is how it returns from openAi
  arguments: string; // "{\"location\":\"Paris, France\"}",
  call_id: string; // "call_UQIk1KA44wK7rtourKjyvxuG",
  name: string; // "get_weather",
};

class RobotChatOpenAI extends AbstractRobotChat {
  public readonly version: string = '1.0.0-test-dev';

  public readonly LLModelName: string = 'o4-mini';
  public readonly LLModelVersion: string = 'o4-mini-2025-04-16';

  public readonly contextWindowSizeInTokens: number = 128000; // GPT-4 context window

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  get name(): string {
    return this.constructor.name;
  }

  public async acceptMessageStreamResponse(
    messageEnvelope: TMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async acceptMessageImmediateResponse(
    inboundMessage: TMessageEnvelope,
  ): Promise<TMessageEnvelope> {
    return Promise.resolve(inboundMessage);
  }

  public async acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    // Placeholder implementation for OpenAI chat robot
    const immediateResponse =
      await this.acceptMessageImmediateResponse(messageEnvelope);

    // Send delayed response after processing
    setTimeout(() => {
      const delayedRespMessage: TRobotMessage = {
        ...messageEnvelope.envelopePayload,
        content: {
          type: 'text/plain',
          payload: `OpenAI processing complete for: ${messageEnvelope.envelopePayload.content.payload}`,
        },
        author_role: 'assistant',
        created_at: new Date().toISOString(),
      };

      const delayedMessage: TMessageEnvelope = {
        messageId: `response-${Date.now()}-delayed`,
        envelopePayload: delayedRespMessage,
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        delayedMessageCallback(delayedMessage);
      }
    }, 1000);

    return immediateResponse;
  }

  public async sendTestMessageToRobot(
    inboundMessage: TMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<TMessageEnvelope> {
    const openAiClient = this.getClient();
    const responseToCallTools = await openAiClient.responses.create({
      model: 'gpt-4.1',
      input: [
        { role: 'user', content: 'What is the weather like in Paris today?' },
      ],
      tools,
    });

    const functionCallResponses = [];
    responseToCallTools.output.forEach(
      (toolCall: TOpenAIFunctionCallRequest) => {
        const {
          type: responseType,
          name: functionName,
          arguments: functionArgs,
          call_id,
        } = toolCall;

        console.log({ responseType, functionName, functionArgs });
        const toolResult = this.makeToolCall(functionName, functionArgs);
        functionCallResponses.push(toolCall);
        functionCallResponses.push({
          //   ...toolCall,
          output: toolResult,
          call_id: toolCall.call_id,
          //   id: toolCall.id,
          //   name: toolCall.name,
          //   status: toolCall.status,
          //   arguments: toolCall.arguments,
          type: 'function_call_output',
        });
      },
    );

    const response2 = await openAiClient.responses.create({
      model: 'gpt-4.1',
      input: functionCallResponses,
      tools,
      store: true,
    });

    console.log({ response2 });
    // if (toolCall) {
    //   const toolName = toolCall.function.name;
    //   const toolArgs = JSON.parse(toolCall.function.arguments);
    //   const toolResult = this.makeToolCall(toolName, toolArgs);
    //   console.log('toolResult', toolResult);
    // }

    return Promise.resolve(inboundMessage);
  }

  private robot_getWeather(toolArgs: any): string {
    const theWeather = `
        Warm with light breeze somewhere I am sure.
        
        But I have no idea about your location '${toolArgs?.location}'.

        toolArgs: '${JSON.stringify(toolArgs)}'

    
    `;
    return theWeather;
  }
  private makeToolCall(toolName: string, toolArgs: any) {
    switch (toolName) {
      case 'get_weather':
      case 'getWeather':
        return this.robot_getWeather(toolArgs);
      default:
        return `Failed to recognize the tool call: '${toolName}'.`;
    }
  }

  private getClient(): OpenAI {
    return new OpenAI({
      apiKey: OPEN_AI_API_KEY,
    });
  }
}

export { RobotChatOpenAI };
