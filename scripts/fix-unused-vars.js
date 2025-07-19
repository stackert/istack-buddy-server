#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to match unused variables and prefix them with underscore
const patterns = [
  // Match variable declarations that are likely unused
  {
    regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;\s*\/\/\s*unused/i,
    replacement: 'const _$1 = $2; // unused',
  },
  {
    regex: /let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;\s*\/\/\s*unused/i,
    replacement: 'let _$1 = $2; // unused',
  },
  {
    regex: /var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;\s*\/\/\s*unused/i,
    replacement: 'var _$1 = $2; // unused',
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
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      processFile(filePath);
    }
  });
}

// Start processing from src directory
const srcDir = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcDir)) {
  console.log('Processing TypeScript files for unused variables...');
  walkDir(srcDir);
  console.log('Done!');
} else {
  console.error('src directory not found');
}
