import {
  ObservationMakers,
  EObservationSubjectType,
  ELogLevel,
} from 'istack-buddy-utilities';

import type {
  IObservationContext,
  IObservationResult,
  IObservationLogItem,
} from 'istack-buddy-utilities';

// Local constant for the new subject type since we can't modify the external package
const SUMO_REPORT_SUBMISSION_CREATION = 'SUMO_REPORT_SUBMISSION_CREATION';

// Define the structure of Sumo query result data
interface ISumoQueryRecord {
  [key: string]: any;
}

interface ISumoRecordSchema {
  [fieldName: string]: {
    type: string;
    example: any;
  };
}

interface ISumoTimeRange {
  from: string;
  to: string;
}

interface ISumoNamedQuery {
  executedQuery: string;
  recordSchema: ISumoRecordSchema;
  records: ISumoQueryRecord[];
  messageCount: number;
  queryName: string;
  arguments: string[];
  timeRange: ISumoTimeRange;
  validationNote: string;
}

// Simplified - only focusing on submission-specific analysis

class ObservationMakerSumoReport extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = SUMO_REPORT_SUBMISSION_CREATION as any; // Custom subject type for Sumo reports
  protected observationClass = 'ObservationMakerSumoReport';
  protected observationClassName = 'ObservationMakerSumoReport' as any;
  protected messagePrimary = 'Sumo Report Analysis';

  // Remove field type counting - not needed for submission analysis

  constructor() {
    super();
  }

  getRequiredResources(): any {
    return ['sumoNamedQuery'];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    const logItems: IObservationLogItem[] = [];
    const sumoQuery: ISumoNamedQuery = context.resources.sumoNamedQuery;

    if (!sumoQuery) {
      const logItem: IObservationLogItem = this.createErrorLogItem(context, {
        subjectId: 'sumo-query',
        messageSecondary: 'No sumoNamedQuery resource provided',
        relatedEntityIds: [],
      });
      logItems.push(logItem);
      return { isObservationTrue: false, logItems } as IObservationResult;
    }

    // Guard: if records are missing or empty, emit INFO and exit gracefully
    if (!sumoQuery.records || sumoQuery.records.length === 0) {
      const infoItem: IObservationLogItem = this.createInfoLogItem(context, {
        subjectId: sumoQuery?.queryName || 'sumo-query',
        messageSecondary:
          'No records returned for this query. Skipping observation analysis.',
        relatedEntityIds: [],
      });
      logItems.push(infoItem);
      return { isObservationTrue: true, logItems } as IObservationResult;
    }

    // Skip schema analysis - only focus on submission-specific metrics

    // Analyze submission-specific metrics
    this.analyzeSubmissionMetrics(
      sumoQuery.records,
      context,
      logItems,
      sumoQuery.queryName,
    );

    // Generate summary observations
    this.generateSummaryObservations(sumoQuery, context, logItems);

    return { isObservationTrue: true, logItems } as IObservationResult;
  }

  private analyzeSubmissionMetrics(
    records: ISumoQueryRecord[],
    context: IObservationContext,
    logItems: IObservationLogItem[],
    queryName?: string,
  ): void {
    if (!records || records.length === 0) {
      return;
    }

    // Analyze unique IPs
    const uniqueIps = new Set<string>();
    const partialSubmissions = { true: 0, false: 0 };
    const uniqueReferrers = new Set<string>();
    const submissionMethods = new Map<string, number>();

    records.forEach((record) => {
      // Track unique IPs
      if (
        record.ip &&
        typeof record.ip === 'string' &&
        record.ip.trim() !== ''
      ) {
        uniqueIps.add(record.ip);
      }

      // Track partial submissions
      if (typeof record.isPartialSubmission === 'boolean') {
        partialSubmissions[
          record.isPartialSubmission.toString() as 'true' | 'false'
        ]++;
      }

      // Track unique referrers
      if (
        record.referrer &&
        typeof record.referrer === 'string' &&
        record.referrer.trim() !== ''
      ) {
        uniqueReferrers.add(record.referrer);
      }

      // Track submission methods
      if (
        record.submissionMethod &&
        typeof record.submissionMethod === 'string'
      ) {
        const method = record.submissionMethod;
        submissionMethods.set(method, (submissionMethods.get(method) || 0) + 1);
      }
    });

    // Log unique IPs
    if (!queryName) {
      throw new Error('queryName is required - no fallbacks allowed');
    }
    const uniqueIpLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: `${queryName}:line-item`,
        messageSecondary: `Number of unique IP addresses: ${uniqueIps.size}`,
        relatedEntityIds: Array.from(uniqueIps).slice(0, 10), // Limit to first 10 for display
      },
    );
    logItems.push(uniqueIpLogItem);

    // Log partial submissions
    const totalPartialTrue = partialSubmissions.true;
    const totalPartialFalse = partialSubmissions.false;
    const partialPercentage =
      records.length > 0
        ? ((totalPartialTrue / records.length) * 100).toFixed(1)
        : '0';

    const partialLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: `${queryName}:line-item`,
        messageSecondary: `Partial submissions: ${totalPartialTrue} (${partialPercentage}%), Complete submissions: ${totalPartialFalse}`,
        relatedEntityIds: [],
      },
    );
    logItems.push(partialLogItem);

    // Log unique referrers
    const uniqueReferrerLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: `${queryName}:line-item`,
        messageSecondary: `Number of unique referrers: ${uniqueReferrers.size}`,
        relatedEntityIds: Array.from(uniqueReferrers).slice(0, 10), // Limit to first 10 for display
      },
    );
    logItems.push(uniqueReferrerLogItem);

    // Log submission methods
    if (submissionMethods.size > 0) {
      const methodCounts = Array.from(submissionMethods.entries())
        .map(([method, count]) => `${method}: ${count}`)
        .join(', ');

      const methodLogItem: IObservationLogItem = this.createInfoLogItem(
        context,
        {
          subjectId: `${queryName}:line-item`,
          messageSecondary: `Submission methods - ${methodCounts}`,
          relatedEntityIds: Array.from(submissionMethods.keys()),
        },
      );
      logItems.push(methodLogItem);
    }
  }

  private generateSummaryObservations(
    sumoQuery: ISumoNamedQuery,
    context: IObservationContext,
    logItems: IObservationLogItem[],
  ): void {
    if (!sumoQuery.queryName) {
      throw new Error('sumoQuery.queryName is required - no fallbacks allowed');
    }

    // Number of records (submissions)
    const recordCountLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: sumoQuery.queryName,
        messageSecondary: `Number of records (submissions): ${sumoQuery.records.length}`,
        relatedEntityIds: [],
      },
    );
    logItems.push(recordCountLogItem);

    // File size estimation
    const dataString = JSON.stringify(sumoQuery);
    const fileSizeBytes = new Blob([dataString]).size;
    const fileSizeKB = (fileSizeBytes / 1024).toFixed(2);
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

    let fileSizeDisplay = `${fileSizeBytes} bytes`;
    if (fileSizeBytes > 1024 * 1024) {
      fileSizeDisplay = `${fileSizeMB} MB`;
    } else if (fileSizeBytes > 1024) {
      fileSizeDisplay = `${fileSizeKB} KB`;
    }

    const fileSizeLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: sumoQuery.queryName,
        messageSecondary: `File size: ${fileSizeDisplay}`,
        relatedEntityIds: [],
      },
    );
    logItems.push(fileSizeLogItem);

    // Estimated token count (rough estimation: ~4 characters per token)
    const estimatedTokens = Math.ceil(dataString.length / 4);
    const tokenLogItem: IObservationLogItem = this.createInfoLogItem(context, {
      subjectId: sumoQuery.queryName,
      messageSecondary: `Estimated token count: ${estimatedTokens.toLocaleString()}`,
      relatedEntityIds: [],
    });
    logItems.push(tokenLogItem);

    // Original query
    const queryLogItem: IObservationLogItem = this.createInfoLogItem(context, {
      subjectId: sumoQuery.queryName,
      messageSecondary: `Original query: ${sumoQuery.executedQuery?.substring(0, 100)}${sumoQuery.executedQuery && sumoQuery.executedQuery.length > 100 ? '...' : ''}`,
      relatedEntityIds: [],
    });
    logItems.push(queryLogItem);

    // Start/end date
    const dateRangeLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: sumoQuery.queryName,
        messageSecondary: `Time range: ${sumoQuery.timeRange.from} to ${sumoQuery.timeRange.to}`,
        relatedEntityIds: [],
      },
    );
    logItems.push(dateRangeLogItem);

    // Query metadata summary
    const metadataLogItem: IObservationLogItem = this.createInfoLogItem(
      context,
      {
        subjectId: sumoQuery.queryName,
        messageSecondary: `Query '${sumoQuery.queryName}' returned ${sumoQuery.messageCount} total records from Sumo Logic`,
        relatedEntityIds: sumoQuery.arguments,
      },
    );
    logItems.push(metadataLogItem);

    // Add validation note if present
    if (sumoQuery.validationNote) {
      const validationLogItem: IObservationLogItem = this.createInfoLogItem(
        context,
        {
          subjectId: sumoQuery.queryName,
          messageSecondary: sumoQuery.validationNote,
          relatedEntityIds: [],
        },
      );
      logItems.push(validationLogItem);
    }
  }
}

export { ObservationMakerSumoReport };
