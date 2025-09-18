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
          payload: `🔄 **Sumo Report Request Received**\n\nQuery: ${queryParams.queryName}\nForm ID: ${queryParams.subject.formId || '[none]'}\nSubmit Action Type: ${queryParams.subject.submitActionType || '[none]'}\nSubmission ID: ${queryParams.subject.submissionId || '[none]'}\nDate Range: ${queryParams.subject.startDate || '[none]'} to ${queryParams.subject.endDate || '[none]'}\n\nSubmitting job...`,
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
    return {
      queryName: this.mapSubIntentToQueryName(intentData.subIntents[0]),
      subject: {
        formId: intentData.subjects?.formId?.[0] || '',
        submitActionId: intentData.subjects?.submitActionId?.[0] || '',
        submitActionType: intentData.subjects?.submitActionType?.[0] || '',
        submissionId: intentData.subjects?.submissionId?.[0] || '',
        authProviderId: intentData.subjects?.authProviderId?.[0] || '',
        startDate: intentData.dateRange?.startDate || '',
        endDate: intentData.dateRange?.endDate || '',
      },
    };
  }

  private async sendCombinedResultsMessage(
    fileLink: string,
    processedData: any,
    conversationId: string,
    originalQuery: string,
  ): Promise<void> {
    try {
      const observationText = await this.runObservationAnalysis(processedData);

      // Determine if this is small context (1 record) or large context (>1 record)
      const recordCount = processedData.records?.length || 0;
      const isSmallContext = recordCount <= 1;

      // DO NOT REMOVE THIS COMMENT - VERY VERY IMPORTANT
      // We don't need to send to robot, we just need to send to user
      // In the future the need may arise but not today
      // DO NOT REMOVE THIS COMMENT - VERY VERY IMPORTANT

      // Send results message to conversation (works for both small and large context)
      const combinedMessage = `
      _ROBOT_INSTRUCTIONS_START_
      Review ${observationText} and formulate a meaningful response to the user.
      Please decorate the link.
      _ROBOT_INSTRUCTIONS_END_
      
      
      ## Sumo Logic Report Results

**Query:** "${originalQuery}"

**📊 Analysis Summary:**
${observationText}

**📁 Download File:**
[Download Report Data](${fileLink})

*Report generated successfully.*`;

      // Send completion message
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/markdown',
          payload: combinedMessage,
        },
      );

      this.logger.log(
        `Sent combined results message to conversation ${conversationId} (toRole: ${isSmallContext ? 'ROBOT' : 'USER'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to send combined results: ${error.message}`);
      throw error;
    }
  }
}
