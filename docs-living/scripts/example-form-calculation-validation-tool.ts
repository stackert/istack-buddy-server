#!/usr/bin/env ts-node

// Load environment variables from .env file (if it exists)
import * as dotenv from 'dotenv';
dotenv.config();

import * as formJson6201623 from '../../test-data/form-json/6201623.json';

// Import from the barrel file
import {
  marvToolSet,
  FsRestrictedApiRoutesEnum,
  type IMarvApiUniversalResponse,
} from '../../src/robots/tool-definitions/marv/index';

console.log(`
FormCalculationValidation Tool Example Script
=============================================

REQUIRED ENVIRONMENT SETUP:
  export CORE_FORMS_API_V2_KEY="your-formstack-api-key"

  To run this script:
  1. Set the environment variable: export CORE_FORMS_API_V2_KEY="your-key"
  2. Run: npx ts-node docs-living/scripts/example-form-calculation-validation-tool.ts
  
  Current environment check:
  - CORE_FORMS_API_V2_KEY is set: ${!!process.env.CORE_FORMS_API_V2_KEY}
  - Key length: ${process.env.CORE_FORMS_API_V2_KEY?.length || 0} characters
`);

// Form ID from the test data
// const FORM_ID = '5375703';
const FORM_ID = '6201623';

/**
 * Example: Using the FormCalculationValidation tool via marvToolSet executor
 * This demonstrates the actual tool execution using the tool definitions and executor
 */
async function exampleFormCalculationValidationTool() {
  console.log(`
FormCalculationValidation Tool Example
--------------------------------------

Using marvToolSet.executeToolCall to run the FormCalculationValidation tool
Tool: ${FsRestrictedApiRoutesEnum.FormCalculationValidation}
Parameters: { formId: "${FORM_ID}" }

Note: This requires real API credentials via CORE_FORMS_API_V2_KEY environment variable
`);

  try {
    // Get the tool definition
    const toolDefinition = marvToolSet.toolDefinitions.find(
      (tool) =>
        tool.name === FsRestrictedApiRoutesEnum.FormCalculationValidation,
    );

    console.log(`
Tool Definition Found:
  Name: ${toolDefinition?.name}
  Description: ${toolDefinition?.description}
  Required Parameters: ${toolDefinition?.input_schema.required?.join(', ')}
`);

    // Execute the tool using the marvToolSet executor
    console.log('Executing tool...');

    const result: IMarvApiUniversalResponse<any> =
      await marvToolSet.executeToolCall(
        FsRestrictedApiRoutesEnum.FormCalculationValidation,
        { formId: FORM_ID },
      );

    console.log(`
Tool Execution Result:
  Success: ${result.isSuccess}
`);

    if (result.isSuccess && result.response) {
      const observationResult = result.response;
      console.log(`
  Observation Result:
    Issues Found: ${observationResult.isObservationTrue}
    Total Log Items: ${observationResult.logItems.length}

  Detailed Results:
`);

      observationResult.logItems.forEach((item: any, index: number) => {
        console.log(
          `  ${index + 1}. [${item.logLevel}] ${item.messageSecondary}`,
        );
        if (item.relatedEntityIds && item.relatedEntityIds.length > 0) {
          console.log(
            `     Related fields: ${item.relatedEntityIds.join(', ')}`,
          );
        }
        if (item.additionalDetails) {
          console.log(
            `     Additional details: ${JSON.stringify(item.additionalDetails, null, 2)}`,
          );
        }
      });
    } else {
      console.log(`
  Error Items: ${result.errorItems?.join(', ')}
  
  Note: This error is expected if you don't have:
  1. CORE_FORMS_API_V2_KEY environment variable set
  2. Access to a real form with ID ${FORM_ID}
  
  To test with real data:
  1. Set CORE_FORMS_API_V2_KEY="your-api-key"
  2. Use a real form ID that exists in your Formstack account
`);
    }
  } catch (error) {
    console.error(`
Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}

This error is expected if you don't have proper API credentials.
To test with real data, ensure you have:
1. CORE_FORMS_API_V2_KEY environment variable set
2. A valid form ID
`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log(`
Starting FormCalculationValidation tool example...
Using test form ID: ${FORM_ID}
`);

  try {
    await exampleFormCalculationValidationTool();

    console.log(`
Example completed!

The tool architecture:
1. marvToolSet.toolDefinitions - Array of Anthropic tool definitions
2. marvToolSet.executeToolCall() - Executor function that:
   - Validates the tool exists in definitions
   - Calls performMarvToolCall() with the tool name and arguments
   - Returns IMarvApiUniversalResponse with success/error status

Integration with AnthropicMarv robot:
- Robot receives tool call from Anthropic API
- Robot calls marvToolSet.executeToolCall() with tool name and args
- Tool executor handles the actual logic and API calls
- Results are returned to robot for user presentation

The FormCalculationValidation tool provides:
- Count of fields with/without calculations
- Calculation error detection and reporting
- Circular reference detection in calculation dependencies
- Unresolved field reference validation
- Detailed error messages for calculation issues
`);
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { exampleFormCalculationValidationTool };
