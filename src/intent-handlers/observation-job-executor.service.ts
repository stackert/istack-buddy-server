import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { ObservationMakerFieldCounts } from '../common/observation-makers/ObservationMakerFieldCounts';
import { ObservationMakerLogicValidation } from '../common/observation-makers/ObservationMakerLogicValidation';
import { ObservationMakerCalculationValidation } from '../common/observation-makers/ObservationMakerCalculationValidation';
import {
  Models,
  ELogLevel,
  ObservationMakers,
  IObservationExport,
} from 'istack-buddy-utilities';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';

const ObservationMakerReader = ObservationMakers.ObservationsReader;

// Load observation makers documentation at module level (build time)
let OBSERVATION_MAKERS_CONTENT: string;

try {
  OBSERVATION_MAKERS_CONTENT = readFileSync(
    join(process.cwd(), 'CONTEXT-DOCUMENTS', 'OBSERAVATION_MAKERS.md'),
    'utf-8',
  );
} catch (error) {
  throw new Error(`Failed to load OBSERAVATION_MAKERS.md: ${error.message}`);
}

@Injectable()
export class ObservationJobExecutor implements IntentHandler {
  private readonly logger = new Logger(ObservationJobExecutor.name);

  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly istackInfoService: IStackInfoService,
  ) {}

  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'makeObservations',
        subIntents: ['formObservations', 'authProviderObservations'],
        description: 'Make observations about forms or auth providers',
      },
    ];
  }

  async executeIntent(intentData: any): Promise<void> {
    const conversationId = intentData.conversationId;

    // Check if this is actually a makeObservations intent
    if (intentData.intent !== 'makeObservations') {
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `ERROR: Wrong intent routed to ObservationJobExecutor. Got: ${intentData.intent}`,
        },
      );
      return;
    }

    const formId = intentData.subjects?.formId?.[0];

    if (!formId) {
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload:
            `ERROR: No form ID found in intent data` +
            JSON.stringify(intentData),
        },
      );
      return;
    }

    try {
      // Get form data from API
      const formData =
        await this.istackInfoService.contextDynamic.getFormFieldsObservationsSource(
          { formId: parseInt(formId) },
        );

      // Create form model directly from the response (not wrapped)
      const formModel = new Models.FsModelForm(formData);

      // Run all three observation makers
      const fieldCountsMaker = new ObservationMakerFieldCounts();
      const logicValidationMaker = new ObservationMakerLogicValidation();
      const calculationValidationMaker =
        new ObservationMakerCalculationValidation();

      const context = { resources: { formModel } };

      // Get results from all three
      const export1 = await fieldCountsMaker.makeObservation(context);
      const export2 = await logicValidationMaker.makeObservation(context);
      const export3 = await calculationValidationMaker.makeObservation(context);

      // Accumulate log items properly
      const accumulator: IObservationExport = {
        observationMakerClassName: 'Accumulator',
        logItems: [],
        exportedAt: new Date().toISOString(),
        version: '0.0',
        metadata: undefined,
      };

      accumulator.logItems = accumulator.logItems.concat(export1.logItems);
      accumulator.logItems = accumulator.logItems.concat(export2.logItems);
      accumulator.logItems = accumulator.logItems.concat(export3.logItems);

      // Create reader from accumulated results
      const reader = ObservationMakerReader.fromObservationExport(accumulator);
      // Filter by log levels using enum
      const errors = reader.filterByLogLevel(ELogLevel.ERROR);
      const warnings = reader.filterByLogLevel(ELogLevel.WARN);
      const info = reader.filterByLogLevel(ELogLevel.INFO);
      const debug = reader.filterByLogLevel(ELogLevel.DEBUG);

      // Create summary matrix: summaryCounts[logLevel][message] = count
      const summaryCounts: Record<string, Record<string, number>> = {
        error: {},
        warn: {},
        info: {},
        debug: {},
      };

      // Count all observations by log level and message
      for (const item of accumulator.logItems) {
        const level = item.logLevel.toLowerCase();
        const message = item.message;
        if (!summaryCounts[level]) {
          summaryCounts[level] = {};
        }
        summaryCounts[level][message] =
          (summaryCounts[level][message] || 0) + 1;
      }

      // Format summary for display
      const formatSummarySection = (
        level: string,
        counts: Record<string, number>,
      ): string => {
        if (Object.keys(counts).length === 0) return '';
        const entries = Object.entries(counts)
          .map(([msg, count]) => `  "${msg}": ${count}`)
          .join('\n');
        return `\n${level.toUpperCase()}:\n${entries}`;
      };

      const summaryText = `Observation Summary Matrix:
Total Observations: ${accumulator.logItems.length}
By Level:
- Errors: ${errors.length}
- Warnings: ${warnings.length}
- Info: ${info.length}
- Debug: ${debug.length}
${formatSummarySection('error', summaryCounts.error)}${formatSummarySection('warn', summaryCounts.warn)}${formatSummarySection('info', summaryCounts.info)}${formatSummarySection('debug', summaryCounts.debug)}`;

      // Group warnings by message type (keep for backward compatibility)
      const warningGroups = warnings.reduce(
        (acc, item) => {
          const message = item.message;
          acc[message] = (acc[message] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Group errors by message type (keep for backward compatibility)
      const errorGroups = errors.reduce(
        (acc, item) => {
          const message = item.message;
          acc[message] = (acc[message] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // ALWAYS write observation file for user download (simple JSON, not pretty)
      const observationData = JSON.stringify({
        logItems: accumulator.logItems,
      });

      // Write to session-public directory
      const timestamp = Date.now();
      const filename = `observations-form-${formId}-${timestamp}.json`;
      const sessionPublicDir = path.join(
        'file-storage-server',
        'session-public',
        conversationId,
      );

      // Ensure directory exists
      fs.mkdirSync(sessionPublicDir, { recursive: true });

      // Write file
      const filePath = path.join(sessionPublicDir, filename);
      fs.writeFileSync(filePath, observationData);

      // Generate public URL
      const baseUrl =
        process.env.ISTACK_BUDDY_BACKEND_SERVER_BASE_URL ||
        `http://localhost:${process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT || 3500}`;
      const fileLink = `${baseUrl}/files/session-public/${conversationId}/${filename}`;

      this.logger.log(`Observation file written: ${filename}`);

      // ALWAYS add summary matrix to context (regardless of size)
      await this.chatManagerService.addMessageContextNoResponse(
        conversationId,
        {
          type: 'context/document',
          payload: summaryText,
        },
      );

      this.logger.log('Added observation summary matrix to context');

      // Calculate token counts for tiered context logic
      const allObservationsTokens = Math.ceil(observationData.length / 4);
      const errorsAndWarningsData = JSON.stringify({
        logItems: [...errors, ...warnings],
      });
      const errorsAndWarningsTokens = Math.ceil(
        errorsAndWarningsData.length / 4,
      );
      const docTokens = Math.ceil(OBSERVATION_MAKERS_CONTENT.length / 4);

      // Get robot's context window size (default to 128000 for GPT-4)
      const contextWindowSize = 128000;
      const contextThreshold = contextWindowSize * 0.75; // 75% threshold

      // Tiered context-add logic
      if (allObservationsTokens + docTokens < contextThreshold) {
        // Add ALL observations
        this.logger.log(
          `Adding all observations to context (${allObservationsTokens} tokens)`,
        );

        await this.chatManagerService.addMessageContextNoResponse(
          conversationId,
          {
            type: 'context/document',
            payload: observationData,
          },
        );

        await this.chatManagerService.addMessageContextNoResponse(
          conversationId,
          {
            type: 'context/document',
            payload: OBSERVATION_MAKERS_CONTENT,
          },
        );
      } else if (errorsAndWarningsTokens + docTokens < contextThreshold) {
        // Add ONLY errors and warnings
        this.logger.log(
          `Adding only errors and warnings to context (${errorsAndWarningsTokens} tokens)`,
        );

        await this.chatManagerService.addMessageContextNoResponse(
          conversationId,
          {
            type: 'context/document',
            payload: errorsAndWarningsData,
          },
        );

        await this.chatManagerService.addMessageContextNoResponse(
          conversationId,
          {
            type: 'context/document',
            payload: OBSERVATION_MAKERS_CONTENT,
          },
        );
      } else {
        // No observations in context due to size
        this.logger.warn(
          `Observation results too large for context (${allObservationsTokens} tokens). No observations added.`,
        );

        await this.chatManagerService.addMessageSystemNotification(
          conversationId,
          {
            type: 'text/markdown',
            payload: `⚠️ No observations added to context due to size (${allObservationsTokens.toLocaleString()} tokens).`,
          },
        );
      }

      // ALWAYS provide link to full observation file
      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `📊 **Full Observation Results:** [Download JSON](${fileLink})`,
        },
      );

      // Format error groups for display
      const errorGroupText = Object.entries(errorGroups)
        .map(([message, count]) => `  "${message}": ${count}`)
        .join('\n');

      // Format warning groups for display
      const warningGroupText = Object.entries(warningGroups)
        .map(([message, count]) => `  "${message}": ${count}`)
        .join('\n');

      // Send summary to user via robot response
      const summary = `Observations complete: ${accumulator.logItems.length} total items
• Errors: ${errors.length}
• Warnings: ${warnings.length}
• Info: ${info.length}
• Debug: ${debug.length}
${errorGroupText ? `Errors by type:\n${errorGroupText}` : ''}
${warningGroupText ? `Warnings by type:\n${warningGroupText}` : ''}
`;

      const userPrompt = intentData.originalUserPrompt || "the user's request";
      const robotPrompt = `We included the observation results, here some summary information, the user's original prompt, please respond however you see best.

User's original prompt: "${userPrompt}"

Observation Summary:
${summary}

Please provide a helpful response to the user based on the observation results and their original request.`;

      // Request robot response with the observation prompt
      await this.chatManagerService.addMessageToGetRobotResponse(
        conversationId,
        {
          type: 'text/plain',
          payload: robotPrompt,
        },
      );
    } catch (error) {
      await this.chatManagerService.addMessageErrorNotification(
        conversationId,
        {
          type: 'text/markdown',
          payload: `ERROR: ${error.message}`,
        },
      );
    }
  }
}
