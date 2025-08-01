import { AbstractRobotChat } from './AbstractRobotChat';
import {
  TConversationTextMessageEnvelope,
  TConversationTextMessage,
} from './types';
import { OpenAI } from 'openai';
import { CustomLoggerService } from '../common/logger/custom-logger.service';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { marvToolSet } from './tool-definitions/marv';

// Type for tracking function calls during streaming
type StreamingFunctionCall = {
  index: number;
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
} | null;

const noOp = (...args: any[]) => {};
const log = (...args: any[]) => {
  console.log(...args);
};

const fakeLogger = {
  debug: noOp,
  log: noOp,
  error: noOp,
  warn: noOp,
  verbose: noOp,
};

// OpenAI API key will be read from environment at runtime
// Convert Marv tools to OpenAI format
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
  marvToolSet.toolDefinitions.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));

class RobotChatOpenAI extends AbstractRobotChat {
  // logger = new CustomLoggerService('RobotChatOpenAI');
  logger = fakeLogger;

  constructor() {
    super();
  }

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
    messageEnvelope: TConversationTextMessageEnvelope,
    chunkCallback: (chunk: string) => void,
    getHistory?: () => IConversationMessage[],
  ): Promise<void> {
    const openAiClient = this.getClient();
    const userMessage = messageEnvelope.envelopePayload.content.payload;

    try {
      // Build conversation history if provided
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'You are a helpful assistant with access to tools. When asked about forms, use the available tools to get information. Always use tools when they would be helpful.',
        },
      ];

      if (getHistory) {
        const history = getHistory();
        this.logger.debug('Building conversation history', {
          historyLength: history.length,
        });

        // Convert history to OpenAI format
        for (const msg of history) {
          if (msg.fromRole === UserRole.CUSTOMER) {
            messages.push({ role: 'user', content: msg.content });
          } else if (msg.fromRole === UserRole.ROBOT) {
            messages.push({ role: 'assistant', content: msg.content });
          }
        }
      }

      // Add current message
      messages.push({ role: 'user', content: userMessage });

      const stream = await openAiClient.chat.completions.create({
        model: this.LLModelName,
        messages,
        tools,
        stream: true,
      });

      let isInFunctionCall = false;
      let currentFunctionCall: StreamingFunctionCall | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle function calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            // Initialize function call
            if (
              !currentFunctionCall ||
              currentFunctionCall.index !== toolCall.index
            ) {
              currentFunctionCall = {
                index: toolCall.index,
                id: toolCall.id || '',
                type: toolCall.type || 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
              isInFunctionCall = true;
            }

            // Accumulate function call data
            if (currentFunctionCall && toolCall.function?.name) {
              currentFunctionCall.function.name = toolCall.function.name;
            }
            if (currentFunctionCall && toolCall.function?.arguments) {
              currentFunctionCall.function.arguments +=
                toolCall.function.arguments;
            }
          }
        }

        // Handle content (text)
        const content = delta?.content;
        if (content) {
          chunkCallback(content);
        }

        // Handle function call completion
        if (
          chunk.choices[0]?.finish_reason === 'tool_calls' &&
          currentFunctionCall
        ) {
          try {
            // Execute the function call
            const functionName = currentFunctionCall.function.name;
            const functionArgs = JSON.parse(
              currentFunctionCall.function.arguments,
            );

            this.logger.debug('Executing function call', {
              functionName,
              functionArgs,
            });

            const toolResult = await this.makeToolCall(
              functionName,
              functionArgs,
            );

            // Stream the function result in chunks
            const functionResult = `\n[Function call: ${functionName}] Result: ${toolResult}\n`;
            const chunkSize = 50; // Break into smaller chunks
            for (let i = 0; i < functionResult.length; i += chunkSize) {
              const chunk = functionResult.slice(i, i + chunkSize);
              chunkCallback(chunk);
              // Small delay to simulate streaming
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          } catch (error) {
            this.logger.error('Error executing function call', {
              error,
              currentFunctionCall,
            });
            chunkCallback(
              `\n[Error executing function call: ${error.message}]\n`,
            );
          }

          // Reset for next function call
          currentFunctionCall = null;
          isInFunctionCall = false;
        }
      }
    } catch (error) {
      this.logger.error('Error in streaming response', { error });
      chunkCallback(`Error: ${error.message}`);
    }
  }

  public async acceptMessageImmediateResponse(
    inboundMessage: TConversationTextMessageEnvelope,
  ): Promise<TConversationTextMessageEnvelope> {
    return Promise.resolve(inboundMessage);
  }

  public async acceptMessageMultiPartResponse(
    messageEnvelope: TConversationTextMessageEnvelope,
    delayedMessageCallback: (
      response: TConversationTextMessageEnvelope,
    ) => void,
  ): Promise<TConversationTextMessageEnvelope> {
    // Placeholder implementation for OpenAI chat robot
    const immediateResponse =
      await this.acceptMessageImmediateResponse(messageEnvelope);

    // Send delayed response after processing
    setTimeout(() => {
      const delayedRespMessage: TConversationTextMessage = {
        ...messageEnvelope.envelopePayload,
        content: {
          type: 'text/plain',
          payload: `OpenAI processing complete for: ${messageEnvelope.envelopePayload.content.payload}`,
        },
        author_role: 'assistant',
        created_at: new Date().toISOString(),
      };

      const delayedMessage: TConversationTextMessageEnvelope = {
        messageId: `response-${Date.now()}-delayed`,
        requestOrResponse: 'response',
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

  private async makeToolCall(toolName: string, toolArgs: any): Promise<string> {
    this.logger.debug(`Executing tool: ${toolName}`, { toolArgs });
    try {
      const result = marvToolSet.executeToolCall(toolName, toolArgs);
      const finalResult = typeof result === 'string' ? result : await result;
      this.logger.debug(`Tool ${toolName} executed successfully`, {
        resultType: typeof finalResult,
      });
      const jsonResult = JSON.stringify(finalResult, null, 2);
      this.logger.debug(`Complete tool result`, { result: jsonResult });
      return jsonResult;
    } catch (error) {
      this.logger.error(`Tool ${toolName} execution failed`, error);
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === '_OPEN_AI_KEY_') {
      throw new Error(
        `OPENAI_API_KEY environment variable is required but not set. Please set the OPENAI_API_KEY environment variable with your OpenAI API key.`,
      );
    }

    return new OpenAI({
      apiKey: apiKey,
    });
  }
}

export { RobotChatOpenAI };
