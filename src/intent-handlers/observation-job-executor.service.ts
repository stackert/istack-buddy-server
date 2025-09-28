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

      // Group warnings by message type
      const warningGroups = warnings.reduce(
        (acc, item) => {
          const message = item.message;
          acc[message] = (acc[message] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Group errors by message type
      const errorGroups = errors.reduce(
        (acc, item) => {
          const message = item.message;
          acc[message] = (acc[message] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Send observation results as context to robot (no response solicited)
      await this.chatManagerService.addMessageContextNoResponse(
        conversationId,
        {
          type: 'context/document',
          payload: JSON.stringify({ logItems: accumulator.logItems }, null, 2),
        },
      );

      // Add observation makers documentation as context
      await this.chatManagerService.addMessageContextNoResponse(
        conversationId,
        {
          type: 'context/document',
          payload: OBSERVATION_MAKERS_CONTENT,
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
