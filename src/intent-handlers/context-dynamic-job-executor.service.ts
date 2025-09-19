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
      const ackMessage = `🔄 **Context Dynamic Request Received**\n\nProcessing: ${intentData.originalUserPrompt}\nFetching data...`;

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
      activeAuthProviderName,
      protectionType,
      submitActions = [],
      confirmationEmails = [],
      notificationEmails = [],
      formPlugins = [],
      smartLists = [],
    } = form;

    let summary = `📋 **Form Context for Form ${actualFormId}**\n\n`;
    summary += `**User Query:** ${originalPrompt}\n\n`;

    // Basic form info
    summary += `form: ${actualFormId}\n`;
    summary += `protectionType: ${protectionType}\n`;
    if (activeAuthProviderName) {
      summary += `activeAuthProvider: ${activeAuthProviderName}\n`;
    }
    summary += `\n`;

    // Submit Actions
    if (submitActions.length > 0) {
      summary += `submitActions:\n`;
      submitActions.forEach((action: any) => {
        const status = action.isActive ? '✅' : '❌';
        const logic = action.hasLogic ? ' (with logic)' : '';
        summary += `  - ${status} ${action.name} (${action.type}) (**${action.submitActionId}**)${logic}\n`;
      });
      summary += `\n`;
      summary += `*Legend: ✅/❌ = active status, name = submit action name, type = submit action type (webhook, email, etc.), **ID** = submit action ID, (with logic) = has conditional logic*\n\n`;
    }

    // Confirmation Emails
    if (confirmationEmails.length > 0) {
      summary += `confirmationEmails:\n`;
      confirmationEmails.forEach((email: any) => {
        const logic = email.hasLogic ? ' (with logic)' : '';
        summary += `  - ${email.name} (**${email.confirmationEmailId}**)${logic}\n`;
      });
      summary += `\n`;
    }

    // Notification Emails
    if (notificationEmails.length > 0) {
      summary += `notificationEmails:\n`;
      notificationEmails.forEach((email: any) => {
        const logic = email.hasLogic ? ' (with logic)' : '';
        summary += `  - ${email.name} (**${email.notificationEmailId}**)${logic}\n`;
      });
      summary += `\n`;
    }

    // Plugins
    if (formPlugins.length > 0) {
      summary += `formPlugins:\n`;
      formPlugins.forEach((plugin: any) => {
        const status = plugin.isActive ? '✅' : '❌';
        summary += `  - ${status} ${plugin.type} (**${plugin.formPluginId}**)\n`;
      });
      summary += `\n`;
    }

    // Smart Lists
    if (smartLists.length > 0) {
      summary += `smartLists:\n`;
      smartLists.forEach((list: any) => {
        const fieldCount = list.fieldIds?.length || 0;
        summary += `  - ${list.name} (**${list.smartListId}**) - ${fieldCount} fields\n`;
      });
      summary += `\n`;
    }

    summary += `*Form context retrieved successfully.*`;

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

    const richFormContextMessage = this.formatFormContextSummary(
      form,
      intentData.originalUserPrompt,
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

    // Send account context directly to conversation
    await this.sendContextToConversation(
      accountContext,
      conversationId,
      intentData.originalUserPrompt,
      'account',
      accountId.toString(),
    );
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

    // Send auth provider context via callbacks (works for both dev debug and Slack)
    const authProviderContextMessage = `## 🔐 Auth Provider Context Retrieved

**Auth Provider ID:** ${authProviderId}
**Query:** "${intentData.originalUserPrompt}"

**Auth Provider Details:**
- Type: ${authProviderContext.data?.providerType || 'N/A'}
- Status: ${authProviderContext.data?.status || 'N/A'}

*Auth provider context retrieved successfully.*`;

    // Send auth provider context directly to conversation
    await this.sendContextToConversation(
      authProviderContext,
      conversationId,
      intentData.originalUserPrompt,
      'auth provider',
      authProviderId.toString(),
    );
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
}
