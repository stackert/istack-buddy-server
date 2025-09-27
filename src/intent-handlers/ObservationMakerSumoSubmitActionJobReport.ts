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

// Local constant for the new subject type
const SUMO_REPORT_SUBMIT_ACTION = 'SUMO_REPORT_SUBMIT_ACTION';

// Define the structure of Submit Action query result data
interface ISubmitActionRecord {
  message: string;
  workerName: string;
  accountId: string;
  formId: string;
  submitActionId: string;
  type: string; // webhook, default, amazons3internal, etc.
  submissionId: string | number;
  jobDelay: number;
  jobDurationSeconds: number;
  jobPriority: string;
  jobQueueName: string;
  jobName: string;
  event: string; // submitaction_run
  errorId: string;
  datetime: string;
}

interface ISumoSubmitActionQuery {
  executedQuery: string;
  recordSchema: any;
  records: ISubmitActionRecord[];
  messageCount: number;
  queryName: string;
  arguments: string[];
  timeRange: {
    from: string;
    to: string;
  };
  validationNote: string;
}

class ObservationMakerSumoSubmitActionJobReport extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = SUMO_REPORT_SUBMIT_ACTION as any;
  protected observationClass = 'ObservationMakerSumoSubmitActionJobReport';
  protected observationClassName =
    'ObservationMakerSumoSubmitActionJobReport' as any;
  protected messagePrimary = 'Submit Action Job Report Analysis';

  getRequiredResources(): any {
    return ['sumoNamedQuery'];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    const sumoData = context.resources
      ?.sumoNamedQuery as ISumoSubmitActionQuery;
    const logItems: IObservationLogItem[] = [];

    if (!sumoData || !sumoData.records) {
      const logItem = this.createErrorLogItem(context, {
        subjectId: 'submit-action-query',
        messageSecondary: 'No submit action data provided',
        relatedEntityIds: [],
      });
      logItems.push(logItem);
      return { isObservationTrue: false, logItems } as IObservationResult;
    }

    // Total number of records
    const totalRecords = sumoData.records.length;
    const summaryLogItem = this.createInfoLogItem(context, {
      subjectId: 'submit-action-summary',
      messageSecondary: `Total submit action events: ${totalRecords}`,
      relatedEntityIds: [],
    });
    logItems.push(summaryLogItem);

    // Break down by submit action type
    const typeBreakdown = this.analyzeSubmitActionTypes(sumoData.records);

    for (const [type, count] of Object.entries(typeBreakdown)) {
      const typeLogItem = this.createInfoLogItem(context, {
        subjectId: 'submit-action-type',
        messageSecondary: `${type}: ${count}`,
        relatedEntityIds: [],
      });
      logItems.push(typeLogItem);
    }

    // Time range analysis
    if (sumoData.timeRange) {
      const timeRangeLogItem = this.createInfoLogItem(context, {
        subjectId: 'report-time-range',
        messageSecondary: `From: ${sumoData.timeRange.from} | To: ${sumoData.timeRange.to}`,
        relatedEntityIds: [],
      });
      logItems.push(timeRangeLogItem);
    }

    // Form ID analysis
    const formIds = [...new Set(sumoData.records.map((r) => r.formId))];
    const formLogItem = this.createInfoLogItem(context, {
      subjectId: 'forms-analyzed',
      messageSecondary: `Form IDs: ${formIds.join(', ')}`,
      relatedEntityIds: [],
    });
    logItems.push(formLogItem);

    return { isObservationTrue: true, logItems } as IObservationResult;
  }

  private analyzeSubmitActionTypes(
    records: ISubmitActionRecord[],
  ): Record<string, number> {
    const typeCount: Record<string, number> = {};

    for (const record of records) {
      const type = record.type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    }

    return typeCount;
  }
}

export { ObservationMakerSumoSubmitActionJobReport };
