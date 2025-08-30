import Anthropic from '@anthropic-ai/sdk';

// Anthropic tool definitions for time and temperature functions
const timeTempToolDefinitions: Anthropic.Messages.Tool[] = [
  {
    name: 'getTime',
    description: `Get the current time for a specified city. Returns a random but realistic time for demonstration purposes.`,
    input_schema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city to get the time for',
        },
      },
      required: ['city'],
    },
  },

  {
    name: 'getTemp',
    description: `Get the current temperature for a specified city. Returns a random but realistic temperature for demonstration purposes.`,
    input_schema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city to get the temperature for',
        },
      },
      required: ['city'],
    },
  },
];

export { timeTempToolDefinitions };
