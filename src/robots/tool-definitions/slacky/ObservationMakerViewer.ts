import {
  ObservationMakers,
  EObservationSubjectType,
} from 'istack-buddy-utilities';

import type {
  IObservationResult,
  IObservationLogItem,
  IObservationContext,
} from 'istack-buddy-utilities';

/**
 * ObservationMakerViewer - Extends ObservationMaker for display purposes
 * Filters and formats observations for Slack display
 */
export class ObservationMakerViewer extends ObservationMakers.AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FORM;
  protected observationClass = this.constructor.name;
  protected messagePrimary = 'Observation Viewer';
  private logItems: IObservationLogItem[] = [];

  constructor() {
    super();
  }

  public getRequiredResources(): string[] {
    return ['formModel'];
  }

  public async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    // This is a viewer class, not a real observation maker
    // It just displays existing observation results
    return { isObservationTrue: true, logItems: this.logItems };
  }

  public setLogItems(logItems: IObservationLogItem[]): void {
    this.logItems = logItems;
  }

  /**
   * Create an ObservationMakerViewer from observation results
   */
  public static fromObservationResults(
    observationMakerResult: any,
  ): ObservationMakerViewer {
    const viewer = new ObservationMakerViewer();

    console.log('ObservationMakerViewer.fromObservationResults called with:', {
      hasResult: !!observationMakerResult,
      hasResponse: !!(
        observationMakerResult && observationMakerResult.response
      ),
      resultType: typeof observationMakerResult,
      responseType: observationMakerResult?.response
        ? typeof observationMakerResult.response
        : 'undefined',
    });

    // Extract log items from the observation result
    if (observationMakerResult && observationMakerResult.response) {
      const logItems = viewer.extractLogItems(observationMakerResult.response);
      viewer.setLogItems(logItems);

      console.log('Extracted log items:', {
        count: logItems.length,
        logItems: JSON.stringify(logItems.slice(0, 2), null, 2),
      });
    } else {
      console.log('No valid observation maker result found');
    }

    return viewer;
  }

  private extractLogItems(response: any): any[] {
    const logItems = [] as any[];

    console.log('extractLogItems called with:', {
      responseType: typeof response,
      isArray: Array.isArray(response),
      hasLogItems: !!(response && response.logItems),
      hasObservations: !!(response && response.observations),
      hasData: !!(response && response.data),
      responseKeys:
        response && typeof response === 'object' ? Object.keys(response) : [],
    });

    // Handle different response structures
    if (response && response.logItems && Array.isArray(response.logItems)) {
      console.log(
        'Extracting from response.logItems, length:',
        response.logItems.length,
      );
      logItems.push(...response.logItems);
    } else if (Array.isArray(response)) {
      console.log('Extracting from array response, length:', response.length);
      logItems.push(...response);
    } else if (
      response &&
      response.observations &&
      Array.isArray(response.observations)
    ) {
      console.log(
        'Extracting from response.observations, length:',
        response.observations.length,
      );
      logItems.push(...response.observations);
    } else if (response && response.data && Array.isArray(response.data)) {
      console.log(
        'Extracting from response.data, length:',
        response.data.length,
      );
      logItems.push(...response.data);
    } else if (typeof response === 'object') {
      console.log('Extracting single observation object');
      logItems.push(response);
    } else {
      console.log('No valid observation structure found');
    }

    console.log('Final log items count:', logItems.length);
    return logItems;
  }

  /**
   * Get only warning and error log items
   */
  public getWarningsAndErrors(): any[] {
    return this.logItems.filter(
      (item) => item.logLevel === 'warn' || item.logLevel === 'error',
    );
  }

  /**
   * Get log items by level
   */
  public getLogItemsByLevel(level: string): any[] {
    return this.logItems.filter((item) => item.logLevel === level);
  }

  /**
   * Get all log items
   */
  public getAllLogItems(): any[] {
    return this.logItems;
  }

  /**
   * Get the observation class name
   */
  public getObservationClassName(): string {
    return this.observationClass;
  }

  /**
   * Format log items for Slack display
   */
  public formatForSlack(): string {
    const warningsAndErrors = this.getWarningsAndErrors();

    if (warningsAndErrors.length === 0) {
      return '✅ *No issues found* - All validations passed successfully!';
    }

    let formatted = `⚠️ *Found ${warningsAndErrors.length} issue(s):*\n\n`;

    warningsAndErrors.forEach((item, index) => {
      const emoji = item.logLevel === 'error' ? '❌' : '⚠️';
      const level = item.logLevel === 'error' ? 'ERROR' : 'WARNING';

      formatted += `${emoji} *${level}* (${index + 1}/${warningsAndErrors.length})\n`;

      // Use messageSecondary as the primary message (capped at 150 characters)
      if (item.messageSecondary) {
        const truncatedMessage = this.truncateMessage(item.messageSecondary);
        formatted += `• *Message:* ${truncatedMessage}\n`;
      }

      if (item.subjectId) {
        formatted += `• *Subject ID:* \`${item.subjectId}\`\n`;
      }

      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Format all log items for Slack display (including info and debug)
   */
  public formatAllForSlack(): string {
    if (this.logItems.length === 0) {
      return '📝 *No log items found*';
    }

    let formatted = `📊 *All Log Items (${this.logItems.length} total):*\n\n`;

    this.logItems.forEach((item, index) => {
      const emoji = this.getEmojiForLevel(item.logLevel);
      const level = item.logLevel.toUpperCase();

      formatted += `${emoji} *${level}* (${index + 1}/${this.logItems.length})\n`;

      // Use messageSecondary as the primary message (capped at 150 characters)
      if (item.messageSecondary) {
        const truncatedMessage = this.truncateMessage(item.messageSecondary);
        formatted += `• *Message:* ${truncatedMessage}\n`;
      }

      if (item.subjectId) {
        formatted += `• *Subject ID:* \`${item.subjectId}\`\n`;
      }

      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Get emoji for log level
   */
  private getEmojiForLevel(level: string): string {
    switch (level) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔍';
      default:
        return '📝';
    }
  }

  /**
   * Truncate message to specified length with ellipsis
   */
  private truncateMessage(message: string, maxLength: number = 150): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get summary statistics
   */
  public getSummary(): string {
    const total = this.logItems.length;
    const errors = this.logItems.filter(
      (item) => item.logLevel === 'error',
    ).length;
    const warnings = this.logItems.filter(
      (item) => item.logLevel === 'warn',
    ).length;
    const info = this.logItems.filter(
      (item) => item.logLevel === 'info',
    ).length;
    const debug = this.logItems.filter(
      (item) => item.logLevel === 'debug',
    ).length;

    return (
      `📊 *Summary:* ${total} total log items\n` +
      `• ❌ ${errors} errors\n` +
      `• ⚠️ ${warnings} warnings\n` +
      `• ℹ️ ${info} info\n` +
      `• 🔍 ${debug} debug`
    );
  }
}
