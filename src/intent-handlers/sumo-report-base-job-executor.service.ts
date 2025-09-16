import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import {
  FileManagerService,
  STORAGE_CLASS,
} from '../file-manager/file-manager.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { ObservationMakerSumoReport } from './ObservationMakerSumoQuery';
import { ObservationMakerSumoSubmitActionJobReport } from './ObservationMakerSumoSubmitActionJobReport';

export interface SumoJobParams {
  queryName: string;
  subject: {
    formId?: string;
    submitActionId?: string;
    submitActionType?: string;
    submissionId?: string;
    startDate: string;
    endDate: string;
  };
}

export interface ProcessedSumoData {
  executedQuery: string;
  recordSchema: any;
  records: any[];
  messageCount: number;
  queryName: string;
  arguments: string[];
  timeRange: {
    from: string;
    to: string;
  };
  validationNote: string;
}

@Injectable()
export abstract class SumoReportBaseJobExecutor {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly iStackInfoService: IStackInfoService,
    protected readonly fileManagerService: FileManagerService,
    protected readonly chatManagerService: ChatManagerService,
  ) {}

  protected mapSubIntentToQueryName(subIntent: string): string {
    const mapping: Record<string, string> = {
      submitActionReport: 'submitActionReport',
      submissionCreatedForForm: 'submissionCreatedForForm',
      submitActionSelectedForExecution: 'submitActionSelectedForExecution',
      authProviderMetrics: 'authProviderMetrics',
    };
    return mapping[subIntent] || 'submitActionReport';
  }

  protected async submitAndFetchData(
    queryParams: SumoJobParams,
  ): Promise<string> {
    this.logger.log(`Submitting Sumo query: ${queryParams.queryName}`);

    // Use direct API call with non-blocking polling (truly concurrent)
    const resultsResponse =
      await this.submitQueryWithNonBlockingPoll(queryParams);

    this.logger.log(
      `Got results with ${(resultsResponse as any).records?.length || 0} records`,
    );

    // Store the results as JSON file
    const fileContent = JSON.stringify(resultsResponse, null, 2);

    const localFileId = await this.fileManagerService.put(
      {
        content: fileContent,
        contentType: 'application/json',
      },
      STORAGE_CLASS.TEMP,
    );

    return localFileId;
  }

  private async submitQueryWithNonBlockingPoll(
    queryParams: SumoJobParams,
  ): Promise<any> {
    // Submit the query
    const submissionResponse =
      await this.iStackInfoService.sumoReport.submitQuery(queryParams);
    const jobId = submissionResponse.jobId;

    this.logger.debug(
      `Sumo job submitted: ${jobId}, starting non-blocking poll`,
    );

    // Non-blocking polling using Promise + setTimeout
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes
      const pollIntervalMs = 1000;

      const checkStatus = async () => {
        try {
          attempts++;
          const statusResponse =
            await this.iStackInfoService.sumoReport.jobs.getStatus(jobId);
          const status = statusResponse.status;

          if (attempts % 30 === 0) {
            this.logger.debug(
              `Job ${jobId} status: ${status} (attempt ${attempts}/${maxAttempts})`,
            );
          }

          if (status === 'completed') {
            // Get results and resolve
            const resultsResponse =
              await this.iStackInfoService.sumoReport.jobs.getResults(jobId);
            resolve(resultsResponse);
          } else if (status === 'failed') {
            reject(new Error(`Sumo job ${jobId} failed`));
          } else if (attempts >= maxAttempts) {
            const timeoutMinutes = Math.floor(
              (maxAttempts * pollIntervalMs) / 60000,
            );
            reject(
              new Error(
                `Sumo job ${jobId} timed out after ${attempts} attempts (${timeoutMinutes} minutes)`,
              ),
            );
          } else {
            // Schedule next check (NON-BLOCKING)
            setTimeout(checkStatus, pollIntervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };

      // Start polling
      checkStatus();
    });
  }

  protected async moveFileToSessionPublic(
    fileId: string,
    conversationId: string,
    queryParams: SumoJobParams,
  ): Promise<string> {
    const fileBuffer = await this.fileManagerService.get(fileId);

    const timestamp = this.formatDateForFilename(new Date().toISOString());
    const identifier =
      queryParams.subject.formId ||
      queryParams.subject.submitActionId ||
      queryParams.subject.submissionId ||
      'unknown';
    const filename = `sumo-${queryParams.queryName}-${identifier}-${timestamp}.json`;

    // Create session-public directory path (maintain existing structure)
    const sessionPublicDir = `file-storage-server/session-public/${conversationId}`;
    const filePath = `${sessionPublicDir}/${filename}`;

    // Write file directly (consistent with existing files)
    const fs = require('fs');
    const path = require('path');

    // Ensure directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Write file
    fs.writeFileSync(filePath, fileBuffer);

    // Generate proper public URL that will be served by FileController
    const baseUrl =
      process.env.ISTACK_BUDDY_BACKEND_SERVER_BASE_URL ||
      `http://localhost:${process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT || 3500}`;
    return `${baseUrl}/files/session-public/${conversationId}/${filename}`;
  }

  protected async processJobData(
    fileId: string,
    queryName: string,
  ): Promise<ProcessedSumoData> {
    const fileBuffer = await this.fileManagerService.get(fileId);
    const parsedData = JSON.parse(fileBuffer.toString());

    return {
      ...parsedData,
      queryName: queryName,
    };
  }

  protected async runObservationAnalysis(
    processedData: ProcessedSumoData,
  ): Promise<string> {
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

    const observationResult = await observationMaker.makeObservation(context);

    // Convert log items to text
    return observationResult.logItems
      .map((item: any) => item.messageSecondary)
      .join('\n');
  }

  protected formatDateForFilename(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}
