#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to remove unused variables
const patterns = [
  // Remove unused variable declarations
  {
    regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;\s*\/\/\s*unused/gi,
    replacement: '// unused variable removed',
  },
  // Remove unused variable assignments
  {
    regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;/g,
    replacement: (match, varName) => {
      // Check if this variable is actually used later in the file
      // For now, we'll be conservative and only remove obvious unused ones
      return match;
    },
  },
  // Remove unused function parameters
  {
    regex: /\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^)]*\)\s*=>/g,
    replacement: (match, paramName) => {
      // Only remove if it's a simple parameter
      return match.replace(paramName, '');
    },
  },
];

// Specific patterns for common unused variables
const specificRemovals = [
  // Remove specific unused variables by name
  { varName: 'id1', pattern: /const\s+id1\s*=\s*[^;]+;/g },
  { varName: 'id3', pattern: /const\s+id3\s*=\s*[^;]+;/g },
  { varName: 'textId', pattern: /const\s+textId\s*=\s*[^;]+;/g },
  { varName: 'imageId', pattern: /const\s+imageId\s*=\s*[^;]+;/g },
  { varName: 'contentHash', pattern: /const\s+contentHash\s*=\s*[^;]+;/g },
  {
    varName: 'conversationList',
    pattern: /const\s+conversationList\s*=\s*[^;]+;/g,
  },
  { varName: 'responseData', pattern: /responseData\s*=>/g },
  { varName: 'error', pattern: /error\s*=>/g },
  {
    varName: 'knownFieldTypes',
    pattern: /const\s+knownFieldTypes\s*=\s*[^;]+;/g,
  },
  { varName: 'fieldTypes', pattern: /const\s+fieldTypes\s*=\s*[^;]+;/g },
  {
    varName: 'isObservationTrue',
    pattern: /const\s+isObservationTrue\s*=\s*[^;]+;/g,
  },
  { varName: 'label', pattern: /const\s+label\s*=\s*[^;]+;/g },
  { varName: 'uniqueLabel', pattern: /const\s+uniqueLabel\s*=\s*[^;]+;/g },
  {
    varName: 'mockDevDebugService',
    pattern: /let\s+mockDevDebugService\s*=\s*[^;]+;/g,
  },
  { varName: 'mockLogger', pattern: /let\s+mockLogger\s*=\s*[^;]+;/g },
  {
    varName: 'mockAuthService',
    pattern: /let\s+mockAuthService\s*=\s*[^;]+;/g,
  },
  {
    varName: 'mockConversation',
    pattern: /const\s+mockConversation\s*=\s*[^;]+;/g,
  },
  { varName: 'conv1', pattern: /const\s+conv1\s*=\s*[^;]+;/g },
  { varName: 'conv2', pattern: /const\s+conv2\s*=\s*[^;]+;/g },
  { varName: 'userMessage', pattern: /const\s+userMessage\s*=\s*[^;]+;/g },
  { varName: 'response', pattern: /const\s+response\s*=\s*[^;]+;/g },
  { varName: 'mockRes', pattern: /const\s+mockRes\s*=\s*[^;]+;/g },
  {
    varName: 'ANTHROPIC_API_KEY',
    pattern: /const\s+ANTHROPIC_API_KEY\s*=\s*[^;]+;/g,
  },
  {
    varName: 'mockExecuteToolCall',
    pattern: /const\s+mockExecuteToolCall\s*=\s*[^;]+;/g,
  },
  { varName: 'messageEnvelope', pattern: /messageEnvelope\s*:\s*[^,)]+/g },
  { varName: 'chunkCallback', pattern: /chunkCallback\s*:\s*[^,)]+/g },
  { varName: 'call_id', pattern: /call_id\s*,/g },
  { varName: 'toolResult', pattern: /const\s+toolResult\s*=\s*[^;]+;/g },
  {
    varName: 'delayedMessageCallback',
    pattern: /delayedMessageCallback\s*:\s*[^,)]+/g,
  },
  { varName: 'toolName', pattern: /toolName\s*:\s*[^,)]+/g },
  { varName: 'toolArgs', pattern: /toolArgs\s*:\s*[^,)]+/g },
  { varName: 'fieldIds', pattern: /const\s+fieldIds\s*=\s*[^;]+;/g },
  { varName: 'R', pattern: /R\s*\)/g },
  { varName: 'index', pattern: /index\s*\)/g },
  {
    varName: 'mockMarvServiceInstance',
    pattern: /const\s+mockMarvServiceInstance\s*=\s*[^;]+;/g,
  },
  {
    varName: 'mockMarvToolSet',
    pattern: /const\s+mockMarvToolSet\s*=\s*[^;]+;/g,
  },
  { varName: 'mockPath', pattern: /const\s+mockPath\s*=\s*[^;]+;/g },
  { varName: 'firstMessage', pattern: /const\s+firstMessage\s*=\s*[^;]+;/g },
  { varName: 'message', pattern: /const\s+message\s*=\s*[^;]+;/g },
  {
    varName: 'initialLastMessageAt',
    pattern: /const\s+initialLastMessageAt\s*=\s*[^;]+;/g,
  },
  { varName: 'client', pattern: /client\s*:\s*[^,)]+/g },
  { varName: 'data', pattern: /data\s*:\s*[^,)]+/g },
  { varName: 'filterOptions', pattern: /filterOptions\s*:\s*[^,)]+/g },
  { varName: 'id', pattern: /id\s*:\s*[^,)]+/g },
  { varName: 'name', pattern: /name\s*:\s*[^,)]+/g },
  { varName: 'description', pattern: /description\s*:\s*[^,)]+/g },
  { varName: 'errorLogItems', pattern: /const\s+errorLogItems\s*=\s*[^;]+;/g },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Apply specific removals
    specificRemovals.forEach((removal) => {
      const newContent = content.replace(removal.pattern, '');
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    // Clean up any resulting empty lines or semicolons
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove multiple empty lines
    content = content.replace(/;\s*;\s*/g, ';'); // Remove double semicolons
    content = content.replace(/,\s*,/g, ','); // Remove double commas
    content = content.replace(/\(\s*,/g, '('); // Remove leading comma in parentheses
    content = content.replace(/,\s*\)/g, ')'); // Remove trailing comma in parentheses

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Cleaned: ${filePath}`);
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
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      processFile(filePath);
    }
  });
}

// Start processing from src directory
const srcDir = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcDir)) {
  console.log('Removing unused variables from TypeScript files...');
  walkDir(srcDir);
  console.log('Done!');
} else {
  console.error('src directory not found');
}
