import { Injectable } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { IntentData, RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import {
  SumoReportBaseJobExecutor,
  SumoJobParams,
} from './sumo-report-base-job-executor.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';

@Injectable()
export class SumoReportSingleJobExecutor
  extends SumoReportBaseJobExecutor
  implements IntentHandler
{
  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'generateSumoReport',
        subIntents: [
          'submitActionReport',
          'submissionCreatedForForm',
          'authProviderMetrics',
          'submitActionSelectedForExecution',
          'theHinkyReport',
        ],
        description: 'Generate single Sumo Logic report',
      },
    ];
  }

  async executeIntent(intentData: IntentData): Promise<void> {
    // Get conversation ID from intentData
    const conversationId = intentData.conversationId;
    this.logger.log(`Using conversation ID: ${conversationId}`);

    try {
      // 1. Parse query parameters from intent data
      const queryParams = this.parseQueryParameters(intentData);

      // 2. Send immediate acknowledgment
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `🔄  *Sumo Report Request Received* 
          
          Query: *${queryParams.queryName}*
          Form ID: *${queryParams.subjects.formId?.[0] || '[any]'}*
          Submit Action ID: *${queryParams.subjects.submitActionId?.[0] || '[any]'}*
          Submit Action Type: *${queryParams.subjects.submitActionType?.[0] || '[any]'}*
          Auth Provider ID: *${queryParams.subjects.authProviderId?.[0] || '[any]'}*
          Account ID: *${queryParams.subjects.accountId?.[0] || '[any]'}*
          Submission ID: *${queryParams.subjects.submissionId?.[0] || '[any]'}*
          Date Range: *${queryParams.dateRange.startDate || '[any]'}* to *${queryParams.dateRange.endDate || '[any]'}*
          Submitting job...`,
        },
      );

      // 3. Submit single job and fetch data
      const fileId = await this.submitAndFetchData(queryParams);

      // 4. Move file to session-public directory
      const fileLink = await this.moveFileToSessionPublic(
        fileId,
        conversationId,
        queryParams,
      );

      // 5. Process data and run observations for single file
      const processedData = await this.processJobData(
        fileId,
        queryParams.queryName,
      );

      // 6. Send combined file link and observation results
      await this.sendCombinedResultsMessage(
        fileLink,
        processedData,
        conversationId,
        intentData.originalUserPrompt,
      );
    } catch (error) {
      this.logger.error(`Sumo report job execution failed: ${error.message}`);

      // Send error as system message
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `❌ **Sumo Report Error**: ${error.message}`,
        },
      );
    }
  }

  private parseQueryParameters(intentData: IntentData): SumoJobParams {
    // Ensure subIntents array exists and has at least one element
    const subIntents = intentData.subIntents || [];
    if (subIntents.length === 0) {
      throw new Error('No sub-intents provided in intent data');
    }

    // Normalize date range for relative time expressions (e.g., "past 24 hours")
    const normalizedDateRange = this.normalizeRelativeDateRange(
      {
        startDate: intentData.dateRange?.startDate,
        endDate: intentData.dateRange?.endDate,
      },
      intentData.originalUserPrompt || '',
    );

    return {
      queryName: this.mapSubIntentToQueryName(subIntents[0]),
      subjects: {
        formId: intentData.subjects?.formId || [],
        submitActionId: intentData.subjects?.submitActionId || [],
        submitActionType: intentData.subjects?.submitActionType || [],
        submissionId: intentData.subjects?.submissionId || [],
        authProviderId: intentData.subjects?.authProviderId || [],
        accountId: intentData.subjects?.accountId || [],
      },
      dateRange: normalizedDateRange,
    };
  }

  private async sendCombinedResultsMessage(
    fileLink: string,
    processedData: any,
    conversationId: string,
    originalQuery: string,
  ): Promise<void> {
    try {
      const recordCount =
        processedData.records?.length || processedData.messageCount || 0;

      // Check if this is the Hinky report
      if (processedData.queryName === 'theHinkyReport') {
        await this.sendHinkyReportResults(
          fileLink,
          processedData,
          conversationId,
          originalQuery,
        );
        return;
      }

      // Handle all other reports (existing logic)
      const observationText = await this.runObservationAnalysis(processedData);

      const firstRecord =
        Array.isArray(processedData.records) && processedData.records.length > 0
          ? `\n\n📋 First Record:\n\n\`\`\`json\n${JSON.stringify(processedData.records[0], null, 2)}\n\`\`\``
          : '';

      const timeFrom = processedData.timeRange?.from || '';
      const timeTo = processedData.timeRange?.to || '';

      const messageBody =
        `## Sumo Logic Report Results\n\n` +
        `**Query Name**: ${processedData.queryName}\n` +
        (processedData.executedQuery
          ? `\n🎯 **Executed Query**:\n\n\`\`\`\n${processedData.executedQuery}\n\`\`\`\n`
          : '') +
        (timeFrom || timeTo
          ? `\n🗓️ **Date Range**: ${timeFrom} to ${timeTo}\n`
          : '') +
        `\n📊 **Records Found**: ${recordCount}\n` +
        (observationText
          ? `\n### Analysis Summary\n${observationText}\n`
          : '') +
        `${firstRecord}\n\n` +
        `📁 **Download File**: [Open results](${fileLink})\n` +
        `\n*Report generated successfully.*`;

      // Send directly to user (do not invoke robot)
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: messageBody,
        },
      );

      this.logger.log(
        `Sent Sumo results to user for conversation ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send combined results: ${error.message}`);
      throw error;
    }
  }

  private async sendHinkyReportResults(
    fileLink: string,
    processedData: any,
    conversationId: string,
    originalQuery: string,
  ): Promise<void> {
    try {
      const recordCount =
        processedData.records?.length || processedData.messageCount || 0;

      // Send system notification with custom Hinky report message
      const systemMessage =
        `## 🔍 Hinky Report Generated\n\n` +
        `Got the Hinky report and found **${recordCount}** messages. I am now reviewing the contents...\n\n` +
        `📁 **Download File**: [Open results](${fileLink})\n\n` +
        `*Analyzing message patterns and relationships...*`;

      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: systemMessage,
        },
      );

      // Add Hinky report data as context document
      const hinkyReportDataContext = `
# HINKY REPORT DATA

**Original User Query:** ${originalQuery}

**Record Count:** ${recordCount}

**Download Link:** ${fileLink}

## Report Data

${JSON.stringify(processedData, null, 2)}
`;

      await this.chatManagerService.addMessageAsContext(conversationId, {
        type: 'context/document',
        payload: hinkyReportDataContext,
      });

      // Read the Hinky report robot prompt
      const fs = require('fs');
      const path = require('path');
      const hinkyPromptPath = path.join(
        process.cwd(),
        'CONTEXT-DOCUMENTS',
        'HINKY_REPORT.md',
      );
      const hinkyPrompt = fs.readFileSync(hinkyPromptPath, 'utf8');

      // Send robot prompt
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/plain',
          payload: hinkyPrompt,
        },
      );

      this.logger.log(
        `Sent Hinky report results and robot context for conversation ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send Hinky report results: ${error.message}`,
      );
      throw error;
    }
  }
}
