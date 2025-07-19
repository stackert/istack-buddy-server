#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to revert all dynamic imports back to require() in test files
const reversions = [
  // Anthropic imports
  {
    pattern:
      /const \{ default: AnthropicConstructor \} = await import\('@anthropic-ai\/sdk'\);/g,
    replacement:
      "const { default: AnthropicConstructor } = require('@anthropic-ai/sdk');",
  },
  {
    pattern:
      /const \{ default: Anthropic \} = await import\('@anthropic-ai\/sdk'\);/g,
    replacement: "const { default: Anthropic } = require('@anthropic-ai/sdk');",
  },
  // OpenAI imports
  {
    pattern: /const \{ OpenAI \} = await import\('openai'\);/g,
    replacement: "const { OpenAI } = require('openai');",
  },
  // Local module imports
  {
    pattern:
      /\(await import\('\.\/tool-definitions\/marv\/fsApiClient'\)\)\.default/g,
    replacement: "require('./tool-definitions/marv/fsApiClient').default",
  },
  {
    pattern: /\(await import\('\.\/marvService'\)\)\.default/g,
    replacement: "require('./marvService').default",
  },
  {
    pattern: /await import\('\.\/tool-definitions\/toolCatalog'\)/g,
    replacement: "require('./tool-definitions/toolCatalog')",
  },
  {
    pattern: /const mockFs = await import\('fs'\);/g,
    replacement: "const mockFs = require('fs');",
  },
  {
    pattern: /const mockPath = await import\('path'\);/g,
    replacement: "const mockPath = require('path');",
  },
  // Index imports
  {
    pattern:
      /expect\(\(await import\('\.\/index'\)\)\.default\)\.toHaveProperty\(exportName\);/g,
    replacement:
      "expect(require('./index').default).toHaveProperty(exportName);",
  },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    reversions.forEach((reversion) => {
      const newContent = content.replace(
        reversion.pattern,
        reversion.replacement,
      );
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (
      stat.isDirectory() &&
      !file.startsWith('.') &&
      file !== 'node_modules'
    ) {
      walkDir(filePath);
    } else if (file.endsWith('.spec.ts')) {
      processFile(filePath);
    }
  });
}

// Start processing from src directory
const srcDir = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcDir)) {
  console.log(
    'Fixing all test files to use require() instead of dynamic imports...',
  );
  walkDir(srcDir);
  console.log('Done!');
} else {
  console.error('src directory not found');
}
