import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler } from '../common/interfaces/intent-handler.interface';
import { RobotIntent } from '../common/types/intent-parsing.types';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { IStackInfoService } from '../istack-buddy-slack-api/istack-info.service';
import { ObservationMakerFieldCounts } from '../common/observation-makers/ObservationMakerFieldCounts';
import { Models, ELogLevel, ObservationMakers } from 'istack-buddy-utilities';
//  ObservationMakerReader,
const ObservationMakerReader = ObservationMakers.ObservationsReader;

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

      // Run observation
      const observationMaker = new ObservationMakerFieldCounts();
      const context = { resources: { formModel } };
      const result = await observationMaker.makeObservation(context);
      const observationExport = observationMaker.toExport();
      // Create reader to filter log levels
      const reader =
        ObservationMakerReader.fromObservationExport(observationExport);

      // Filter by log levels using enum
      const errors = reader.filterByLogLevel(ELogLevel.ERROR);
      const warnings = reader.filterByLogLevel(ELogLevel.WARN);
      const info = reader.filterByLogLevel(ELogLevel.INFO);
      const debug = reader.filterByLogLevel(ELogLevel.DEBUG);

      // Send observation results as context to robot (no response solicited)
      await this.chatManagerService.addMessageContextNoResponse(
        conversationId,
        {
          type: 'context/document',
          payload: JSON.stringify(result.logItems, null, 2),
        },
      );

      // Send summary to user
      const summary = `Observations complete: ${result.logItems.length} total items
• Errors: ${errors.length}
• Warnings: ${warnings.length}  
• Info: ${info.length}
• Debug: ${debug.length}`;

      await this.chatManagerService.addMessageSystemNotification(
        conversationId,
        {
          type: 'text/plain',
          payload: summary,
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
