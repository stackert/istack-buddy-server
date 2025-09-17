import { Injectable } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { IntentData, RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import {
  SumoReportBaseJobExecutor,
  SumoJobParams,
  ProcessedSumoData,
} from './sumo-report-base-job-executor.service';
import { RobotService } from '../robots/robot.service';
import { RobotName, UserRole } from '../chat-manager/dto/create-message.dto';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { FileManagerService } from '../file-manager/file-manager.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';

interface MultiReportData {
  submitActionData: ProcessedSumoData;
  submissionData: ProcessedSumoData;
  submitActionsSelectedData: ProcessedSumoData;
  submitActionFileLink: string;
  submissionFileLink: string;
  submitActionsSelectedFileLink: string;
}

@Injectable()
export class SumoReportMultiJobExecutor
  extends SumoReportBaseJobExecutor
  implements IntentHandler
{
  constructor(
    iStackInfoService: IStackInfoService,
    fileManagerService: FileManagerService,
    chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
  ) {
    super(iStackInfoService, fileManagerService, chatManagerService);
  }

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'generateSumoAnalysis',
        subIntents: ['multiReportAnalysis'],
        description: 'Generate comprehensive multi-report Sumo Logic analysis',
      },
    ];
  }

  async executeIntent(intentData: IntentData): Promise<void> {
    // Get conversation ID from intentData
    const conversationId = intentData.conversationId;
    this.logger.log(`Using conversation ID: ${conversationId}`);

    try {
      // 1. Parse base parameters from intent data
      const baseParams = this.parseBaseParameters(intentData);

      // 2. Send immediate acknowledgment
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `🔄 **Sumo Analysis Request Received**\n\nForm ID: ${baseParams.formId}\nDate Range: ${baseParams.startDate} to ${baseParams.endDate}\n\nStarting multiple reports...`,
        },
      );

      // 3. Run all three reports in parallel (handle partial failures)
      const results = await Promise.allSettled([
        this.runSingleReport('submitActionReport', baseParams),
        this.runSingleReport('submissionCreatedForForm', baseParams),
        this.runSingleReport('submitActionSelectedForExecution', baseParams),
      ]);

      // Extract successful results and log failures
      const submitActionData =
        results[0].status === 'fulfilled' ? results[0].value : null;
      const submissionData =
        results[1].status === 'fulfilled' ? results[1].value : null;
      const submitActionsSelectedData =
        results[2].status === 'fulfilled' ? results[2].value : null;

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const reportNames = [
            'submitActionReport',
            'submissionCreatedForForm',
            'submitActionSelectedForExecution',
          ];
          this.logger.error(
            `${reportNames[index]} failed: ${result.reason.message}`,
          );
        }
      });

      // Continue with successful results only
      if (!submitActionData && !submissionData && !submitActionsSelectedData) {
        throw new Error('All three reports failed - no data to analyze');
      }

      // 4. Send intermediate status
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `**Sumo report files generated, doing more analysis please wait...**\n\n- Submit Actions: ${submitActionData?.processedData.records?.length || 0} records\n- Submissions: ${submissionData?.processedData.records?.length || 0} records\n- Submit Actions Selected: ${submitActionsSelectedData?.processedData.records?.length || 0} records\n\nAnalyzing data...`,
        },
      );

      // 5. Generate analysis summaries for successful reports only
      const analysisPromises = [];
      if (submitActionData)
        analysisPromises.push(
          this.runObservationAnalysis(submitActionData.processedData),
        );
      if (submissionData)
        analysisPromises.push(
          this.runObservationAnalysis(submissionData.processedData),
        );
      if (submitActionsSelectedData)
        analysisPromises.push(
          this.runObservationAnalysis(submitActionsSelectedData.processedData),
        );

      const analysisResults = await Promise.all(analysisPromises);

      const submitActionAnalysis = submitActionData
        ? analysisResults[0]
        : 'Report failed';
      const submissionAnalysis = submissionData
        ? analysisResults[submitActionData ? 1 : 0]
        : 'Report failed';
      const submitActionsSelectedAnalysis = submitActionsSelectedData
        ? analysisResults[(submitActionData ? 1 : 0) + (submissionData ? 1 : 0)]
        : 'Report failed';

      // 6. Generate analysis prompt (only for successful reports)
      const emptyProcessedData = {
        records: [],
        executedQuery: '',
        recordSchema: {},
        messageCount: 0,
        queryName: '',
        arguments: [],
        timeRange: { from: '', to: '' },
        timestamp: '',
        totalRecords: 0,
        validationNote: 'Report failed',
      };

      const reportData = {
        submitActionData: submitActionData?.processedData || emptyProcessedData,
        submissionData: submissionData?.processedData || emptyProcessedData,
        submitActionsSelectedData:
          submitActionsSelectedData?.processedData || emptyProcessedData,
        submitActionFileLink: submitActionData?.fileLink || 'N/A',
        submissionFileLink: submissionData?.fileLink || 'N/A',
        submitActionsSelectedFileLink:
          submitActionsSelectedData?.fileLink || 'N/A',
      };

      const analysisPrompt = this.generatePrompt(
        intentData.originalUserPrompt,
        submitActionAnalysis,
        submissionAnalysis,
        submitActionsSelectedAnalysis,
        reportData,
      );

      // 7. For dev/debug: Send prompt to conversation instead of robot
      await this.chatManagerService.addMessageUserOnly(conversationId, {
        type: 'text/markdown',
        payload:
          'For dev/debug we are sending the prompt to conversation and not robot' +
          analysisPrompt.slice(0, 100),
      });

      // 8. Check if we have any failures and create appropriate message
      const hasFailures =
        !submitActionData || !submissionData || !submitActionsSelectedData;
      const successCount =
        (submitActionData ? 1 : 0) +
        (submissionData ? 1 : 0) +
        (submitActionsSelectedData ? 1 : 0);

      let finalMessage;

      if (hasFailures) {
        // Partial failure - inform user and provide available links
        finalMessage = `## ⚠️ Sumo Logic Multi-Report Partial Results

**Original Query:** "${intentData.originalUserPrompt}"

**📁 Available Download Links:**
${submitActionData ? `- [Submit Actions Report](${reportData.submitActionFileLink}) - ${submitActionData.processedData.records?.length || 0} records` : '- ❌ Submit Actions Report - Failed'}
${submissionData ? `- [Form Submissions Report](${reportData.submissionFileLink}) - ${submissionData.processedData.records?.length || 0} records` : '- ❌ Form Submissions Report - Failed'}
${submitActionsSelectedData ? `- [Submit Actions Selected Report](${reportData.submitActionsSelectedFileLink}) - ${submitActionsSelectedData.processedData.records?.length || 0} records` : '- ❌ Submit Actions Selected Report - Failed'}

**⚠️ Notice:** ${3 - successCount} of 3 reports failed. We could not generate the complete compilation analysis, but you can download the successful reports above.

*Partial results completed - ${successCount}/3 reports successful.*`;
      } else {
        // All successful - normal message
        finalMessage = `## 📊 Sumo Logic Multi-Report Analysis Complete

**Original Query:** "${intentData.originalUserPrompt}"

**📁 Download Links:**
- [Submit Actions Report](${reportData.submitActionFileLink}) - ${submitActionData.processedData.records?.length || 0} records
- [Form Submissions Report](${reportData.submissionFileLink}) - ${submissionData.processedData.records?.length || 0} records  
- [Submit Actions Selected Report](${reportData.submitActionsSelectedFileLink}) - ${submitActionsSelectedData.processedData.records?.length || 0} records

**📊 Analysis Summary:**
${submitActionAnalysis.slice(0, 200)}...

*Multi-report analysis completed successfully.*`;
      }

      // 8. Send final message
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/plain',
          payload: finalMessage,
        },
      );

      this.logger.log('Multi-report analysis completed successfully');
    } catch (error) {
      this.logger.error(`Sumo analysis job execution failed: ${error.message}`);

      // Send error as system message
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: `❌ **Sumo Analysis Error**: ${error.message}`,
        },
      );
    }
  }

  private parseBaseParameters(intentData: IntentData) {
    return {
      formId: intentData.subjects?.formId?.[0],
      startDate: intentData.dateRange?.startDate,
      endDate: intentData.dateRange?.endDate,
    };
  }

  private async runSingleReport(queryName: string, baseParams: any) {
    const queryParams: SumoJobParams = {
      queryName,
      subject: baseParams,
    };

    // Submit and fetch data
    const fileId = await this.submitAndFetchData(queryParams);

    // Move to public directory
    const fileLink = await this.moveFileToSessionPublic(
      fileId,
      'temp-conversation-id', // We'll use a temp ID for file storage
      queryParams,
    );

    // Process data
    const processedData = await this.processJobData(fileId, queryName);

    return { processedData, fileLink };
  }

  private generatePrompt(
    originalQuery: string,
    submitActionAnalysis: string,
    submissionAnalysis: string,
    submitActionsSelectedAnalysis: string,
    reportData: MultiReportData,
  ): string {
    return `# Sumo Logic Multi-Report Analysis

## Original Query
${originalQuery}

## Submit Action Report Analysis
${submitActionAnalysis}

## Submission Report Analysis  
${submissionAnalysis}

## Submit Actions Selected Report Analysis
${submitActionsSelectedAnalysis}

## File Links
- Submit Actions: ${reportData.submitActionFileLink}
- Submissions: ${reportData.submissionFileLink}
- Submit Actions Selected: ${reportData.submitActionsSelectedFileLink}

## Instructions
Provide a comprehensive analysis comparing these three reports. Highlight key insights, correlations, and any anomalies. Mention that detailed data is available in the provided file links and that the user can ask follow-up questions about the analysis.`;
  }

  private async sendPromptToRobot(
    // KEEP THIS  - when we are ready to go to prod we will do final testing and use this

    conversationId: string,
    robotContext: string,
    reportData: MultiReportData,
  ): Promise<void> {
    // Send context to robot
    await this.chatManagerService.addMessageAsContext(conversationId, {
      type: 'context/document',
      payload: robotContext,
    });

    // Send robot analysis response directly (like the main flow does)
    await this.chatManagerService.addMessageToGetRobotResponse(conversationId, {
      type: 'text/plain',
      payload: `Based on the Sumo Logic reports analysis for Form ${reportData.submitActionData.records?.[0]?.formId || 'Unknown'}, I've provided the comprehensive analysis above with download links for detailed data review.`,
    });
  }
}
