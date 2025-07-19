#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to revert dynamic imports back to require() in test files
const reversions = [
  {
    file: 'src/robots/AnthropicMarv.spec.ts',
    pattern:
      /const \{ default: AnthropicConstructor \} = await import\('@anthropic-ai\/sdk'\);/g,
    replacement:
      "const { default: AnthropicConstructor } = require('@anthropic-ai/sdk');",
  },
  {
    file: 'src/robots/RobotChatAnthropic.spec.ts',
    pattern:
      /const \{ default: AnthropicConstructor \} = await import\('@anthropic-ai\/sdk'\);/g,
    replacement:
      "const { default: AnthropicConstructor } = require('@anthropic-ai/sdk');",
  },
  {
    file: 'src/robots/RobotChatOpenAI.spec.ts',
    pattern: /const \{ OpenAI \} = await import\('openai'\);/g,
    replacement: "const { OpenAI } = require('openai');",
  },
  {
    file: 'src/robots/SlackyAnthropicAgent.spec.ts',
    pattern:
      /const \{ default: AnthropicConstructor \} = await import\('@anthropic-ai\/sdk'\);/g,
    replacement:
      "const { default: AnthropicConstructor } = require('@anthropic-ai/sdk');",
  },
  {
    file: 'src/robots/index.spec.ts',
    pattern:
      /const \{ default: AnthropicConstructor \} = await import\('@anthropic-ai\/sdk'\);/g,
    replacement:
      "const { default: AnthropicConstructor } = require('@anthropic-ai/sdk');",
  },
];

function processFile(filePath, pattern, replacement) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(pattern, replacement);

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Reverted: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
  return false;
}

// Process each reversion
reversions.forEach((reversion) => {
  const filePath = path.join(__dirname, '..', reversion.file);
  if (fs.existsSync(filePath)) {
    processFile(filePath, reversion.pattern, reversion.replacement);
  } else {
    console.log(`File not found: ${reversion.file}`);
  }
});

console.log('Done reverting test files to use require()!');
