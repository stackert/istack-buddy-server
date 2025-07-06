#!/usr/bin/env ts-node

/**
 * FsApiClient Interactive Demo
 *
 * This script provides an interactive command-line interface for all fsApiClient functions.
 *
 * Usage:
 *   npx ts-node example-field-add.ts
 *
 * Features:
 *   - Interactive menu with numbered options (1-12)
 *   - Command-line style arguments: fieldLiteAdd label="My Field" type="email" required=true
 *   - Sensible defaults for all parameters
 *   - Real API integration using bf77018720efca7df34b3503dbc486e8
 *
 * Default test form: 5603242 (Marv-enabled)
 * Default field ID: 185235657 (for removal operations)
 */

import { fsApiClient } from '../../src/robots/api/fsApiClient';
import * as readline from 'readline';

// Default values
const DEFAULTS = {
  formId: '5603242',
  fieldId: '185235657',
  formName: 'Test Form',
  label: 'Example Field',
  fieldType: 'text',
  isRequired: false,
  isHidden: false,
};

// Parse command-line style arguments like: label="My Field" type="email" required=true
function parseArgs(input: string): Record<string, any> {
  const args: Record<string, any> = {};
  const regex = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const key = match[1];
    const value = match[2] || match[3];

    // Convert boolean strings
    if (value === 'true') args[key] = true;
    else if (value === 'false') args[key] = false;
    else args[key] = value;
  }

  return args;
}

// Initialize API client
fsApiClient.setApiKey('bf77018720efca7df34b3503dbc486e8');

function showMenu() {
  console.log('\n🔧 FSAPI CLIENT INTERACTIVE MENU');
  console.log('='.repeat(50));
  console.log('What should I do:');
  console.log('  1. formLiteAdd - Create new form');
  console.log('     Example: formLiteAdd name="My Form"');
  console.log('  2. fieldLiteAdd - Add field to form');
  console.log(
    '     Example: fieldLiteAdd label="Email" type="email" required=true',
  );
  console.log('  3. fieldRemove - Remove field');
  console.log('     Example: fieldRemove fieldId="123456"');
  console.log('  4. fieldLogicStashCreate - Create logic backup');
  console.log('     Example: fieldLogicStashCreate formId="5603242"');
  console.log('  5. fieldLogicStashApply - Apply logic backup');
  console.log('     Example: fieldLogicStashApply formId="5603242"');
  console.log('  6. fieldLogicStashApplyAndRemove - Apply and remove backup');
  console.log('     Example: fieldLogicStashApplyAndRemove formId="5603242"');
  console.log('  7. fieldLogicStashRemove - Remove logic backup');
  console.log('     Example: fieldLogicStashRemove formId="5603242"');
  console.log('  8. fieldLogicRemove - Remove all field logic');
  console.log('     Example: fieldLogicRemove formId="5603242"');
  console.log('  9. fieldLabelUniqueSlugAdd - Add unique slugs to labels');
  console.log('     Example: fieldLabelUniqueSlugAdd formId="5603242"');
  console.log(' 10. fieldLabelUniqueSlugRemove - Remove unique slugs');
  console.log('     Example: fieldLabelUniqueSlugRemove formId="5603242"');
  console.log(' 11. formDeveloperCopy - Create developer copy');
  console.log('     Example: formDeveloperCopy formId="5603242"');
  console.log(' 12. formAndRelatedEntityOverview - Get form overview');
  console.log('     Example: formAndRelatedEntityOverview formId="5603242"');
  console.log('  0. Exit');
  console.log(
    '\nDefaults: formId="5603242" fieldId="185235657" label="Example Field" type="text"',
  );
  console.log('='.repeat(50));
}

async function handleFormLiteAdd(args: Record<string, any>) {
  const formName = args.name || args.formName || DEFAULTS.formName;
  const fields = [
    {
      label: args.label || DEFAULTS.label,
      field_type: args.type || args.fieldType || DEFAULTS.fieldType,
      isRequired: args.required || args.isRequired || DEFAULTS.isRequired,
      isHidden: args.hidden || args.isHidden || DEFAULTS.isHidden,
    },
  ];

  console.log(
    `📝 Creating form: "${formName}" with field: "${fields[0].label}"`,
  );
  const result = await fsApiClient.formLiteAdd(formName, fields);

  if (result.isSuccess) {
    console.log(`✅ Form created successfully!`);
    console.log(`   Form ID: ${result.response?.formId}`);
    console.log(`   Edit URL: ${result.response?.editUrl}`);
    console.log(`   View URL: ${result.response?.viewUrl}`);
  } else {
    console.log(`❌ Failed: ${result.errorItems?.join(', ')}`);
  }
}

async function handleFieldLiteAdd(args: Record<string, any>) {
  const formId = args.formId || DEFAULTS.formId;
  const properties = {
    label: args.label || DEFAULTS.label,
    field_type: args.type || args.fieldType || DEFAULTS.fieldType,
    isRequired: args.required || args.isRequired || DEFAULTS.isRequired,
    isHidden: args.hidden || args.isHidden || DEFAULTS.isHidden,
  };

  console.log(`➕ Adding field "${properties.label}" to form ${formId}`);
  const result = await fsApiClient.fieldLiteAdd(formId, properties);

  if (result.isSuccess) {
    console.log(`✅ Field added successfully!`);
    console.log(`   Field ID: ${result.response?.fieldId}`);
    console.log(`   Field Type: ${result.response?.fieldJson?.field_type}`);
  } else {
    console.log(`❌ Failed: ${result.errorItems?.join(', ')}`);
  }
}

