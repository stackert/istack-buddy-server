import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';

@Injectable()
export class ContextDynamicJobExecutor implements IntentHandler {
  private readonly logger = new Logger(ContextDynamicJobExecutor.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly iStackInfoService: IStackInfoService,
  ) {}

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'getContextDynamic',
        subIntents: [
          'getFormContext',
          'getAccountContext',
          'getAuthProviderContext',
        ],
      },
    ];
  }

  async executeIntent(intentData: any): Promise<void> {
    this.logger.log('Starting context-dynamic workflow');

    const conversationId = intentData.conversationId;
    if (!conversationId) {
      throw new Error('conversationId is required in intentData');
    }

    try {
      // Send immediate acknowledgment to BOTH dev/debug AND Slack
      const cleanPrompt = this.stripMentionFromMessage(
        intentData.originalUserPrompt,
      );
      const ackMessage = `🔄 **Context Dynamic Request Received**\n\nProcessing: **${cleanPrompt}**\nFetching data...`;

      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: ackMessage,
        },
      );

      const subIntent = intentData.subIntents?.[0];
      const subjects = intentData.subjects || {};

      switch (subIntent) {
        case 'getFormContext':
          await this.handleFormContext(subjects, conversationId, intentData);
          break;
        case 'getAccountContext':
          await this.handleAccountContext(subjects, conversationId, intentData);
          break;
        case 'getAuthProviderContext':
          await this.handleAuthProviderContext(
            subjects,
            conversationId,
            intentData,
          );
          break;
        default:
          throw new Error(`Unsupported sub-intent: ${subIntent}`);
      }
    } catch (error) {
      this.logger.error(`Context-dynamic workflow failed: ${error.message}`);

      // Send error to conversation
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `❌ **Context Dynamic Error**: ${error.message}`,
        },
      );
    }
  }

  private formatFormContextSummary(
    formContext: any,
    originalPrompt: string,
    actualFormId: string,
  ): string {
    const form = formContext.form;
    const {
      name,
      alias,
      formVersion,
      numOfColumns,
      expirationType,
      isCaptchaEnabled,
      timezone,
      language,
      isActive,
      created,
      updated,
      viewCount,
      submissionCount,
      submissionUnreadCount,
      lastSubmissionDate,
      isDeleted,
      formCreateUserId,
      formWorkflowType,
      workflowStatus,
      workflowIncompleteSubmissionCount,
      activeAuthProviderName,
      protectionType,
      submitActions = [],
      confirmationEmails = [],
      notificationEmails = [],
      formPlugins = [],
      smartLists = [],
    } = form;

    let summary = `📋 **Form Context for Form ${actualFormId}**\n\n`;
    summary += `**User Query:** **${originalPrompt}**\n\n`;

    // Basic form info
    summary += `**Form Details:**\n`;
    summary += `- **ID:** ${actualFormId}\n`;
    summary += `- **Name:** ${name || 'N/A'}\n`;
    if (alias) {
      summary += `- **Alias:** ${alias}\n`;
    }
    summary += `- **Version:** ${formVersion || 'N/A'}\n`;
    summary += `- **Columns:** ${numOfColumns || 'N/A'}\n`;
    summary += `- **Language:** ${language || 'N/A'}\n`;
    summary += `- **Timezone:** ${timezone || 'N/A'}\n`;
    summary += `- **Status:** ${isActive ? '✅ Active' : '❌ Inactive'}\n`;
    if (isDeleted) {
      summary += `- **Deleted:** ❌ Yes\n`;
    }

    // URL and metadata (if available from form-fields-observations-source endpoint)
    if (form.url) {
      summary += `- **Form URL:** ${form.url}\n`;
    }
    if (form.viewKey) {
      summary += `- **View Key:** ${form.viewKey}\n`;
    }
    if (form.folder) {
      summary += `- **Folder ID:** ${form.folder}\n`;
    }
    summary += `\n`;

    // Workflow info
    if (formWorkflowType) {
      summary += `**Workflow:**\n`;
      summary += `- **Type:** ${formWorkflowType}\n`;
      summary += `- **Status:** ${workflowStatus || 'N/A'}\n`;
      summary += `- **Incomplete Submissions:** ${workflowIncompleteSubmissionCount || 0}\n`;
      if (form.isWorkflowForm !== undefined) {
        summary += `- **Workflow Form:** ${form.isWorkflowForm ? '✅ Yes' : '❌ No'}\n`;
      }
      if (form.isWorkflowPublished !== undefined) {
        summary += `- **Workflow Published:** ${form.isWorkflowPublished ? '✅ Yes' : '❌ No'}\n`;
      }
      if (form.hasApprovers !== undefined) {
        summary += `- **Has Approvers:** ${form.hasApprovers ? '✅ Yes' : '❌ No'}\n`;
      }
      summary += `\n`;
    }

    // Statistics
    summary += `**Statistics:**\n`;
    summary += `- **Views:** ${viewCount || 0}\n`;
    summary += `- **Total Submissions:** ${submissionCount || 0}\n`;
    summary += `- **Unread Submissions:** ${submissionUnreadCount || 0}\n`;
    if (lastSubmissionDate) {
      summary += `- **Last Submission:** ${lastSubmissionDate}\n`;
    }

    // Additional submission stats (if available from form-fields-observations-source endpoint)
    if (form.submissionsCount !== undefined) {
      summary += `- **Submissions Count:** ${form.submissionsCount}\n`;
    }
    if (form.unreadSubmissionsCount !== undefined) {
      summary += `- **Unread Submissions:** ${form.unreadSubmissionsCount}\n`;
    }
    if (form.todaySubmissionsCount !== undefined) {
      summary += `- **Today's Submissions:** ${form.todaySubmissionsCount}\n`;
    }
    summary += `\n`;

    // Security & Protection
    summary += `**Security:**\n`;
    summary += `- **Protection Type:** ${protectionType || 'None'}\n`;
    if (activeAuthProviderName) {
      summary += `- **Auth Provider:** ${activeAuthProviderName}\n`;
    }
    summary += `- **CAPTCHA:** ${isCaptchaEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
    if (expirationType) {
      summary += `- **Expiration:** ${expirationType}\n`;
    }
    summary += `\n`;

    // Form Features & Settings
    if (form.formExtras) {
      summary += `**Form Features:**\n`;
      summary += `- **Save & Resume:** ${form.formExtras.useSaveResume ? '✅ Enabled' : '❌ Disabled'}\n`;
      summary += `- **Progress Meter:** ${form.formExtras.useProgressMeter ? '✅ Enabled' : '❌ Disabled'}\n`;
      summary += `- **Field Labels Position:** ${form.formExtras.fieldLabelsPosition || 'N/A'}\n`;
      if (form.formExtras.disabledMessage) {
        summary += `- **Disabled Message:** ${form.formExtras.disabledMessage}\n`;
      }
      summary += `\n`;
    }

    // Additional Settings
    if (
      form.formSettings ||
      form.isEncrypted !== undefined ||
      form.submitButtonTitle
    ) {
      summary += `**Additional Settings:**\n`;
      if (form.isEncrypted !== undefined) {
        summary += `- **Encrypted:** ${form.isEncrypted ? '✅ Yes' : '❌ No'}\n`;
      }
      if (form.submitButtonTitle) {
        summary += `- **Submit Button:** ${form.submitButtonTitle}\n`;
      }
      if (form.formSettings?.saveSubmissionsToDatabase !== undefined) {
        summary += `- **Save to Database:** ${form.formSettings.saveSubmissionsToDatabase ? '✅ Yes' : '❌ No'}\n`;
      }
      summary += `\n`;
    }

    // Permissions & Access
    if (form.permissions !== undefined || form.canEdit !== undefined) {
      summary += `**Permissions:**\n`;
      if (form.permissions !== undefined) {
        summary += `- **Permission Level:** ${form.permissions}\n`;
      }
      if (form.canEdit !== undefined) {
        summary += `- **Can Edit:** ${form.canEdit ? '✅ Yes' : '❌ No'}\n`;
      }
      summary += `\n`;
    }

    // Submit Actions
    if (submitActions.length > 0) {
      summary += `**submitActions:**\n`;
      submitActions.forEach((action: any) => {
        const status = action.isActive ? '✅' : '❌';
        const logic = action.hasLogic ? ' (with logic)' : '';
        summary += `  - ${status} ${action.name} (${action.type}) (submitActionId:${action.submitActionId})${logic}\n`;
      });
      summary += `\n`;
      summary += `*Legend: ✅/❌ = active status, name = submit action name, type = submit action type (webhook, email, etc.), (with logic) = has conditional logic*\n\n`;
    }

    // Confirmation Emails
    if (confirmationEmails.length > 0) {
      summary += `**confirmationEmails:**\n`;
      confirmationEmails.forEach((email: any) => {
        const logic = email.hasLogic ? ' (with logic)' : '';
        summary += `  - ${email.name} (confirmationEmailId:${email.confirmationEmailId})${logic}\n`;
      });
      summary += `\n`;
    }

    // Notification Emails
    if (notificationEmails.length > 0) {
      summary += `**notificationEmails:**\n`;
      notificationEmails.forEach((email: any) => {
        const logic = email.hasLogic ? ' (with logic)' : '';
        summary += `  - ${email.name} (notificationEmailId:${email.notificationEmailId})${logic}\n`;
      });
      summary += `\n`;
    }

    // Plugins
    if (formPlugins.length > 0) {
      summary += `**formPlugins:**\n`;
      formPlugins.forEach((plugin: any) => {
        const status = plugin.isActive ? '✅' : '❌';
        summary += `  - ${status} ${plugin.type} (formPluginId:${plugin.formPluginId})\n`;
      });
      summary += `\n`;
    }

    // Smart Lists
    if (smartLists.length > 0) {
      summary += `**smartLists:**\n`;
      smartLists.forEach((list: any) => {
        const fieldCount = list.fieldIds?.length || 0;
        summary += `  - ${list.name} (smartListId:${list.smartListId}) - ${fieldCount} fields\n`;
      });
      summary += `\n`;
    }

    // Field Summary (if available from form-fields-observations-source endpoint)
    if (form.fields && Array.isArray(form.fields) && form.fields.length > 0) {
      summary += `**Field Summary:**\n`;
      const totalFields = form.fields.length;
      const requiredFields = form.fields.filter((f: any) => f.required).length;
      const hiddenFields = form.fields.filter((f: any) => f.hidden).length;
      const readOnlyFields = form.fields.filter((f: any) => f.readOnly).length;

      summary += `- **Total Fields:** ${totalFields}\n`;
      summary += `- **Required Fields:** ${requiredFields}\n`;
      summary += `- **Hidden Fields:** ${hiddenFields}\n`;
      summary += `- **Read-Only Fields:** ${readOnlyFields}\n`;

      // Show field types summary
      const fieldTypes = form.fields.reduce((acc: any, field: any) => {
        acc[field.type] = (acc[field.type] || 0) + 1;
        return acc;
      }, {});

      if (Object.keys(fieldTypes).length > 0) {
        summary += `- **Field Types:** ${Object.entries(fieldTypes)
          .map(([type, count]) => `${type}(${count})`)
          .join(', ')}\n`;
      }
      summary += `\n`;
    }

    summary += `*Form context retrieved successfully.*\n\n`;
    summary += `\`\`\`\nNote: Context-Dynamic queries use Databricks as its data store. Databricks is known to have up to 24 hour lag time.\n\`\`\``;

    return summary;
  }

  private formatAccountContextSummary(
    accountContext: any,
    originalPrompt: string,
    actualAccountId: string,
  ): string {
    const {
      accountId,
      parentAccountId,
      fsidOrganizationId,
      max_forms,
      max_submissions,
      isActive,
    } = accountContext;

    let summary = `🏢 **Account Context for Account ${actualAccountId}**\n\n`;
    summary += `**User Query:** ${originalPrompt}\n\n`;

    // Basic account info
    summary += `**Account Details:**\n`;
    summary += `- Account ID: **${accountId}**\n`;
    summary += `- Status: ${isActive ? '✅ Active' : '❌ Inactive'}\n`;

    if (parentAccountId && parentAccountId !== 0) {
      summary += `- Parent Account: **${parentAccountId}**\n`;
    }

    if (fsidOrganizationId && fsidOrganizationId.trim() !== '') {
      summary += `- Organization ID: **${fsidOrganizationId}**\n`;
    }

    summary += `\n**Limits:**\n`;
    summary += `- Maximum Forms: **${max_forms?.toLocaleString() || 'N/A'}**\n`;
    summary += `- Maximum Submissions: **${max_submissions?.toLocaleString() || 'N/A'}**\n`;

    summary += `\n*Account context retrieved successfully.*\n\n`;
    summary += `\`\`\`\nNote: Context-Dynamic queries use Databricks as its data store. Databricks is known to have up to 24 hour lag time.\n\`\`\``;

    return summary;
  }

  private formatAuthProviderContextSummary(
    authProviderContext: any,
    originalPrompt: string,
    actualAuthProviderId: string,
  ): string {
    const { authProviderId, name, type } = authProviderContext;

    let summary = `🔐 **Auth Provider Context for Provider ${actualAuthProviderId}**\n\n`;
    summary += `**User Query:** ${originalPrompt}\n\n`;

    // Basic auth provider info
    summary += `**Auth Provider Details:**\n`;
    summary += `- Auth Provider ID: **${authProviderId}**\n`;

    if (name) {
      summary += `- Name: **${name}**\n`;
    }

    if (type) {
      summary += `- Type: **${type.toUpperCase()}**\n`;
    }

    summary += `\n*Auth provider context retrieved successfully.*\n\n`;
    summary += `\`\`\`\nNote: Context-Dynamic queries use Databricks as its data store. Databricks is known to have up to 24 hour lag time.\n\`\`\``;

    return summary;
  }

  private async handleFormContext(
    subjects: any,
    conversationId: string,
    intentData: any,
  ): Promise<void> {
    const formIdString = subjects.formId?.[0];

    if (!formIdString) {
      throw new Error('formId is required in subjects but was not provided');
    }

    // Convert formId to number as required by API
    const formId = parseInt(formIdString, 10);
    if (isNaN(formId) || formId <= 0) {
      throw new Error(`formId must be a positive number, got: ${formIdString}`);
    }

    this.logger.log(`Fetching context-dynamic form data for formId: ${formId}`);

    // Fetch form context using service wrapper
    const formContext =
      await this.iStackInfoService.contextDynamic.getForm(formId);

    // DEBUG: Log the exact API response to see what Slack is getting
    this.logger.log(
      `API RESPONSE FOR FORM ${formId}: ${JSON.stringify(formContext, null, 2)}`,
    );

    // Send rich form context to BOTH dev/debug AND Slack
    const form = formContext.data || formContext;
    this.logger.log(`EXTRACTED FORM DATA: ${JSON.stringify(form, null, 2)}`);

    const cleanPrompt = this.stripMentionFromMessage(
      intentData.originalUserPrompt,
    );
    const richFormContextMessage = this.formatFormContextSummary(
      form,
      cleanPrompt,
      formId.toString(),
    );

    this.logger.log(
      `FORMATTED MESSAGE (context-dynamic-form): ${richFormContextMessage}...`,
    );

    // Send to dev/debug conversation
    await this.chatManagerService.addMessageSystemNotification(conversationId, {
      type: 'text/markdown',
      payload: richFormContextMessage,
    });

    // Note: Message sent via addMessage() will be broadcasted to all clients including Slack
  }

  private async handleAccountContext(
    subjects: any,
    conversationId: string,
    intentData: any,
  ): Promise<void> {
    const accountIdString = subjects.accountId?.[0];

    if (!accountIdString) {
      throw new Error('accountId is required in subjects but was not provided');
    }

    // Convert accountId to number as required by API
    const accountId = parseInt(accountIdString, 10);
    if (isNaN(accountId) || accountId <= 0) {
      throw new Error(
        `accountId must be a positive number, got: ${accountIdString}`,
      );
    }

    this.logger.log(
      `Fetching context-dynamic account data for accountId: ${accountId}`,
    );

    // Fetch account context using service wrapper
    const accountContext =
      await this.iStackInfoService.contextDynamic.getAccount(accountId);

    // Send formatted account context to BOTH dev/debug AND Slack
    const account = accountContext.account || accountContext;
    this.logger.log(
      `EXTRACTED ACCOUNT DATA: ${JSON.stringify(account, null, 2)}`,
    );

    const richAccountContextMessage = this.formatAccountContextSummary(
      account,
      intentData.originalUserPrompt,
      accountId.toString(),
    );

    this.logger.log(
      `FORMATTED MESSAGE (context-dynamic-account): ${richAccountContextMessage.substring(0, 200)}...`,
    );

    // Send to dev/debug conversation
    await this.chatManagerService.addMessageSystemNotification(conversationId, {
      type: 'text/markdown',
      payload: richAccountContextMessage,
    });

    // Note: Message sent via addMessage() will be broadcasted to all clients including Slack
  }

  private async handleAuthProviderContext(
    subjects: any,
    conversationId: string,
    intentData: any,
  ): Promise<void> {
    const authProviderIdString = subjects.authProviderId?.[0];

    if (!authProviderIdString) {
      throw new Error(
        'authProviderId is required in subjects but was not provided',
      );
    }

    // Convert authProviderId to number as required by API
    const authProviderId = parseInt(authProviderIdString, 10);
    if (isNaN(authProviderId) || authProviderId <= 0) {
      throw new Error(
        `authProviderId must be a positive number, got: ${authProviderIdString}`,
      );
    }

    this.logger.log(
      `Fetching context-dynamic auth provider data for authProviderId: ${authProviderId}`,
    );

    // Fetch auth provider context using service wrapper
    const authProviderContext =
      await this.iStackInfoService.contextDynamic.getAuthProvider(
        authProviderId,
      );

    // Send formatted auth provider context to BOTH dev/debug AND Slack
    const authProvider =
      authProviderContext.authProvider || authProviderContext;
    this.logger.log(
      `EXTRACTED AUTH PROVIDER DATA: ${JSON.stringify(authProvider, null, 2)}`,
    );

    const richAuthProviderContextMessage =
      this.formatAuthProviderContextSummary(
        authProvider,
        intentData.originalUserPrompt,
        authProviderId.toString(),
      );

    this.logger.log(
      `FORMATTED MESSAGE (context-dynamic-auth-provider): ${richAuthProviderContextMessage.substring(0, 200)}...`,
    );

    // Send to dev/debug conversation
    await this.chatManagerService.addMessageSystemNotification(conversationId, {
      type: 'text/markdown',
      payload: richAuthProviderContextMessage,
    });

    // Note: Message sent via addMessage() will be broadcasted to all clients including Slack
  }

  private async sendContextToConversation(
    contextData: any,
    conversationId: string,
    originalPrompt: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    const content = {
      type: 'context/dynamic' as const,
      payload: JSON.stringify({
        entityType,
        entityId,
        originalQuery: originalPrompt,
        contextData,
        timestamp: new Date().toISOString(),
      }),
    };

    await this.chatManagerService.addMessageAsContext(conversationId, content);

    this.logger.log(
      `Sent ${entityType} context data to conversation ${conversationId}`,
    );
  }

  /**
   * Strip @iStackBuddyChatApp, @iStackBuddy, and ALL Slack mention formats from messages
   */
  private stripMentionFromMessage(message: string): string {
    if (!message) return message;

    // Remove @iStackBuddyChatApp mentions (case insensitive)
    let cleaned = message.replace(/@iStackBuddyChatApp\s*/gi, '');

    // Remove @iStackBuddy mentions (case insensitive)
    cleaned = cleaned.replace(/@iStackBuddy\s*/gi, '');

    // Remove ALL Slack mention formats <@U...> (any user ID)
    cleaned = cleaned.replace(/<@U[A-Z0-9]+>\s*/gi, '');

    // Also remove any leading/trailing whitespace and clean up multiple spaces
    return cleaned.trim().replace(/\s+/g, ' ');
  }
}
