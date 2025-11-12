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
  subjects: {
    formId?: string[];
    submitActionId?: string[];
    submitActionType?: string[];
    submissionId?: string[];
    authProviderId?: string[];
    accountId?: string[];
  };
  dateRange: {
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
      theHinkyReport: 'theHinkyReport',
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
    this.logger.log(`Stored results to TEMP with fileId=${localFileId}`);

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
            // Get results with small retry/backoff to handle eventual consistency
            const maxFetchAttempts = 8;
            const backoffMs = 750;
            for (let i = 1; i <= maxFetchAttempts; i++) {
              try {
                const resultsResponse =
                  await this.iStackInfoService.sumoReport.jobs.getResults(
                    jobId,
                  );
                this.logger.log(
                  `Fetched results for job ${jobId} on attempt ${i} with ${(resultsResponse as any).records?.length || 0} records`,
                );
                resolve(resultsResponse);
                return;
              } catch (fetchErr: any) {
                const errMsg = fetchErr?.message || String(fetchErr);
                this.logger.warn(
                  `Results fetch not ready (job ${jobId}) attempt ${i}/${maxFetchAttempts}: ${errMsg}`,
                );
                if (i === maxFetchAttempts) {
                  reject(
                    new Error(
                      `Results not available after completion (job ${jobId}) after ${maxFetchAttempts} attempts`,
                    ),
                  );
                  return;
                }
                // Wait with linear backoff before retrying
                await new Promise((r) => setTimeout(r, backoffMs * i));
              }
            }
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
      queryParams.subjects.formId?.[0] ||
      queryParams.subjects.submitActionId?.[0] ||
      queryParams.subjects.submissionId?.[0] ||
      queryParams.subjects.accountId?.[0] ||
      queryParams.subjects.authProviderId?.[0] ||
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
    const publicUrl = `${baseUrl}/files/session-public/${conversationId}/${filename}`;
    this.logger.log(
      `Moved Sumo results to session-public path=${filePath} url=${publicUrl}`,
    );
    return publicUrl;
  }

  protected async processJobData(
    fileId: string,
    queryName: string,
  ): Promise<ProcessedSumoData> {
    const fileBuffer = await this.fileManagerService.get(fileId);
    const raw = JSON.parse(fileBuffer.toString());

    // Normalize various shapes into a common structure
    const executedQuery = raw.executedQuery || raw.results?.executedQuery || '';
    const recordSchema = raw.recordSchema || raw.results?.recordSchema || {};
    const records = raw.records || raw.results?.records || raw.results || [];
    const messageCount =
      raw.messageCount ||
      raw.recordCount ||
      (Array.isArray(records) ? records.length : 0);
    const argumentsList = raw.arguments || raw.results?.arguments || [];
    const timeRange = raw.timeRange ||
      raw.results?.timeRange || { from: '', to: '' };
    const validationNote =
      raw.validationNote || raw.results?.validationNote || '';

    return {
      executedQuery,
      recordSchema,
      records: Array.isArray(records) ? records : [],
      messageCount,
      queryName,
      arguments: Array.isArray(argumentsList) ? argumentsList : [],
      timeRange,
      validationNote,
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

  /**
   * Normalize date range for relative time expressions like "past 24 hours"
   * Converts relative time expressions to actual date ranges relative to current time
   */
  protected normalizeRelativeDateRange(
    dateRange: { startDate?: string; endDate?: string },
    originalPrompt: string,
  ): { startDate: string; endDate: string } {
    if (!dateRange.startDate || !dateRange.endDate) {
      return {
        startDate: dateRange.startDate || '',
        endDate: dateRange.endDate || '',
      };
    }

    // Check if the prompt contains relative time expressions
    const relativeTimePattern =
      /past\s+(\d+)\s+(hour|hours|hr|hrs|h)\b/i;
    const match = originalPrompt.match(relativeTimePattern);

    if (match) {
      const hours = parseInt(match[1], 10);
      if (!isNaN(hours) && hours > 0) {
        // Calculate relative to current time in Eastern Time
        // End date: now() + 1 second
        const endDate = this.getCurrentEasternTimeISO(1);
        // Start date: now() - hours + 1 second
        const startDate = this.calculateEasternTimeISO(hours, 0, 1);

        this.logger.log(
          `Normalized relative time range: "past ${hours} hours" -> ${startDate} to ${endDate}`,
        );

        return { startDate, endDate };
      }
    }

    // Check for "past X days" - but only normalize if it's using day boundaries incorrectly
    const pastDaysPattern = /past\s+(\d+)\s+(day|days|d)\b/i;
    const daysMatch = originalPrompt.match(pastDaysPattern);

    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      if (!isNaN(days) && days > 0) {
        // For "past X days", check if the date range is using day boundaries (00:00:01 to 23:59:59)
        // If so, recalculate relative to current time
        const startDateObj = new Date(dateRange.startDate);
        const endDateObj = new Date(dateRange.endDate);

        // Check if startDate is at 00:00:01 and endDate is at 23:59:59 (day boundaries)
        const isUsingDayBoundaries =
          startDateObj.getHours() === 0 &&
          startDateObj.getMinutes() === 0 &&
          startDateObj.getSeconds() <= 1 &&
          endDateObj.getHours() === 23 &&
          endDateObj.getMinutes() === 59 &&
          endDateObj.getSeconds() >= 59;

        if (isUsingDayBoundaries) {
          // Recalculate relative to current time
          const endDate = this.getCurrentEasternTimeISO(1);
          const startDate = this.calculateEasternTimeISO(0, days, 1);

          this.logger.log(
            `Normalized relative time range: "past ${days} days" -> ${startDate} to ${endDate}`,
          );

          return { startDate, endDate };
        }
      }
    }

    // No normalization needed, return as-is
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
  }

  /**
   * Get current time in Eastern Time and format as ISO 8601 with timezone offset
   */
  private getCurrentEasternTimeISO(addSeconds: number = 0): string {
    const now = new Date();
    
    // Get Eastern Time components using Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    let hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    let minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    let seconds = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10) + addSeconds;

    // Handle second overflow
    if (seconds >= 60) {
      minutes += Math.floor(seconds / 60);
      seconds = seconds % 60;
    }
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }
    if (hours >= 24) {
      // This shouldn't happen with our use case, but handle it by adding a day
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      return this.getCurrentEasternTimeISO(seconds);
    }

    // Determine timezone offset (EDT: -04:00, EST: -05:00)
    // Check if the date is in DST for Eastern Time
    // DST in US typically runs from second Sunday in March to first Sunday in November
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    
    // Simple heuristic: roughly April through October is EDT
    // More precise would require calculating specific DST transition dates
    // For most use cases, this approximation is sufficient
    let isEDT = false;
    if (monthNum >= 4 && monthNum <= 10) {
      isEDT = true;
    } else if (monthNum === 3) {
      // March: DST starts on second Sunday (roughly day 8-14)
      isEDT = dayNum >= 8;
    } else if (monthNum === 11) {
      // November: DST ends on first Sunday (roughly day 1-7)
      isEDT = dayNum < 7;
    }
    
    const offset = isEDT ? '-04:00' : '-05:00';

    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');

    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}:${secondsStr}${offset}`;
  }

  /**
   * Calculate a date in Eastern Time by subtracting hours/days from current time
   */
  private calculateEasternTimeISO(
    subtractHours: number = 0,
    subtractDays: number = 0,
    addSeconds: number = 0,
  ): string {
    const now = new Date();
    
    // Create a date object representing Eastern Time
    // Use Intl to get Eastern Time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Calculate the target time
    const targetDate = new Date(now);
    targetDate.setHours(targetDate.getHours() - subtractHours);
    targetDate.setDate(targetDate.getDate() - subtractDays);

    // Get Eastern Time components for the target date
    const parts = formatter.formatToParts(targetDate);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    let hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    let minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    let seconds = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10) + addSeconds;

    // Handle second overflow
    if (seconds >= 60) {
      minutes += Math.floor(seconds / 60);
      seconds = seconds % 60;
    }
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }
    if (hours >= 24) {
      // Add a day and recalculate
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return this.calculateEasternTimeISO(0, 0, seconds);
    }

    // Determine timezone offset (EDT: -04:00, EST: -05:00)
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    
    // Simple heuristic: roughly April through October is EDT
    let isEDT = false;
    if (monthNum >= 4 && monthNum <= 10) {
      isEDT = true;
    } else if (monthNum === 3) {
      // March: DST starts on second Sunday (roughly day 8-14)
      isEDT = dayNum >= 8;
    } else if (monthNum === 11) {
      // November: DST ends on first Sunday (roughly day 1-7)
      isEDT = dayNum < 7;
    }
    
    const offset = isEDT ? '-04:00' : '-05:00';

    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');

    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}:${secondsStr}${offset}`;
  }
}
