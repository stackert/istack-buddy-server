# AnthropicTimeTemp Robot

A dev/debug robot designed to demonstrate different patterns of function/tool calls with Anthropic's Claude API.

## Purpose

This robot demonstrates four different function call patterns:

1. **Single Function Call**: Call one function when only one piece of information is needed
2. **Serial Function Calls**: Call functions in sequence where function 2 input requires function 1 output
3. **Parallel Function Calls**: Call multiple independent functions simultaneously
4. **Zero Function Calls**: Respond conversationally without calling any functions

## Available Tools

- `getTime(city: string)`: Returns a random but realistic time for the specified city
- `getTemp(city: string)`: Returns a random but realistic temperature for the specified city

## Usage

### Running the Demo Script

```bash
# Add your Anthropic API key to .env.live file
# ANTHROPIC_API_KEY=your-api-key-here

# Run the demo script
npm run test:timetemp

# Or run directly with ts-node
npx ts-node scripts/test-anthropic-timetemp.ts
```

### Example Test Cases

The demo script includes these test cases:

1. **Single Function Call**: "What time is it in New York?"
2. **Serial Function Calls**: "Get the time in Tokyo, then use that time to get the temperature in Tokyo"
3. **Parallel Function Calls**: "What is the time in London and the temperature in Paris?"
4. **Zero Function Calls**: "Hello! How are you today?"
5. **Multiple Cities Parallel**: "Get the time in Sydney and temperature in Berlin"

## Robot Behavior

The robot is designed to be educational and will:

- Explain what function call pattern it's using
- Provide clear reasoning for its decisions
- Demonstrate the differences between serial and parallel calls
- Show when no function calls are needed

## Implementation Details

- **Base Class**: Extends `AbstractRobotChat`
- **Model**: Uses Claude 3.5 Sonnet (20241022)
- **Tools**: Simple dummy functions that return random but realistic data
- **Purpose**: Educational demonstration of function call patterns

## Files

- `src/robots/AnthropicTimeTemp.ts` - Main robot implementation
- `src/robots/tool-definitions/timetemp/` - Tool definitions and execution
- `scripts/test-anthropic-timetemp.ts` - Demo script
- `package.json` - Added `test:timetemp` script

## Requirements

- Anthropic API key set in `.env.live` file as `ANTHROPIC_API_KEY=your-api-key-here`
- Node.js with TypeScript support
- All dependencies from the main project
