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

  async executeIntent(
    intentData: any,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    this.logger.log('Starting context-dynamic workflow');

    const conversationId = (callbacks as any).conversationId;
    if (!conversationId) {
      throw new Error('conversationId is required in callbacks');
    }

    try {
      // Extract formId from subjects
      const subjects = intentData.subjects || {};
      const formId = subjects.formId?.[0];

      if (!formId) {
        throw new Error('formId is required in subjects but was not provided');
      }

      this.logger.log(
        `Fetching context-dynamic form data for formId: ${formId}`,
      );

      // 1. Fetch form context using service wrapper
      const formContext =
        await this.iStackInfoService.contextDynamic.getForm(formId);

      // 2. Send form context directly to conversation
      await this.sendFormContextToConversation(
        formContext,
        conversationId,
        intentData.originalUserPrompt,
        formId,
      );
    } catch (error) {
      this.logger.error(`Context-dynamic workflow failed: ${error.message}`);
      callbacks.onError?.(error);
    }
  }

  private async sendFormContextToConversation(
    formContext: any,
    conversationId: string,
    originalPrompt: string,
    formId: string,
  ): Promise<void> {
    const form = formContext.data || formContext.form;

    if (!form) {
      await this.chatManagerService.addMessage({
        content: {
          type: 'text/plain',
          payload: `No form context found for formId: ${formId}`,
        },
        conversationId: conversationId,
        fromUserId: null,
        fromRole: UserRole.SYSTEM,
        toRole: UserRole.USER,
      });
      return;
    }

    // Create a structured summary of the form context
    const contextSummary = this.formatFormContextSummary(form, originalPrompt);

    // Send the context as a structured message
    await this.chatManagerService.addMessage({
      content: {
        type: 'context/dynamic-form',
        payload: {
          formRecord: form,
          submitActionIds: form.submitActions?.map((action: any) =>
            action.submitActionId?.toString(),
          ),
          emails: [
            ...(form.confirmationEmails?.map((email: any) => email.name) || []),
            ...(form.notificationEmails?.map((email: any) => email.name) || []),
          ],
        },
      },
      conversationId: conversationId,
      fromUserId: null,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    // Also send a human-readable summary
    await this.chatManagerService.addMessage({
      content: {
        type: 'text/plain',
        payload: contextSummary,
      },
      conversationId: conversationId,
      fromUserId: null,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    this.logger.log(
      `Sent form context for formId: ${form.formId} to conversation ${conversationId}`,
    );
  }

  private formatFormContextSummary(form: any, originalPrompt: string): string {
    const {
      formId,
      activeAuthProviderName,
      protectionType,
      submitActions = [],
      confirmationEmails = [],
      notificationEmails = [],
      formPlugins = [],
      smartLists = [],
    } = form;

    let summary = `📋 **Form Context for Form ${formId}**\n\n`;
    summary += `**User Query:** ${originalPrompt}\n\n`;

    // Basic form info
    summary += `form: ${formId}\n`;
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
        summary += `  - ${status} ${action.name} (${action.submitActionId})\n`;
      });
      summary += `\n`;
    }

    // Confirmation Emails
    if (confirmationEmails.length > 0) {
      summary += `confirmationEmails:\n`;
      confirmationEmails.forEach((email: any) => {
        const logic = email.hasLogic ? ' (with logic)' : '';
        summary += `  - ${email.name} (${email.confirmationEmailId})${logic}\n`;
      });
      summary += `\n`;
    }

    // Notification Emails
    if (notificationEmails.length > 0) {
      summary += `notificationEmails:\n`;
      notificationEmails.forEach((email: any) => {
        const logic = email.hasLogic ? ' (with logic)' : '';
        summary += `  - ${email.name} (${email.notificationEmailId})${logic}\n`;
      });
      summary += `\n`;
    }

    // Plugins
    if (formPlugins.length > 0) {
      summary += `formPlugins:\n`;
      formPlugins.forEach((plugin: any) => {
        const status = plugin.isActive ? '✅' : '❌';
        summary += `  - ${status} ${plugin.type} (${plugin.formPluginId})\n`;
      });
      summary += `\n`;
    }

    // Smart Lists
    if (smartLists.length > 0) {
      summary += `smartLists:\n`;
      smartLists.forEach((list: any) => {
        const fieldCount = list.fieldIds?.length || 0;
        summary += `  - ${list.name} (${list.smartListId}) - ${fieldCount} fields\n`;
      });
      summary += `\n`;
    }

    summary += `*Form context retrieved successfully.*`;

    return summary;
  }
}
