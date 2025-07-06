#!/usr/bin/env ts-node

/**
 * Simple Chat Form Overview - Plain Text Output
 *
 * Demonstrates a direct function call for form overview with simple formatting
 */

import { fsApiClient } from '../../src/robots/api/fsApiClient';

function createSimpleFormOverview(overview: any): string {
  let output = `form (${overview.formId}):\n`;
  output += `url: ${overview.url}\n`;
  output += `version: ${overview.version}\n`;
  output += `timezone: ${overview.timezone}\n`;
  output += `isActive: ${overview.isActive}\n`;
  output += `encrypted: ${overview.encrypted}\n`;
  output += `submissions: ${overview.submissions}\n`;
  output += `submissionsToday: ${overview.submissionsToday}\n`;
  output += `lastSubmissionId: ${overview.lastSubmissionId || 'null'}\n`;
  output += `fieldCount: ${overview.fieldCount}\n`;
  output += `isOneQuestionAtATime: ${overview.isOneQuestionAtATime}\n`;
  output += `hasApprovers: ${overview.hasApprovers}\n`;
  output += `isWorkflowForm: ${overview.isWorkflowForm}\n`;

  if (overview.isWorkflowPublished !== undefined) {
    output += `isWorkflowPublished: ${overview.isWorkflowPublished}\n`;
  }

  output += 'submitActions:[\n';
  overview.submitActions.forEach((action: any, index: number) => {
    output += `  submitAction${index + 1}: {name: "${action.name}", id: "${action.id}"}\n`;
  });
  output += ']\n';

  output += 'notificationEmails:[\n';
  overview.notificationEmails.forEach((notification: any, index: number) => {
    output += `  notificationEmail${index + 1}: {name: "${notification.name}", id: "${notification.id}"}\n`;
  });
  output += ']\n';

  output += 'confirmationEmails:[\n';
  overview.confirmationEmails.forEach((confirmation: any, index: number) => {
    output += `  confirmationEmail${index + 1}: {name: "${confirmation.name}", id: "${confirmation.id}"}\n`;
  });
  output += ']';

  return output;
}

async function simpleChatFormOverview() {
  console.log('User: Can you show me form 5603242 overview?');
  console.log('\nBot: ');

  // Set API key
  fsApiClient.setApiKey('bf77018720efca7df34b3503dbc486e8');

  // Call the function directly
  const formId = '5603242';
  const result = await fsApiClient.formAndRelatedEntityOverview(formId);

  if (!result.isSuccess || !result.response) {
    console.log(`Error: ${result.errorItems?.join(', ') || 'Unknown error'}`);
    return;
  }

  // Format the output simply
  const simpleOutput = createSimpleFormOverview(result.response);
  console.log(simpleOutput);
}

simpleChatFormOverview().catch(console.error);
