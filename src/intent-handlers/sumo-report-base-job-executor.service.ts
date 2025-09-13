import { Injectable, Logger } from '@nestjs/common';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import {
  FileManagerService,
  STORAGE_CLASS,
} from '../file-manager/file-manager.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { UserRole } from '../chat-manager/dto/create-message.dto';
import { ObservationMakerSumoSubmitActionJobReport } from './ObservationMakerSumoSubmitActionJobReport';
import { ObservationMakerSumoReport } from './ObservationMakerSumoQuery';

export interface SumoJobParams {
  queryName: string;
  subject: {
    formId: string;
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
      submitActionsSelectedForExecution: 'submitActionsSelectedForExecution',
    };
    return mapping[subIntent] || 'submitActionReport';
  }

  protected async submitAndFetchData(
    queryParams: SumoJobParams,
  ): Promise<string> {
    this.logger.log(`Submitting Sumo query: ${queryParams.queryName}`);

    // Submit query and wait for completion - returns fileId
    const fileId =
      await this.iStackInfoService.sumoReport.submitQueryAndWait(queryParams);

    this.logger.log(`Got fileId from completed job: ${fileId}`);

    const fileResponse =
      await this.iStackInfoService.sumoReport.files.get(fileId);

    // Download and store file
    if (!fileResponse.downloadUrl) {
      throw new Error('No download URL provided for file');
    }
    const response = await fetch(fileResponse.downloadUrl);
    const fileContent = await response.text();

    const localFileId = await this.fileManagerService.put(
      {
        content: fileContent,
        contentType: 'application/json', // I am not 100% sure it's json. It maybe stringify json within csv
      },
      STORAGE_CLASS.TEMP,
    );

    return localFileId;
  }

  protected async moveFileToSessionPublic(
    fileId: string,
    conversationId: string,
    queryParams: SumoJobParams,
  ): Promise<string> {
    const fileBuffer = await this.fileManagerService.get(fileId);

    const timestamp = this.formatDateForFilename(new Date().toISOString());
    const filename = `sumo-${queryParams.queryName}-${queryParams.subject.formId}-${timestamp}.json`;

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
    return `/files/session-public/${conversationId}/${filename}`;
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
