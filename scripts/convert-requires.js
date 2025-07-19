#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to convert require() to dynamic imports
const patterns = [
  // Convert require('@anthropic-ai/sdk') patterns
  {
    regex:
      /const\s+\{\s*default:\s*Anthropic\s*\}\s*=\s*require\('@anthropic-ai\/sdk'\);/g,
    replacement:
      "const { default: Anthropic } = await import('@anthropic-ai/sdk');",
  },
  {
    regex:
      /const\s+AnthropicConstructor\s*=\s*require\('@anthropic-ai\/sdk'\)\.default;/g,
    replacement:
      "const { default: AnthropicConstructor } = await import('@anthropic-ai/sdk');",
  },
  // Convert require('openai') patterns
  {
    regex: /const\s+\{\s*OpenAI\s*\}\s*=\s*require\('openai'\);/g,
    replacement: "const { OpenAI } = await import('openai');",
  },
  // Convert require('fs') patterns
  {
    regex: /const\s+mockFs\s*=\s*require\('fs'\);/g,
    replacement: "const mockFs = await import('fs');",
  },
  // Convert require('path') patterns
  {
    regex: /const\s+mockPath\s*=\s*require\('path'\);/g,
    replacement: "const mockPath = await import('path');",
  },
  // Convert require('./relative/path') patterns
  {
    regex: /require\('\.\/[^']+'\)/g,
    replacement: (match) => {
      const path = match.replace(/require\('(.+)'\)/, '$1');
      return `(await import('${path}')).default`;
    },
  },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    patterns.forEach((pattern) => {
      const newContent = content.replace(pattern.regex, pattern.replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    // If we made changes, we need to make the containing function async
    if (modified) {
      // Find test functions that contain await import and make them async
      content = content.replace(
        /(it\s*\(\s*['"`][^'"`]+['"`]\s*,\s*)(async\s+)?function\s*\(/g,
        '$1async function(',
      );

      content = content.replace(
        /(it\s*\(\s*['"`][^'"`]+['"`]\s*,\s*)(async\s+)?\(/g,
        '$1async (',
      );

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Converted: ${filePath}`);
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
    } else if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) {
      processFile(filePath);
    }
  });
}

// Start processing from src directory
const srcDir = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcDir)) {
  console.log(
    'Converting require() statements to ES6 imports in test files...',
  );
  walkDir(srcDir);
  console.log('Done!');
} else {
  console.error('src directory not found');
}