async function handleFieldRemove(args: Record<string, any>) {
  const fieldId = args.fieldId || DEFAULTS.fieldId;

  console.log(`🗑️ Removing field ${fieldId}`);
  const result = await fsApiClient.fieldRemove(fieldId);

  if (result.isSuccess) {
    console.log(`✅ Field removed successfully!`);
  } else {
    console.log(`❌ Failed: ${result.errorItems?.join(', ')}`);
  }
}

async function handleFormOverview(args: Record<string, any>) {
  const formId = args.formId || DEFAULTS.formId;
  const result = await fsApiClient.formAndRelatedEntityOverview(formId);
  console.log(result);
}

async function handleFormFunction(
  functionName: string,
  args: Record<string, any>,
) {
  const formId = args.formId || DEFAULTS.formId;

  console.log(`🔧 Executing ${functionName} on form ${formId}`);

  let result;
  switch (functionName) {
    case 'fieldLogicStashCreate':
      result = await fsApiClient.fieldLogicStashCreate(formId);
      break;
    case 'fieldLogicStashApply':
      result = await fsApiClient.fieldLogicStashApply(formId);
      break;
    case 'fieldLogicStashApplyAndRemove':
      result = await fsApiClient.fieldLogicStashApplyAndRemove(formId);
      break;
    case 'fieldLogicStashRemove':
      result = await fsApiClient.fieldLogicStashRemove(formId);
      break;
    case 'fieldLogicRemove':
      result = await fsApiClient.fieldLogicRemove(formId);
      break;
    case 'fieldLabelUniqueSlugAdd':
      result = await fsApiClient.fieldLabelUniqueSlugAdd(formId);
      break;
    case 'fieldLabelUniqueSlugRemove':
      result = await fsApiClient.fieldLabelUniqueSlugRemove(formId);
      break;
    case 'formDeveloperCopy':
      result = await fsApiClient.formDeveloperCopy(formId);
      break;
    default:
      console.log(`❌ Unknown function: ${functionName}`);
      return;
  }

  if (result.isSuccess) {
    console.log(`✅ ${functionName} completed successfully!`);
    if (result.response && typeof result.response === 'object') {
      Object.entries(result.response).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
  } else {
    console.log(`❌ Failed: ${result.errorItems?.join(', ')}`);
  }
}

async function processCommand(input: string) {
  const trimmed = input.trim();

  // Handle numbered selections
  if (/^\d+/.test(trimmed)) {
    const choice = parseInt(trimmed);
    switch (choice) {
      case 0:
        return false; // Exit
      case 1:
        await handleFormLiteAdd({});
        break;
      case 2:
        await handleFieldLiteAdd({});
        break;
      case 3:
        await handleFieldRemove({});
        break;
      case 4:
        await handleFormFunction('fieldLogicStashCreate', {});
        break;
      case 5:
        await handleFormFunction('fieldLogicStashApply', {});
        break;
      case 6:
        await handleFormFunction('fieldLogicStashApplyAndRemove', {});
        break;
      case 7:
        await handleFormFunction('fieldLogicStashRemove', {});
        break;
      case 8:
        await handleFormFunction('fieldLogicRemove', {});
        break;
      case 9:
        await handleFormFunction('fieldLabelUniqueSlugAdd', {});
        break;
      case 10:
        await handleFormFunction('fieldLabelUniqueSlugRemove', {});
        break;
      case 11:
        await handleFormFunction('formDeveloperCopy', {});
        break;
      case 12:
        await handleFormOverview({});
        break;
      default:
        console.log('❌ Invalid selection');
        break;
    }
    return true;
  }

  // Handle function calls with arguments
  const [command, ...argParts] = trimmed.split(' ');
  const args = parseArgs(argParts.join(' '));

  switch (command) {
    case 'formLiteAdd':
      await handleFormLiteAdd(args);
      break;
    case 'fieldLiteAdd':
      await handleFieldLiteAdd(args);
      break;
    case 'fieldRemove':
      await handleFieldRemove(args);
      break;
    case 'fieldLogicStashCreate':
    case 'fieldLogicStashApply':
    case 'fieldLogicStashApplyAndRemove':
    case 'fieldLogicStashRemove':
    case 'fieldLogicRemove':
    case 'fieldLabelUniqueSlugAdd':
    case 'fieldLabelUniqueSlugRemove':
    case 'formDeveloperCopy':
      await handleFormFunction(command, args);
      break;
    case 'formAndRelatedEntityOverview':
      await handleFormOverview(args);
      break;
    case 'exit':
    case 'quit':
      return false;
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log(
        '💡 Use numbers 1-12 for quick access or function names with arguments',
      );
      break;
  }

  return true;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('🚀 FsApiClient Interactive Demo');
  console.log('💡 You can use numbers (1-12) or function names with arguments');

  let running = true;

  while (running) {
    showMenu();

    const input = await new Promise<string>((resolve) => {
      rl.question('\n> ', resolve);
    });

    running = await processCommand(input);

    if (running) {
      console.log('\n' + '⎯'.repeat(50));
    }
  }

  console.log('\n👋 Goodbye!');
  rl.close();
}

main().catch(console.error);
