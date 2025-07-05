import {
  IMarvApiUniversalResponse,
  TFsFormJson,
  TFsFieldJson,
  IAddFsLiteFieldProps,
  TFsLiteFormAddResponse,
} from './types';

// Real API client for Formstack operations - NO MOCKS
export class FsApiClient {
  private apiKey: string = '';
  private static readonly API_ROOT = 'https://www.formstack.com/api/v2';

  setApiKey(apiKey: string): FsApiClient {
    this.apiKey = apiKey;
    return this;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
  ): Promise<IMarvApiUniversalResponse<T>> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };

      const config: RequestInit = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        config.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(
        `${FsApiClient.API_ROOT}${endpoint}`,
        config,
      );
      const data = await response.json();

      if (response.ok) {
        return {
          isSuccess: true,
          response: data,
          errorItems: null,
        };
      } else {
        return {
          isSuccess: false,
          response: null,
          errorItems: [data.error || 'API request failed'],
        };
      }
    } catch (error) {
      return {
        isSuccess: false,
        response: null,
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // Get form field JSON from Formstack API
  private async getFormFieldJson(formId: string): Promise<TFsFieldJson[]> {
    const response = await this.makeRequest<{ fields: TFsFieldJson[] }>(
      `/form/${formId}.json`,
    );
    if (response.isSuccess && response.response) {
      return response.response.fields || [];
    }
    throw new Error(
      `Failed to get form fields: ${response.errorItems?.join(', ')}`,
    );
  }

  // Check if form is Marv enabled
  private async isFormMarvEnabled(formId: string): Promise<boolean> {
    try {
      const fields = await this.getFormFieldJson(formId);
      const marvEnabledField = fields.find(
        (field) => field.label === 'MARV_ENABLED',
      );
      console.log(
        `🔍 Marv enabled check for form ${formId}: ${!!marvEnabledField ? 'YES' : 'NO'}`,
      );
      return !!marvEnabledField;
    } catch (error) {
      console.log(`❌ Error checking Marv status for form ${formId}:`, error);
      return false;
    }
  }

  // Create logic stash string from fields with logic
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

  // Parse logic stash string from base64
  private parseLogicStashString(logicStashString: string): Record<string, any> {
    const logicEnvelope = JSON.parse(logicStashString);
    const logicStash = JSON.parse(atob(logicEnvelope.base64));
    return logicStash;
  }

  // Get the logic stash field from the form
  private async getLogicStashField(formId: string): Promise<TFsFieldJson> {
    const fields = await this.getFormFieldJson(formId);
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

  // Update a field's logic
  private async updateFieldLogic(
    fieldId: string,
    logic: any,
  ): Promise<IMarvApiUniversalResponse<any>> {
    return this.makeRequest(`/field/${fieldId}`, 'PUT', {
      logic: logic,
    });
  }

  // Delete a field
  private async deleteField(
    fieldId: string,
  ): Promise<IMarvApiUniversalResponse<any>> {
    return this.makeRequest(`/field/${fieldId}`, 'DELETE');
  }

  // REAL API IMPLEMENTATIONS

  async fieldLogicStashCreate(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<TFsFieldJson>> {
    console.log(`🔍 Creating logic stash for form ${formId}`);

    // Check if form is Marv enabled
    const isMarvEnabled = await this.isFormMarvEnabled(formId);
    if (!isMarvEnabled) {
      return {
        isSuccess: false,
        response: null,
        errorItems: ['Form is not Marv enabled'],
      };
    }

    // Get fields with logic
    const allFields = await this.getFormFieldJson(formId);
    const fieldsWithLogicJson = allFields.filter((field) => field.logic);

    console.log(`📊 Found ${fieldsWithLogicJson.length} fields with logic`);

    if (fieldsWithLogicJson.length === 0) {
      return {
        isSuccess: false,
        response: null,
        errorItems: ['No fields with logic found on this form'],
      };
    }

    // Create logic stash string
    const logicStashString =
      this.stringifyLogicStashString(fieldsWithLogicJson);

    console.log(`💾 Creating logic stash field...`);

    // Create the logic stash field
    const createResponse = await this.makeRequest<TFsFieldJson>(
      `/form/${formId}/field.json`,
      'POST',
      {
        field_type: 'text',
        hidden: true,
        default_value: logicStashString,
        default: logicStashString,
        label: 'MARV_LOGIC_STASH',
      },
    );

    if (createResponse.isSuccess) {
      console.log(
        `✅ Logic stash created successfully! Field ID: ${createResponse.response?.id}`,
      );
    }

    return createResponse;
  }

  async formLiteAdd(
    formName: string,
    fields: IAddFsLiteFieldProps[],
  ): Promise<IMarvApiUniversalResponse<TFsLiteFormAddResponse>> {
    const sanitizedFields = fields.map((field) => ({
      label: field.label,
      field_type: field.field_type,
      hidden: field.isHidden ? '1' : '0',
      require: field.isRequired ? '1' : '0',
    }));

    const response = await this.makeRequest<TFsFormJson>('/form.json', 'POST', {
      name: formName,
      fields: sanitizedFields,
    });

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
  }

  async fieldLiteAdd(
    formId: string,
    properties: IAddFsLiteFieldProps,
  ): Promise<
    IMarvApiUniversalResponse<{ fieldId: string; fieldJson: TFsFieldJson }>
  > {
    const response = await this.makeRequest<TFsFieldJson>(
      `/form/${formId}/field.json`,
      'POST',
      {
        field_type: properties.field_type,
        label: properties.label,
        hidden: properties.isHidden ? '1' : '0',
        require: properties.isRequired ? '1' : '0',
      },
    );

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
  }

  // Create unique slug for a field (last 4 digits of field ID)
  private fieldJsonToUniqueLabelSlug(field: TFsFieldJson): string {
    return `|${(field.id || '').slice(-4)}|`;
  }

  // Remove slug from a field label
  private labelWithoutSlug(field: TFsFieldJson): string {
    const slug = this.fieldJsonToUniqueLabelSlug(field).replace(/\|/g, `\\|`);
    const slugRegExp = new RegExp(slug, 'g');
    const cleanedLabel = (field.label || '').replace(slugRegExp, '');
    return cleanedLabel;
  }

  async fieldLabelUniqueSlugAdd(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    console.log(`🏷️ Adding unique slugs to form ${formId} field labels`);

    try {
      // Check if form is Marv enabled
      const isMarvEnabled = await this.isFormMarvEnabled(formId);
      if (!isMarvEnabled) {
        return {
          isSuccess: false,
          response: { isSuccessful: false },
          errorItems: ['Form is not Marv enabled'],
        };
      }

      // Get all fields
      const fields = await this.getFormFieldJson(formId);
      console.log(`📊 Found ${fields.length} fields to add slugs to`);

      let successCount = 0;
      let errors: string[] = [];

      // Update each field with unique slug
      for (const field of fields) {
        const slug = this.fieldJsonToUniqueLabelSlug(field);
        const newLabel = slug + field.label;

        const result = await this.makeRequest(`/field/${field.id}`, 'PUT', {
          label: newLabel,
        });

        if (result.isSuccess) {
          successCount++;
          console.log(
            `✅ Added slug to field ${field.id}: "${field.label}" → "${newLabel}"`,
          );
        } else {
          errors.push(
            `Failed to add slug to field ${field.id}: ${result.errorItems?.join(', ')}`,
          );
        }
      }

      console.log(
        `✅ Unique slugs added: ${successCount}/${fields.length} fields updated`,
      );

      return {
        isSuccess: errors.length === 0,
        response: { isSuccessful: errors.length === 0 },
        errorItems: errors.length > 0 ? errors : null,
      };
    } catch (error) {
      return {
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async fieldLabelUniqueSlugRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    console.log(`🏷️ Removing unique slugs from form ${formId} field labels`);

    try {
      // Check if form is Marv enabled
      const isMarvEnabled = await this.isFormMarvEnabled(formId);
      if (!isMarvEnabled) {
        return {
          isSuccess: false,
          response: { isSuccessful: false },
          errorItems: ['Form is not Marv enabled'],
        };
      }

      // Get all fields
      const fields = await this.getFormFieldJson(formId);
      console.log(`📊 Found ${fields.length} fields to remove slugs from`);

      let successCount = 0;
      let errors: string[] = [];

      // Update each field to remove slug
      for (const field of fields) {
        const cleanedLabel = this.labelWithoutSlug(field);

        // Only update if the label actually changed (had a slug)
        if (cleanedLabel !== field.label) {
          const result = await this.makeRequest(`/field/${field.id}`, 'PUT', {
            label: cleanedLabel,
          });

          if (result.isSuccess) {
            successCount++;
            console.log(
              `✅ Removed slug from field ${field.id}: "${field.label}" → "${cleanedLabel}"`,
            );
          } else {
            errors.push(
              `Failed to remove slug from field ${field.id}: ${result.errorItems?.join(', ')}`,
            );
          }
        } else {
          console.log(
            `⏭️ Field ${field.id} has no slug to remove: "${field.label}"`,
          );
        }
      }

      console.log(`✅ Unique slugs removed: ${successCount} fields updated`);

      return {
        isSuccess: errors.length === 0,
        response: { isSuccessful: errors.length === 0 },
        errorItems: errors.length > 0 ? errors : null,
      };
    } catch (error) {
      return {
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async fieldLogicRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    return {
      isSuccess: false,
      response: { isSuccessful: false },
      errorItems: ['Not implemented yet'],
    };
  }

  async fieldLogicStashApply(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    console.log(`🔄 Applying logic stash for form ${formId}`);

    try {
      // Get the stash field
      const stashField = await this.getLogicStashField(formId);
      console.log(`📦 Found stash field: ${stashField.id}`);

      // Parse the stashed logic
      const logicStash = this.parseLogicStashString(stashField.default || '');
      const fieldIds = Object.keys(logicStash);
      console.log(`🔧 Applying logic to ${fieldIds.length} fields`);

      // Apply logic to each field
      let successCount = 0;
      let errors: string[] = [];

      for (const [fieldId, logic] of Object.entries(logicStash)) {
        const result = await this.updateFieldLogic(fieldId, logic);
        if (result.isSuccess) {
          successCount++;
          console.log(`✅ Applied logic to field ${fieldId}`);
        } else {
          errors.push(
            `Failed to apply logic to field ${fieldId}: ${result.errorItems?.join(', ')}`,
          );
        }
      }

      console.log(
        `✅ Logic stash applied: ${successCount}/${fieldIds.length} fields updated`,
      );

      return {
        isSuccess: errors.length === 0,
        response: { isSuccessful: errors.length === 0 },
        errorItems: errors.length > 0 ? errors : null,
      };
    } catch (error) {
      return {
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async fieldLogicStashApplyAndRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    console.log(`🔄 Applying and removing logic stash for form ${formId}`);

    try {
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
    } catch (error) {
      return {
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async fieldLogicStashRemove(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<any>> {
    console.log(`🗑️ Removing logic stash for form ${formId}`);

    try {
      // Get the stash field
      const stashField = await this.getLogicStashField(formId);
      console.log(`📦 Found stash field to remove: ${stashField.id}`);

      // Delete the stash field
      const deleteResult = await this.deleteField(stashField.id);

      if (deleteResult.isSuccess) {
        console.log(
          `✅ Logic stash field ${stashField.id} removed successfully`,
        );
      }

      return deleteResult;
    } catch (error) {
      return {
        isSuccess: false,
        response: null,
        errorItems: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async formDeveloperCopy(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<TFsFormJson>> {
    const response = await this.makeRequest<TFsFormJson>(
      `/form/${formId}/copy`,
      'POST',
    );
    return response;
  }

  // Enable Marv on a form by adding the MARV_ENABLED field
  // async enableMarvOnForm();
  // DO NOT REMOVE THIS COMMENT
  // WE MUST NEVER ATTEMPT TO ENABLE MARV ON A FORM.
}

// Singleton instance
export const fsApiClient = new FsApiClient();
