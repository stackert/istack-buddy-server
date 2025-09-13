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
          ],
        description: 'Generate single Sumo Logic report',
      },
    ];
  }

  async executeIntent(
    intentData: IntentData,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    // Get conversation ID from callbacks
    const conversationId = callbacks.conversationId;
    this.logger.log(`Using conversation ID: ${conversationId}`);

    try {
      // 1. Parse query parameters from intent data
      const queryParams = this.parseQueryParameters(intentData);

      // 2. Send status message to user
      await this.chatManagerService.addMessageUserOnly(conversationId, {
        type: 'text/plain',
        payload: `**Running Sumo query with parameters:**\n\n- Query: ${queryParams.queryName}\n- Form ID: ${queryParams.subject.formId}\n- Date Range: ${queryParams.subject.startDate} to ${queryParams.subject.endDate}\n\nProcessing...`,
      });

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
      callbacks.onError?.(error);
    }
  }

  private parseQueryParameters(intentData: IntentData): SumoJobParams {
    return {
      queryName: this.mapSubIntentToQueryName(intentData.subIntents[0]),
      subject: {
        formId: intentData.subjects?.formId?.[0] || '',
        startDate: intentData.subjects?.startDate?.[0] || '',
        endDate: intentData.subjects?.endDate?.[0] || '',
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

      if (isSmallContext) {
        // Small context goes to robot only as context (no file link needed for robot)
        await this.chatManagerService.addMessage({
          content: {
            type: 'context/document',
            payload: observationText,
          },
          conversationId: conversationId,
          fromUserId: null,
          fromRole: UserRole.SYSTEM,
          toRole: UserRole.ROBOT,
        });
      } else {
        // Large context goes to user as combined markdown message
        const combinedMessage = `## Sumo Logic Report Results

**Query:** "${originalQuery}"

**📊 Analysis Summary:**
${observationText}

**📁 Download File:**
[Download Report Data](${fileLink})

*Report generated successfully.*`;

        await this.chatManagerService.addMessageUserOnly(conversationId, {
          type: 'text/markdown',
          payload: combinedMessage,
        });
      }

      this.logger.log(
        `Sent combined results message to conversation ${conversationId} (toRole: ${isSmallContext ? 'ROBOT' : 'USER'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to send combined results: ${error.message}`);
      throw error;
    }
  }
}
