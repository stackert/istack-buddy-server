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
      await this.chatManagerService.addSystemMessage(conversationId, {
        type: 'text/plain',
        payload: `🔄 **Sumo Analysis Request Received**\n\nForm ID: ${baseParams.formId}\nDate Range: ${baseParams.startDate} to ${baseParams.endDate}\n\nStarting multiple reports...`,
      });

      // 3. Run all three reports in parallel
      const [submitActionData, submissionData, submitActionsSelectedData] =
        await Promise.all([
          this.runSingleReport('submitActionReport', baseParams),
          this.runSingleReport('submissionCreatedForForm', baseParams),
          this.runSingleReport('submitActionSelectedForExecution', baseParams),
        ]);

      // 4. Send intermediate status
      await this.chatManagerService.addMessageUserOnly(conversationId, {
        type: 'text/markdown',
        payload: `**Sumo report files generated, doing more analysis please wait...**\n\n- Submit Actions: ${submitActionData.processedData.records?.length || 0} records\n- Submissions: ${submissionData.processedData.records?.length || 0} records\n- Submit Actions Selected: ${submitActionsSelectedData.processedData.records?.length || 0} records\n\nAnalyzing data...`,
      });

      // 5. Generate analysis summaries for all three reports
      const [
        submitActionAnalysis,
        submissionAnalysis,
        submitActionsSelectedAnalysis,
      ] = await Promise.all([
        this.runObservationAnalysis(submitActionData.processedData),
        this.runObservationAnalysis(submissionData.processedData),
        this.runObservationAnalysis(submitActionsSelectedData.processedData),
      ]);

      // 6. Generate analysis prompt
      const reportData = {
        submitActionData: submitActionData.processedData,
        submissionData: submissionData.processedData,
        submitActionsSelectedData: submitActionsSelectedData.processedData,
        submitActionFileLink: submitActionData.fileLink,
        submissionFileLink: submissionData.fileLink,
        submitActionsSelectedFileLink: submitActionsSelectedData.fileLink,
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

      // 8. Send final message with download links
      const finalMessage = `## 📊 Sumo Logic Multi-Report Analysis Complete

**Original Query:** "${intentData.originalUserPrompt}"

**📁 Download Links:**
- [Submit Actions Report](${reportData.submitActionFileLink}) - ${submitActionData.processedData.records?.length || 0} records
- [Form Submissions Report](${reportData.submissionFileLink}) - ${submissionData.processedData.records?.length || 0} records  
- [Submit Actions Selected Report](${reportData.submitActionsSelectedFileLink}) - ${submitActionsSelectedData.processedData.records?.length || 0} records

**📊 Analysis Summary:**
${submitActionAnalysis.slice(0, 200)}...

*Multi-report analysis completed successfully.*`;

      // 8. Send final message
      await this.chatManagerService.addRobotMessage(
        conversationId,
        {
          type: 'text/plain',
          payload: finalMessage,
        },
        'sumo-analysis-robot',
      );

      this.logger.log('Multi-report analysis completed successfully');
    } catch (error) {
      this.logger.error(`Sumo analysis job execution failed: ${error.message}`);

      // Send error as system message
      await this.chatManagerService.addSystemMessage(conversationId, {
        type: 'text/plain',
        payload: `❌ **Sumo Analysis Error**: ${error.message}`,
      });
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
    // Send context to robot (robot-only message)
    await this.chatManagerService.addMessageContextNoResponse(conversationId, {
      type: 'context/document',
      payload: robotContext,
    });

    // Send prompt to robot for response
    await this.chatManagerService.addMessageWithRobotResponse(
      conversationId,
      {
        type: 'text/markdown',
        payload: `Please analyze the Sumo Logic reports for Form ${reportData.submitActionData.records?.[0]?.formId || 'Unknown'} and provide insights on the submit action and submission data patterns.`,
      },
      RobotName.KNOBBY_OPENAI_SEARCH,
    );
  }
}
