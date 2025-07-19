#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Specific patterns for remaining unused variables that are safe to remove
const removals = [
  // Remove unused variable assignments
  {
    file: 'src/common/observation-makers/ObservationMakerFieldCounts.ts',
    pattern:
      /const knownFieldTypes: TFsFieldType\[\] = \[\.\.\.ALL_KNOWN_FS_FIELD_TYPES\];/g,
    replacement: '// knownFieldTypes variable removed - was unused',
  },
  {
    file: 'src/common/observation-makers/ObservationMakerFieldCounts.ts',
    pattern: /const fieldTypes = '';/g,
    replacement: '// fieldTypes variable removed - was unused',
  },
  {
    file: 'src/common/observation-makers/ObservationMakerFieldCounts.ts',
    pattern: /const isObservationTrue = false;/g,
    replacement: '// isObservationTrue variable removed - was unused',
  },
  {
    file: 'src/common/observation-makers/ObservationMakerFieldCounts.ts',
    pattern: /error\s*=>/g,
    replacement: '() =>',
  },
  {
    file: 'src/common/observation-makers/ObservationMakerFieldCounts.ts',
    pattern: /const label = fieldModel\.labelUserFriendly\(\);/g,
    replacement: '// label variable removed - was unused',
  },
  {
    file: 'src/common/observation-makers/ObservationMakerLogicValidation.ts',
    pattern: /const fieldTypes = '';/g,
    replacement: '// fieldTypes variable removed - was unused',
  },
  {
    file: 'src/common/observation-makers/ObservationMakerLogicValidation.ts',
    pattern: /const uniqueLabel: Record<string, string\[\]> = \{\};/g,
    replacement: '// uniqueLabel variable removed - was unused',
  },
  {
    file: 'src/robots/SlackyAnthropicAgent.ts',
    pattern:
      /const toolResult = await this\.executeToolCall\('collect_user_feedback', \{/g,
    replacement: "await this.executeToolCall('collect_user_feedback', {",
  },
  {
    file: 'src/robots/SlackyAnthropicAgent.ts',
    pattern:
      /const toolResult = await this\.executeToolCall\('collect_user_rating', \{/g,
    replacement: "await this.executeToolCall('collect_user_rating', {",
  },
  {
    file: 'src/robots/tool-definitions/marv/marvService.ts',
    pattern: /const fieldIds = Object\.keys\(logicStash\);/g,
    replacement: '// fieldIds variable removed - was unused',
  },
  {
    file: 'src/robots/tool-definitions/marv/marvService.ts',
    pattern: /R\s*\)/g,
    replacement: ')',
  },
  {
    file: 'src/robots/tool-definitions/marv/fsApiClient.ts',
    pattern: /error\s*=>/g,
    replacement: '() =>',
  },
  {
    file: 'src/robots/ChatRobotParrot.ts',
    pattern: /error\s*=>/g,
    replacement: '() =>',
  },
  {
    file: 'src/common/logger/logger.module.spec.ts',
    pattern: /error\s*=>/g,
    replacement: '() =>',
  },
  {
    file: 'src/common/interceptors/logging.interceptor.ts',
    pattern: /responseData\s*=>/g,
    replacement: '() =>',
  },
  {
    file: 'src/chat-manager/chat-manager.gateway.ts',
    pattern: /client\s*:\s*Socket/g,
    replacement: '',
  },
  {
    file: 'src/chat-manager/chat-manager.gateway.ts',
    pattern: /data\s*:\s*\{/g,
    replacement: '{',
  },
];

function processFile(filePath, pattern, replacement) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(pattern, replacement);

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
  return false;
}

// Process each removal
removals.forEach((removal) => {
  const filePath = path.join(__dirname, '..', removal.file);
  if (fs.existsSync(filePath)) {
    processFile(filePath, removal.pattern, removal.replacement);
  } else {
    console.log(`File not found: ${removal.file}`);
  }
});

console.log('Done processing specific removals!');
