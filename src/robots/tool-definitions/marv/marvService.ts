import type {
  IMarvApiUniversalResponse,
  TFsFormJson,
  TFsFieldJson,
  IAddFsLiteFieldProps,
  TFsLiteFormAddResponse,
  IFormAndRelatedEntityOverview,
} from './types';

import { ObservationMakerLogicValidation } from '../../../common/observation-makers/ObservationMakerLogicValidation';
import { ObservationMakerCalculationValidation } from '../../../common/observation-makers/ObservationMakerCalculationValidation';
import { Models } from 'istack-buddy-utilities';
import type { IObservationResult } from 'istack-buddy-utilities';
import { FsApiClient } from './fsApiClient';

// Marv business logic service that uses FsApiClient
export class MarvService {
  constructor(private apiClient: FsApiClient) {}

  // ===== FORM OPERATIONS =====

  async formLiteAdd(
    formName: string,
    fields: IAddFsLiteFieldProps[],
  ): Promise<IMarvApiUniversalResponse<TFsLiteFormAddResponse>> {
    return this.withErrorHandling(async () => {
      const response = await this.apiClient.postForm(formName, fields);

      if (response.isSuccess && response.response) {
        const formJson = response.response;
        return {
          isSuccess: true,
          response: {
            editUrl: formJson.edit_url,
            viewUrl: formJson.url,
            formId: formJson.id,
            isSuccess: true,
          },
          errorItems: null,
        };
      }

      return {
        isSuccess: false,
        response: null,
        errorItems: response.errorItems,
      };
    });
  }

  async fieldLiteAdd(
    formId: string,
    properties: IAddFsLiteFieldProps,
  ): Promise<
    IMarvApiUniversalResponse<{ fieldId: string; fieldJson: TFsFieldJson }>
  > {
    return this.withErrorHandling(async () => {
      const fieldData = {
        field_type: properties.field_type,
        label: properties.label,
        hidden: properties.isHidden ? '1' : '0',
        require: properties.isRequired ? '1' : '0',
      };

      const response = await this.apiClient.postField(formId, fieldData);

      if (response.isSuccess && response.response) {
        return {
          isSuccess: true,
          response: {
            fieldId: response.response.id,
            fieldJson: response.response,
          },
          errorItems: null,
        };
      }

      return {
        isSuccess: false,
        response: null,
        errorItems: response.errorItems,
      };
    });
  }

  async fieldRemove(fieldId: string): Promise<IMarvApiUniversalResponse<any>> {
    return this.apiClient.deleteField(fieldId);
  }

