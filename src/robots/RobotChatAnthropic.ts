import { AbstractRobotChat } from './AbstractRobotChat';
import { TMessageEnvelope, TRobotMessage } from './types';
import Anthropic from '@anthropic-ai/sdk';

type TClaudeMessageEnvelope = Anthropic.Messages.MessageStreamParams;

class RobotChatAnthropic extends AbstractRobotChat {
  //  public readonly name: string = AbstractRobotChat.name;
  public readonly version: string = '1.0.0-test-dev';

  public readonly LLModelName: string = 'anthropic.claude-3-5-sonnet-20240620';
  public readonly LLModelVersion: string = '20240620';

  public readonly robotRole = `
      You are an iStackBuddy robot specializing in Intellistack Forms Core troubleshooting.
      
      "Forms Core" is Intellistack's legacy forms product (formally as "Formstack").

      A non-exhaustive list of things we can help with:
       - SSO troubleshooting (for Forms Password Protected / SSO Protected, not account access SSO)
       - Form troubleshooting (logic not working as expected, form rendering issues, etc)
         Form configuration issues:
         -- Field/Section configuration
         -- Visibility Logic
         -- Calculation
       - Form Integration (submitActions) issues 
       - Through our collaborative efforts with other iStackBuddy robots we are able to:
         -- Trace submission from creation to Integration Runs (SubmitAction runs)
         -- Trace email send logs
         -- Submission error logs


      It's expected this list will grow over time.   
  
  `;

  public async acceptMessageStreamResponse(
    messageEnvelope: TMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<void> {
    return Promise.resolve();
  }

  get name(): string {
    return this.constructor.name;
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

  public async getWeatherWithTool(
    inboundMessage: TMessageEnvelope,
  ): Promise<TMessageEnvelope> {
    const client = this.getClient();

    const claudeEnvelope = this.createClaudeMessageEnvelope(inboundMessage);
    const responseMessage: TRobotMessage = {
      role: 'assistant',
      content: '',
      content_type: 'text',
      created_at: new Date().toISOString(),
    };

    const responseEnvelope = this.makeResponseEnvelope(inboundMessage);
    responseEnvelope.payload.messages.push(responseMessage);

    claudeEnvelope.tools = [
      {
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description:
                'The unit of temperature, either "celsius" or "fahrenheit"',
            },
          },
          required: ['location'],
        },
      },
    ];

    const response = (await client.messages.create(
      claudeEnvelope,
    )) as Anthropic.Messages.Message;

    const filteredResponse = response.content.filter(
      (item) => item.type === 'tool_use',
    );

    const toolUse = filteredResponse[0];

    const toolCall = this.makeToolCall(toolUse.name, toolUse.input);

    // ---
    console.log({ response: JSON.stringify(response.content[0], null, 2) });
    responseMessage.content = toolCall;
    //Anthropic.Messages.Message
    return Promise.resolve(responseEnvelope);
  }

  public async acceptMessageImmediateResponse(
    inboundMessage: TMessageEnvelope,
  ): Promise<TMessageEnvelope> {
    const client = this.getClient();

    const claudeEnvelope = this.createClaudeMessageEnvelope(inboundMessage);
    const responseMessage: TRobotMessage = {
      role: 'assistant',
      content: '',
      content_type: 'text',
      created_at: new Date().toISOString(),
    };

    const responseEnvelope = this.makeResponseEnvelope(inboundMessage);
    responseEnvelope.payload.messages.push(responseMessage);

    const response = (await client.messages.create(
      claudeEnvelope,
    )) as Anthropic.Messages.Message;

    // ---
    console.log({ response: JSON.stringify(response.content[0], null, 2) });
    responseMessage.content = (response.content[0] as any).text;
    //Anthropic.Messages.Message
    return Promise.resolve(responseEnvelope);
  }

  private createClaudeMessageEnvelope(
    inboundMessage: TMessageEnvelope,
  ): TClaudeMessageEnvelope {
    const mostRecentMessage = inboundMessage.payload.messages.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      // I don't think the date conversion is necessary - but whatever
    )[0];
    const claudeEnvelope: TClaudeMessageEnvelope = {
      // system: this.robotRole,
      messages: [
        {
          role: 'user',
          content: mostRecentMessage.content,
        },
      ],
      // model: 'claude-opus-4-20250514',
      model: 'claude-4-sonnet-20250514',
      max_tokens: 1024,
      system: this.robotRole,
    };

    return claudeEnvelope;
  }

  private getClient(): Anthropic {
    return new Anthropic({
      apiKey:
        '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',
    });
  }

  private makeResponseEnvelope(
    inboundMessage: TMessageEnvelope,
  ): TMessageEnvelope {
    const clonedInboundMessage: TMessageEnvelope =
      structuredClone(inboundMessage); // not sure if 'structuredClone' is necessary

    const responseEnvelope: TMessageEnvelope = {
      ...clonedInboundMessage,
      messageType: 'response',
    };

    return responseEnvelope;
  }

  public async sendTestMessageToRobot(
    inboundMessage: TMessageEnvelope,
    chunkCallback: (chunk: string) => void,
  ): Promise<TMessageEnvelope> {
    const client = this.getClient();

    const claudeEnvelope = this.createClaudeMessageEnvelope(inboundMessage);
    const responseMessage: TRobotMessage = {
      role: 'assistant',
      content: '',
      content_type: 'text',
      created_at: new Date().toISOString(),
    };

    const responseEnvelope = this.makeResponseEnvelope(inboundMessage);
    responseEnvelope.payload.messages.push(responseMessage);

    await client.messages.stream(claudeEnvelope).on('text', (text: string) => {
      responseMessage.content += text;
      chunkCallback(text);
    });
    return Promise.resolve(responseEnvelope);
  }
}

export { RobotChatAnthropic };
