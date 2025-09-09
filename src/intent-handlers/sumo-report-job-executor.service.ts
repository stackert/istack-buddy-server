import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { IntentData, RobotIntent } from '../common/types/intent-parsing.types';
import { IStreamingCallbacks } from '../robots/types';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import {
  FileManagerService,
  STORAGE_CLASS,
} from '../file-manager/file-manager.service';
import { RobotService } from '../robots/robot.service';

@Injectable()
export class SumoReportJobExecutor implements IntentHandler {
  private readonly logger = new Logger(SumoReportJobExecutor.name);

  constructor(
    private readonly iStackInfoService: IStackInfoService,
    private readonly fileManagerService: FileManagerService,
    private readonly robotService: RobotService,
  ) {}

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'generateSumoReport',
        subIntents: [
          'searchSumoLogSubmissionErrors',
          'searchSumoLogSubmitActionErrors',
          'searchSumoLogIntegrationErrors',
          'searchSumoLogWebhookErrors',
          'searchSumoLogEmailErrors',
          'searchSumoLogFormSubmissionLifeCycle',
          'searchSumoLogFormSubmissionSubmitActionRun',
        ],
        requiredSubjects: ['formId', 'startDate', 'endDate'],
        description:
          'Handles Sumo Logic report generation with file processing',
      },
    ];
  }

  async executeIntent(
    intentData: IntentData,
    callbacks: IStreamingCallbacks,
  ): Promise<void> {
    this.logger.log('Starting Sumo report job execution workflow');

    try {
      // 1. Parse query parameters from intent data
      const queryParams = this.parseQueryParameters(intentData);

      // 2. Submit job and fetch data
      const fileId = await this.submitAndFetchData(queryParams);

      // 3. Process data with your code
      const processedData = await this.processJobData(fileId);

      // 4. Maybe create externally available file
      const externalFileId = await this.maybeCreateExternalFile(processedData);

      // 5. Send processed data to robot
      const robot = this.robotService.getRobotByName('KnobbyOpenAiSumoReport');
      if (!robot) {
        throw new Error('KnobbyOpenAiSumoReport robot not found');
      }

      const robotIntentData = {
        ...intentData,
        originalUserPrompt: `Analyze this Sumo Logic report: ${processedData.summary}`,
        processedFileId: fileId,
        externalFileId,
        processedData: processedData,
      };

      if (
        'executeIntent' in robot &&
        typeof robot.executeIntent === 'function'
      ) {
        await robot.executeIntent(robotIntentData, callbacks);
      } else {
        // Fallback to existing method
        const message = {
          id: 'processed-data-' + Date.now(),
          content: {
            type: 'text/plain',
            payload: robotIntentData.originalUserPrompt,
          },
          conversationId: 'intent-conversation',
          authorUserId: null,
          fromRole: 'customer' as any,
          toRole: 'robot' as any,
          messageType: 'text' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await (robot as any).acceptMessageStreamResponse(message, callbacks);
      }
    } catch (error) {
      this.logger.error(`Sumo report job execution failed: ${error.message}`);
      callbacks.onError?.(error);
    }
  }

  private parseQueryParameters(intentData: IntentData) {
    return {
      queryName: this.mapSubIntentToQueryName(intentData.subIntents[0]),
      subject: {
        formId: intentData.subjects?.formId?.[0],
        startDate: intentData.subjects?.startDate?.[0],
        endDate: intentData.subjects?.endDate?.[0],
      },
    };
  }

  private async submitAndFetchData(queryParams: any): Promise<string> {
    // Submit query
    const submissionResponse =
      await this.iStackInfoService.sumoReport.submitQuery(queryParams);
    const jobId = submissionResponse.jobId;

    // Poll until completed
    let status = 'pending';
    let attempts = 0;
    const maxAttempts = 30;

    while (
      status !== 'completed' &&
      status !== 'failed' &&
      attempts < maxAttempts
    ) {
      await this.sleep(10000);
      attempts++;

      const statusResponse =
        await this.iStackInfoService.sumoReport.jobs.getStatus(jobId);
      status = statusResponse.status;

      if (status === 'failed') {
        throw new Error(
          `Job failed: ${statusResponse.error || 'Unknown error'}`,
        );
      }
    }

    if (status !== 'completed') {
      throw new Error(`Job timed out after ${maxAttempts} attempts`);
    }

    // Get results and fetch file
    const resultsResponse =
      await this.iStackInfoService.sumoReport.jobs.getResults(jobId);

    // Find and download file
    const filesList = await this.iStackInfoService.sumoReport.files.list();
    const jobFiles = filesList.files.filter(
      (file: any) => file.jobId === jobId,
    );
    const targetFile =
      jobFiles.find((file: any) => file.fileName === 'results.json') ||
      jobFiles[0];

    if (!targetFile) {
      throw new Error(`No files found for jobId: ${jobId}`);
    }

    const fileResponse = await this.iStackInfoService.sumoReport.files.get(
      targetFile.fileId,
    );

    // Download and store file
    if (!fileResponse.downloadUrl) {
      throw new Error('No download URL provided for file');
    }
    const response = await fetch(fileResponse.downloadUrl);
    const fileContent = await response.text();

    const localFileId = await this.fileManagerService.put(
      {
        content: fileContent,
        contentType: fileResponse.contentType || 'application/json',
      },
      STORAGE_CLASS.TEMP,
    );

    return localFileId;
  }

  private async processJobData(fileId: string): Promise<any> {
    // Get file content
    const fileBuffer = await this.fileManagerService.get(fileId);
    const data = JSON.parse(fileBuffer.toString());

    // Your post-processing logic here
    return {
      summary: `Found ${data.messageCount || 0} records`,
      recordCount: data.messageCount || 0,
      timeRange: data.timeRange,
      fileId: fileId,
    };
  }

  private async maybeCreateExternalFile(
    data: any,
  ): Promise<string | undefined> {
    // Create externally available file if needed
    return undefined;
  }

  private mapSubIntentToQueryName(subIntent: string): string {
    const mapping: Record<string, string> = {
      searchSumoLogSubmissionErrors: 'submissionCreatedForForm',
      searchSumoLogSubmitActionErrors: 'submitActionReport',
    };
    return mapping[subIntent] || 'submissionCreatedForForm';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
