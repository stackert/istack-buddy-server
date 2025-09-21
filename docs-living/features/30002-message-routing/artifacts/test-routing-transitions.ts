import * as dotenv from 'dotenv';
import { join } from 'path';
import { IntentParsingService } from '../../../../src/common/services/intent-parsing.service';

// Load environment variables from .env.live
dotenv.config({ path: join(process.cwd(), '.env.live') });

/**
 * Test script for intent transition functionality
 *
 * This script tests how intents transition from one to another in conversation flows.
 * Each scenario is a sequence of user prompts that should flow naturally from one intent to the next.
 *
 * Run from project root: npx ts-node docs-living/features/30002-message-routing/artifacts/test-routing-transitions.ts
 *
 * Note: Uses the same .env.live file as the server for environment variables.
 */
// Main execution - uncomment the scenario you want to test
async function main() {
  console.log('Starting Intent Transition Test Suite...\n');

  // Uncomment the scenario you want to test
  // await runScenario('SUMO_DYNAMIC_TRANSITION');
  // await runScenario('DYNAMIC_KNOWLEDGE_TRANSITION');
  // await runScenario('DYNAMIC_SUMO_KNOWLEDGE_TRANSITION');
  await runScenario('DYNAMIC_SUMO_KNOWLEDGE_TRANSITION_GOOF');

  console.log('\nTransition test suite completed!');
}

const intentParsingService = new IntentParsingService();

// Define transition scenarios
const scenarios = {
  SUMO_DYNAMIC_TRANSITION: [
    'I need a SubmitAction analysis for form 5894350 and submitAction type - "default"',
    'now can you get me the dynamic context',
    'what about the account settings for that form',
    'show me the auth provider configuration',
  ],
  DYNAMIC_KNOWLEDGE_TRANSITION: [
    'Show me the configuration for form 67890',
    'how do I set up form validation rules?',
    'what about conditional logic for forms?',
    'where can I find documentation on form security?',
  ],
  DYNAMIC_SUMO_KNOWLEDGE_TRANSITION: [
    'Show me the configuration for form 67890',
    'I need you to pull the submitAction report',
    'Can you explain the life cycle of submitAction type "Salesforce"',
  ],
  DYNAMIC_SUMO_KNOWLEDGE_TRANSITION_GOOF: [
    'Show me the configuration for form 67890',
    'I need you to pull the submitAction report',
    'Can you explain the life cycle of submitAction type "Salesforce"',
    'What happens when you mix vinegar and baking soda?',
  ],
};

// Main execution - run scenarios
async function runScenario(scenarioKey: keyof typeof scenarios) {
  console.log(`\n=== Running Scenario: ${scenarioKey} ===\n`);

  const prompts = scenarios[scenarioKey];
  let previousIntent: any = null;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    // Create context from previous intent if it exists
    const previousContext = previousIntent
      ? {
          lastRobotMessageText: `Response from previous intent: ${previousIntent.intent}`,
          lastIntent: previousIntent,
        }
      : undefined;

    // Parse the intent
    const result = await intentParsingService.parsePromptIntent(
      prompt,
      previousContext,
    );

    // Output the result
    console.log(`Prompt ${i + 1}: ${prompt}`);
    console.log(`Intent: ${JSON.stringify(result, null, 2)}\n`);

    // Store this intent as the previous intent for the next iteration
    if ('intentData' in result) {
      previousIntent = result;
    }
  }
}

// Run the tests
main().catch(console.error);