  async formDeveloperCopy(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<TFsFormJson>> {
    return this.apiClient.postFormCopy(formId);
  }

  // ===== LOGIC STASH OPERATIONS =====

  async fieldLogicStashCreate(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<TFsFieldJson>> {
    return this.withErrorHandling(async () => {
      // Check if form is Marv enabled
      await this.validateMarvEnabled(formId);

      // Get fields with logic
      const fields = await this.getFormFields(formId);
      const fieldsWithLogicJson = fields.filter((field) => field.logic);

      if (fieldsWithLogicJson.length === 0) {
        return this.createErrorResponse(
          'No fields with logic found on this form',
        );
      }

      // Create logic stash string
      const logicStashString =
        this.stringifyLogicStashString(fieldsWithLogicJson);

      // Create the logic stash field
      const createResponse = await this.apiClient.postField(formId, {
        field_type: 'text',
        hidden: true,
        default_value: logicStashString,
        default: logicStashString,
        label: 'MARV_LOGIC_STASH',
      });

      return createResponse;
    });
  }

  async fieldLogicStashApply(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    return this.withErrorHandling(async () => {
      // Get the stash field
      const stashField = await this.getLogicStashField(formId);

      // Parse the stashed logic
      const logicStash = this.parseLogicStashString(stashField.default || '');
      const fieldIds = Object.keys(logicStash);

      // Apply logic to each field
      const results = await this.executeBatchOperation(
        Object.entries(logicStash),
        async ([fieldId, logic]) => {
          const result = await this.apiClient.putFieldLogic(fieldId, logic);
          return {
            success: result.isSuccess,
            error: result.isSuccess
              ? null
              : `Failed to apply logic to field ${fieldId}: ${result.errorItems?.join(', ')}`,
          };
        },
      );

      return this.createBatchResponse(results);
    });
  }

  async fieldLogicStashApplyAndRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    return this.withErrorHandling(async () => {
      // First apply the logic
      const applyResult = await this.fieldLogicStashApply(formId);

      if (!applyResult.isSuccess) {
        return applyResult;
      }

      // Then remove the stash field
      const removeResult = await this.fieldLogicStashRemove(formId);

      return {
        isSuccess: removeResult.isSuccess,
        response: { isSuccessful: removeResult.isSuccess },
        errorItems: removeResult.errorItems,
      };
    });
  }

  async fieldLogicStashRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<any>> {
    return this.withErrorHandling(async () => {
      // Get the stash field
      const stashField = await this.getLogicStashField(formId);

      // Delete the stash field
      return await this.apiClient.deleteField(stashField.id);
    });
  }

  // ===== LOGIC OPERATIONS =====

  async fieldLogicRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    return this.withErrorHandling(async () => {
      // Check if form is Marv enabled
      await this.validateMarvEnabled(formId);

      // Get all fields with logic
      const fields = await this.getFormFields(formId);
      const fieldsWithLogic = fields.filter((field) => field.logic);

      if (fieldsWithLogic.length === 0) {
        return this.createSuccessResponse({ isSuccessful: true });
      }

      // Remove logic from each field by setting logic to null
      const results = await this.executeBatchOperation(
        fieldsWithLogic,
        async (field) => {
          const result = await this.apiClient.putFieldLogic(field.id, null);
          return {
            success: result.isSuccess,
            error: result.isSuccess
              ? null
              : `Failed to remove logic from field ${field.id}: ${result.errorItems?.join(', ')}`,
          };
        },
      );

      return this.createBatchResponse(results);
    });
  }

  // ===== SLUG OPERATIONS =====

  async fieldLabelUniqueSlugAdd(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    return this.withErrorHandling(async () => {
      // Check if form is Marv enabled
      await this.validateMarvEnabled(formId);

      // Get all fields
      const fields = await this.getFormFields(formId);

      // Update each field with unique slug
      const results = await this.executeBatchOperation(
        fields,
        async (field) => {
          const slug = this.fieldJsonToUniqueLabelSlug(field);
          const newLabel = slug + field.label;

          const result = await this.apiClient.putField(field.id, {
            label: newLabel,
          });

          return {
            success: result.isSuccess,
            error: result.isSuccess
              ? null
              : `Failed to add slug to field ${field.id}: ${result.errorItems?.join(', ')}`,
          };
        },
      );

      return this.createBatchResponse(results);
    });
  }

  async fieldLabelUniqueSlugRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    return this.withErrorHandling(async () => {
      // Check if form is Marv enabled
      await this.validateMarvEnabled(formId);

      // Get all fields
      const fields = await this.getFormFields(formId);

      // Update each field to remove slug
      const results = await this.executeBatchOperation(
        fields,
        async (field) => {
          const cleanedLabel = this.labelWithoutSlug(field);

          // Only update if the label actually changed (had a slug)
          if (cleanedLabel !== field.label) {
            const result = await this.apiClient.putField(field.id, {
              label: cleanedLabel,
            });

            return {
              success: result.isSuccess,
              error: result.isSuccess
                ? null
                : `Failed to remove slug from field ${field.id}: ${result.errorItems?.join(', ')}`,
            };
          }

          return { success: true, error: null };
        },
      );

      return this.createBatchResponse(results);
    });
  }

  // ===== OVERVIEW AND VALIDATION =====

  async formAndRelatedEntityOverview(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<IFormAndRelatedEntityOverview>> {
    return this.withErrorHandling(async () => {
      // Make parallel API calls to get all form-related data
      const [
        formResponse,
        webhooksResponse,
        notificationsResponse,
        confirmationsResponse,
      ] = await Promise.all([
        this.apiClient.getFormJson(formId),
        this.apiClient.getFormWebhooks(formId),
        this.apiClient.getFormNotifications(formId),
        this.apiClient.getFormConfirmations(formId),
      ]);

      if (!formResponse.isSuccess || !formResponse.response) {
        return this.createErrorResponse(
          formResponse.errorItems || ['Failed to get form details'],
        );
      }

      const formData = formResponse.response;

      // Extract submit actions (webhooks) with name and id
      const submitActions =
        webhooksResponse.isSuccess && webhooksResponse.response?.webhooks
          ? webhooksResponse.response.webhooks.map((webhook: any) => ({
              id: webhook.id || '',
              name: webhook.name || webhook.url || 'Unnamed Webhook',
            }))
          : [];

      // Extract notification emails with name and id
      const notificationEmails =
        notificationsResponse.isSuccess &&
        notificationsResponse.response?.notifications
          ? notificationsResponse.response.notifications.map(
              (notification: any) => ({
                id: notification.id || '',
                name:
                  notification.name ||
                  notification.subject ||
                  'Unnamed Notification',
              }),
            )
          : [];

      // Extract confirmation emails with name and id
      const confirmationEmails =
        confirmationsResponse.isSuccess &&
        confirmationsResponse.response?.confirmations
          ? confirmationsResponse.response.confirmations.map(
              (confirmation: any) => ({
                id: confirmation.id || '',
                name:
                  confirmation.name ||
                  confirmation.subject ||
                  'Unnamed Confirmation',
              }),
            )
          : [];

      // Transform the API response to our desired structure
      const overview: IFormAndRelatedEntityOverview = {
        formId: formData.id,
        submissions: formData.submissions || 0,
        version: formData.version || 1,
        submissionsToday: formData.submissions_today || 0,
        lastSubmissionId: formData.last_submission_id || null,
        url: formData.url,
        encrypted: formData.encrypted || false,
        isActive: !formData.inactive, // Transform inactive to isActive
        timezone: formData.timezone || 'UTC',
        isOneQuestionAtATime:
          formData.should_display_one_question_at_a_time || false,
        hasApprovers: formData.has_approvers || false,
        isWorkflowForm: formData.is_workflow_form || false,
        fieldCount: formData.fields?.length || 0,
        submitActions,
        notificationEmails,
        confirmationEmails,
      };

      // Only include isWorkflowPublished if isWorkflowForm is true
      if (overview.isWorkflowForm) {
        overview.isWorkflowPublished = formData.is_workflow_published || false;
      }

      return this.createSuccessResponse(overview);
    });
  }

  async formLogicValidation(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<IObservationResult>> {
    return this.withErrorHandling(async () => {
      // Force refresh API key from environment to ensure we have the latest value
      this.apiClient.refreshApiKeyFromEnvironment();

      // Get form data from API
      const formData = await this.getFormData(formId);

      // Create and run observation maker
      const observationMaker = new ObservationMakerLogicValidation();
      const observationResult = await this.runObservation(
        observationMaker,
        formData,
      );

      return this.createSuccessResponse(observationResult);
    });
  }

  async formCalculationValidation(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<IObservationResult>> {
    return this.withErrorHandling(async () => {
      // Force refresh API key from environment to ensure we have the latest value
      this.apiClient.refreshApiKeyFromEnvironment();

      // Get form data from API
      const formData = await this.getFormData(formId);

      // Create and run observation maker
      const observationMaker = new ObservationMakerCalculationValidation();
      const observationResult = await this.runObservation(
        observationMaker,
        formData,
      );

      return this.createSuccessResponse(observationResult);
    });
  }

  // ===== HELPER METHODS =====

  private async getLogicStashField(formId: string): Promise<TFsFieldJson> {
    const fieldsResponse = await this.apiClient.getFormFieldsJson(formId);
    if (!fieldsResponse.isSuccess || !fieldsResponse.response) {
      throw new Error('Failed to get form fields');
    }

    const fields = fieldsResponse.response.fields || [];
    const logicStashFields = fields.filter(
      (field) => field.label === 'MARV_LOGIC_STASH',
    );

    if (logicStashFields.length === 0) {
      throw new Error('No logic stash field found');
    }

    // Return the most recent one (biggest field.id)
    return logicStashFields.reduce((latest, field) => {
      return parseInt(field.id) > parseInt(latest.id) ? field : latest;
    });
  }

  private stringifyLogicStashString(fieldsWithLogic: TFsFieldJson[]): string {
    const allFieldLogic = fieldsWithLogic.reduce(
      (acc, field) => {
        acc[field.id] = field.logic;
        return acc;
      },
      {} as Record<string, any>,
    );

    const logicAsBase64 = btoa(JSON.stringify(allFieldLogic));
    const logic = {
      base64: logicAsBase64,
    };

    return JSON.stringify(logic);
  }

  private parseLogicStashString(logicStashString: string): Record<string, any> {
    const logicEnvelope = JSON.parse(logicStashString);
    const logicStash = JSON.parse(atob(logicEnvelope.base64));
    return logicStash;
  }

  private fieldJsonToUniqueLabelSlug(field: TFsFieldJson): string {
    return `|${(field.id || '').slice(-4)}|`;
  }

  private labelWithoutSlug(field: TFsFieldJson): string {
    const slug = this.fieldJsonToUniqueLabelSlug(field).replace(/\|/g, `\\|`);
    const slugRegExp = new RegExp(slug, 'g');
    const cleanedLabel = (field.label || '').replace(slugRegExp, '');
    return cleanedLabel;
  }

  // ===== UTILITY METHODS =====

  private async withErrorHandling<T>(
    operation: () => Promise<IMarvApiUniversalResponse<T>>,
  ): Promise<IMarvApiUniversalResponse<T>> {
    try {
      return await operation();
    } catch (error) {
      return {
        isSuccess: false,
        response: null,
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private createSuccessResponse<T>(response: T): IMarvApiUniversalResponse<T> {
    return {
      isSuccess: true,
      response,
      errorItems: null,
    };
  }

  private createErrorResponse(
    errorMessage: string | string[],
  ): IMarvApiUniversalResponse<any> {
    return {
      isSuccess: false,
      response: null,
      errorItems: Array.isArray(errorMessage) ? errorMessage : [errorMessage],
    };
  }

  private async validateMarvEnabled(formId: string): Promise<void> {
    const isMarvEnabled = await this.apiClient.isFormMarvEnabled(formId);
    if (!isMarvEnabled) {
      throw new Error('Form is not Marv enabled');
    }
  }

  private async getFormFields(formId: string): Promise<TFsFieldJson[]> {
    const fieldsResponse = await this.apiClient.getFormFieldsJson(formId);
    if (!fieldsResponse.isSuccess || !fieldsResponse.response) {
      throw new Error(
        fieldsResponse.errorItems?.join(', ') || 'Failed to get form fields',
      );
    }
    return fieldsResponse.response.fields || [];
  }

  private async getFormData(formId: string): Promise<TFsFormJson> {
    const formResponse = await this.apiClient.getFormJson(formId);
    if (!formResponse.isSuccess || !formResponse.response) {
      throw new Error(
        formResponse.errorItems?.join(', ') || 'Failed to get form details',
      );
    }
    return formResponse.response;
  }

  private async executeBatchOperation<T, R>(
    items: T[],
    operation: (item: T) => Promise<{ success: boolean; error: string | null }>,
  ): Promise<{ success: boolean; error: string | null }[]> {
    const results: { success: boolean; error: string | null }[] = [];

    for (const item of items) {
      const result = await operation(item);
      results.push(result);
    }

    return results;
  }

  private createBatchResponse(
    results: { success: boolean; error: string | null }[],
  ): IMarvApiUniversalResponse<{ isSuccessful: boolean }> {
    const errors = results
      .filter((result) => !result.success && result.error)
      .map((result) => result.error!);

    return {
      isSuccess: errors.length === 0,
      response: { isSuccessful: errors.length === 0 },
      errorItems: errors.length > 0 ? errors : null,
    };
  }

  private async runObservation(
    observationMaker:
      | ObservationMakerLogicValidation
      | ObservationMakerCalculationValidation,
    formData: TFsFormJson,
  ): Promise<IObservationResult> {
    // Convert form data to form model
    const formDataWithFields = {
      ...formData,
      fields: formData.fields || [],
    };
    const formModel = new Models.FsModelForm(formDataWithFields, {
      fieldModelVersion: 'v2',
    });

    // Create observation context
    const observationContext = {
      resources: {
        formModel: formModel,
      },
    };

    // Create and run observation maker
    return await observationMaker.makeObservation(observationContext);
  }
}

// Singleton instance
export const marvService = new MarvService(new FsApiClient());
