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
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { ObservationMakerSumoReport } from './ObservationMakerSumoQuery';
import { ObservationMakerSumoSubmitActionJobReport } from './ObservationMakerSumoSubmitActionJobReport';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SumoReportJobExecutor implements IntentHandler {
  private readonly logger = new Logger(SumoReportJobExecutor.name);

  constructor(
    private readonly iStackInfoService: IStackInfoService,
    private readonly fileManagerService: FileManagerService,
    private readonly robotService: RobotService,
    private readonly chatManagerService: ChatManagerService,
  ) {}

  private readonly fileStorageBasePath = 'file-storage-server/session-public';

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
    this.logger.log('Intent data:', intentData);

    // Get conversation ID from callbacks
    const conversationId = callbacks.conversationId;
    this.logger.log(`Using conversation ID: ${conversationId}`);

    try {
      // 1. Parse query parameters from intent data
      const queryParams = this.parseQueryParameters(intentData);

      // 2. Submit job and fetch data - get all files with Promise.all()
      const fileIds = await this.submitAndFetchAllData(queryParams);

      // 3. Move files to session-public directory
      const fileLinks = await this.moveFilesToSessionPublic(
        fileIds,
        conversationId,
        queryParams,
      );

      // 4. Send file links message to conversation (SYSTEM -> USER)
      await this.sendFileLinksMessage(
        fileLinks,
        conversationId,
        intentData.originalUserPrompt,
      );

      // 5. Process data and run observations
      const processedDataList = await Promise.all(
        fileIds.map((fileId) =>
          this.processJobData(fileId, queryParams.queryName),
        ),
      );

      // 6. Run observations and send results
      await this.processObservationsAndSendResults(
        processedDataList,
        conversationId,
      );
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

  private async processJobData(
    fileId: string,
    queryName: string,
  ): Promise<any> {
    // Get file content
    const fileBuffer = await this.fileManagerService.get(fileId);
    const data = JSON.parse(fileBuffer.toString());

    // Your post-processing logic here - INCLUDE queryName for observation maker
    return {
      summary: `Found ${data.messageCount || 0} records`,
      recordCount: data.messageCount || 0,
      timeRange: data.timeRange,
      fileId: fileId,
      queryName: queryName, // ✅ Pass through the queryName for observation maker
      records: data.records || [], // ✅ Include the actual records
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
      // Legacy mappings (old subIntent names)
      searchSumoLogSubmissionErrors: 'submissionCreatedForForm',
      searchSumoLogSubmitActionErrors: 'submitActionReport',
      // Direct query names (preferred)
      submissionCreatedForForm: 'submissionCreatedForForm',
      submitActionReport: 'submitActionReport',
      authProviderMetrics: 'authProviderMetrics',
    };

    if (!mapping[subIntent]) {
      throw new Error(
        `sumoQuery.queryName is required - no fallbacks allowed. Unsupported subIntent: ${subIntent}`,
      );
    }

    return mapping[subIntent];
  }

  private async submitAndFetchAllData(queryParams: any): Promise<string[]> {
    // For now, we'll process one file, but this structure supports multiple files
    const fileId = await this.submitAndFetchData(queryParams);
    return [fileId];
  }

  /**
   * Format date string to YYYYMMDDHHMMSS format for filename
   */
  private formatDateForFilename(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private async moveFilesToSessionPublic(
    fileIds: string[],
    conversationId: string,
    queryParams: any,
  ): Promise<string[]> {
    const sessionDir = path.join(this.fileStorageBasePath, conversationId);

    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      this.logger.log(`Created session directory: ${sessionDir}`);
    }

    const fileLinks: string[] = [];

    for (const fileId of fileIds) {
      try {
        // Get file content from file manager
        const fileBuffer = await this.fileManagerService.get(fileId);

        // Generate filename: {conversation-id}-{subintent}-{fromDate}-{toDate}.json
        const subIntent = queryParams.queryName;
        const fromDate = this.formatDateForFilename(
          queryParams.subject.startDate,
        );
        const toDate = this.formatDateForFilename(queryParams.subject.endDate);

        // Remove .json from fileId if it exists to avoid double extension
        const cleanFileId = fileId.replace(/\.json$/, '');

        const fileName = `${conversationId}-${subIntent}-${fromDate}-${toDate}.json`;
        const filePath = path.join(sessionDir, fileName);

        // Write file to session directory
        fs.writeFileSync(filePath, fileBuffer);

        // Create file link
        const fileLink = `file:///file-storage/session-public/${conversationId}/${fileName}`;
        fileLinks.push(fileLink);

        this.logger.log(`Moved file ${fileId} to ${filePath}`);
      } catch (error) {
        this.logger.error(`Failed to move file ${fileId}: ${error.message}`);
        throw error;
      }
    }

    return fileLinks;
  }

  private async sendFileLinksMessage(
    fileLinks: string[],
    conversationId: string,
    originalQuery: string,
  ): Promise<void> {
    const linksText = fileLinks
      .map((link, index) => `${index + 1}. ${link}`)
      .join('\n');
    const messageContent = `Sumo Logic report files generated for query: "${originalQuery}"\n\nFiles:\n${linksText}`;

    await this.chatManagerService.addMessage({
      content: {
        type: 'text/plain',
        payload: messageContent,
      },
      conversationId: conversationId,
      fromUserId: null,
      fromRole: UserRole.SYSTEM,
      toRole: UserRole.USER,
    });

    this.logger.log(
      `Sent file links message to conversation ${conversationId}`,
    );
  }

  private async processObservationsAndSendResults(
    processedDataList: any[],
    conversationId: string,
  ): Promise<void> {
    for (const processedData of processedDataList) {
      try {
        // Select appropriate observation maker based on query type
        let observationMaker;
        if (processedData.queryName === 'submitActionReport') {
          observationMaker = new ObservationMakerSumoSubmitActionJobReport();
        } else {
          // Default to original observation maker for submissionCreatedForForm and others
          observationMaker = new ObservationMakerSumoReport();
        }

        const context = {
          resources: {
            sumoNamedQuery: processedData,
          },
        };

        const observationResult =
          await observationMaker.makeObservation(context);

        // Convert log items to text
        const observationText = observationResult.logItems
          .map((item) => item.messageSecondary)
          .join('\n');

        // Determine if this is small context (1 record) or large context (>1 record)
        const recordCount = processedData.records?.length || 0;
        const isSmallContext = recordCount <= 1;

        // Send observation results
        await this.chatManagerService.addMessage({
          content: {
            type: 'context/document',
            payload: observationText,
          },
          conversationId: conversationId,
          fromUserId: null,
          fromRole: UserRole.SYSTEM,
          toRole: isSmallContext ? UserRole.ROBOT : UserRole.USER,
        });

        this.logger.log(
          `Sent observation results to conversation ${conversationId} (toRole: ${isSmallContext ? 'ROBOT' : 'USER'})`,
        );
      } catch (error) {
        this.logger.error(`Failed to process observations: ${error.message}`);
        throw error;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
