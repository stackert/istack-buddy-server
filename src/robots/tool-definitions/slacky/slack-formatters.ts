import { ObservationMakerViewer } from './ObservationMakerViewer';

export function slackyToolResultFormatter(
  functionName: string,
  result: any,
): string {
  try {
    switch (functionName) {
      case 'fsRestrictedApiFormCalculationValidation':
      case 'fsRestrictedApiFormLogicValidation':
        return formatValidationResult(functionName, result);
      case 'fsRestrictedApiFormAndRelatedEntityOverview':
        return formatFormOverviewResult(result);
      case 'sumoLogicQuery':
        return formatSumoQueryResult(result);
      case 'ssoAutoFillAssistance':
        return formatSsoResult(result);
      default:
        return formatGenericResult(functionName, result);
    }
  } catch (error) {
    return `❌ *Error formatting result:* ${
      error instanceof Error ? error.message : 'Unknown error'
    }\n\n*Raw result:*\n\`\`\`${JSON.stringify(result, null, 2)}\`\`\``;
  }
}

export function formatValidationResult(
  functionName: string,
  result: any,
): string {
  const viewer = ObservationMakerViewer.fromObservationResults(result);
  const summary = viewer.getSummary();
  const formatted = viewer.formatForSlack();

  const functionDisplayName =
    functionName === 'fsRestrictedApiFormCalculationValidation'
      ? 'Calculation Validation'
      : 'Logic Validation';

  const observationClass = viewer.getObservationClassName();
  const contextInfo =
    observationClass !== 'ObservationMakerViewer'
      ? `\n*Observation Type:* ${observationClass}`
      : '';

  return `🔍 *${functionDisplayName} Results*${contextInfo}\n\n${summary}\n\n${formatted}`;
}

export function formatFormOverviewResult(result: any): string {
  if (!result || !result.response) {
    return `❌ *Form Overview Error:* No data received`;
  }

  const data = result.response;
  let formatted = `📋 *Form Overview*\n\n`;

  if (data.formId) formatted += `• *Form ID:* \`${data.formId}\`\n`;
  if (data.url) formatted += `• *URL:* ${data.url}\n`;
  if (data.version) formatted += `• *Version:* ${data.version}\n`;
  if (data.submissions !== undefined)
    formatted += `• *Total Submissions:* ${data.submissions.toLocaleString()}\n`;
  if (data.submissionsToday !== undefined)
    formatted += `• *Submissions Today:* ${data.submissionsToday.toLocaleString()}\n`;
  if (data.fieldCount) formatted += `• *Field Count:* ${data.fieldCount}\n`;
  if (data.isActive !== undefined)
    formatted += `• *Status:* ${data.isActive ? '✅ Active' : '❌ Inactive'}\n`;
  if (data.encrypted !== undefined)
    formatted += `• *Encrypted:* ${data.encrypted ? 'Yes' : 'No'}\n`;
  if (data.timezone) formatted += `• *Timezone:* ${data.timezone}\n`;
  if (data.isOneQuestionAtATime !== undefined)
    formatted += `• *One Question at a Time:* ${
      data.isOneQuestionAtATime ? 'Yes' : 'No'
    }\n`;
  if (data.hasApprovers !== undefined)
    formatted += `• *Has Approvers:* ${data.hasApprovers ? 'Yes' : 'No'}\n`;
  if (data.isWorkflowForm !== undefined)
    formatted += `• *Workflow Form:* ${data.isWorkflowForm ? 'Yes' : 'No'}\n`;

  if (data.submitActions && data.submitActions.length > 0) {
    formatted += `\n*Submit Actions (${data.submitActions.length}):*\n`;
    data.submitActions.forEach((action: any) => {
      formatted += `• ${action.name || 'Unnamed Action'} (ID: \`${action.id}\`)\n`;
    });
  } else {
    formatted += `\n*Submit Actions:* None configured\n`;
  }

  if (data.notificationEmails && data.notificationEmails.length > 0) {
    formatted += `\n*Notification Emails (${data.notificationEmails.length}):*\n`;
    data.notificationEmails.forEach((email: any) => {
      const emailDisplay = email.name
        ? `${email.name} (ID: \`${email.id}\`)`
        : email.id
          ? `ID: \`${email.id}\``
          : email.email
            ? email.email
            : JSON.stringify(email);
      formatted += `• ${emailDisplay}\n`;
    });
  } else {
    formatted += `\n*Notification Emails:* None configured\n`;
  }

  if (data.confirmationEmails && data.confirmationEmails.length > 0) {
    formatted += `\n*Confirmation Emails (${data.confirmationEmails.length}):*\n`;
    data.confirmationEmails.forEach((email: any) => {
      const emailDisplay = email.name
        ? `${email.name} (ID: \`${email.id}\`)`
        : email.id
          ? `ID: \`${email.id}\``
          : email.email
            ? email.email
            : JSON.stringify(email);
      formatted += `• ${emailDisplay}\n`;
    });
  } else {
    formatted += `\n*Confirmation Emails:* None configured\n`;
  }

  return formatted;
}

export function formatSumoQueryResult(result: any): string {
  if (!result || typeof result !== 'string') {
    return `❌ *Sumo Logic Error:* Invalid result format`;
  }
  return `📊 *Sumo Logic Query Results*\n\n\`\`\`${result}\`\`\``;
}

export function formatSsoResult(result: any): string {
  if (!result || typeof result !== 'string') {
    return `❌ *SSO Auto-fill Error:* Invalid result format`;
  }
  return `🔐 *SSO Auto-fill Analysis*\n\n${result}`;
}

export function formatGenericResult(functionName: string, result: any): string {
  const resultString =
    typeof result === 'object'
      ? JSON.stringify(result, null, 2)
      : String(result);
  return `🔧 *${functionName} Results*\n\n\`\`\`${resultString}\`\`\``;
}
