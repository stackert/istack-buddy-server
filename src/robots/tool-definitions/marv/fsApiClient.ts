import type {
  IMarvApiUniversalResponse,
  TFsFormJson,
  TFsFieldJson,
  IAddFsLiteFieldProps,
} from './types';

// Focused API client for Formstack operations - NO MOCKS
export class FsApiClient {
  private apiKey: string | null = null;
  private static readonly API_ROOT = 'https://www.formstack.com/api/v2';

  constructor() {
    // API key will be loaded lazily when first needed
  }

  setApiKey(apiKey: string): FsApiClient {
    this.apiKey = apiKey;
    return this;
  }

  // Force refresh API key from environment variable
  refreshApiKeyFromEnvironment(): FsApiClient {
    this.apiKey = process.env.CORE_FORMS_API_V2_KEY || '';
    return this;
  }

  // Lazily load API key from environment if not already set
  private ensureApiKey(): void {
    if (this.apiKey === null) {
      this.apiKey = process.env.CORE_FORMS_API_V2_KEY || '';
      if (!this.apiKey) {
        throw new Error('Authentication failed: No API key provided (CORE_FORMS_API_V2_KEY environment variable not set)');
      }
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
  ): Promise<IMarvApiUniversalResponse<T>> {
    try {
      // Ensure API key is loaded from environment
      this.ensureApiKey();
      
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

      const fullUrl = `${FsApiClient.API_ROOT}${endpoint}`;

      const response = await fetch(fullUrl, config);

      const data = await response.json();
      if (response.ok) {
        return {
          isSuccess: true,
          response: data,
          errorItems: null,
        };
      } else {
        // Improve error handling for authentication failures
        let errorMessage = data.error || 'API request failed';

        // Check for authentication-related errors
        if (response.status === 400 && data.error === 'invalid_request') {
          if (data.error_description?.includes('authentication header')) {
            errorMessage = !this.apiKey
              ? 'Authentication failed: No API key provided (CORE_FORMS_API_V2_KEY environment variable not set)'
              : 'Authentication failed: Invalid API key or malformed authentication header';
          } else {
            errorMessage = `Bad Request: ${data.error_description || data.error}`;
          }
        } else if (response.status === 401) {
          errorMessage = 'Authentication failed: Invalid API key';
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden: API key lacks required permissions';
        }
        return {
          isSuccess: false,
          response: null,
          errorItems: [errorMessage],
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

  // ===== BASIC API OPERATIONS =====

  // Get form JSON from Formstack API
  async getFormJson(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<TFsFormJson>> {
    return this.makeRequest<TFsFormJson>(`/form/${formId}.json`);
  }

  // Get form fields JSON from Formstack API
  async getFormFieldsJson(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<{ fields: TFsFieldJson[] }>> {
    return this.makeRequest<{ fields: TFsFieldJson[] }>(`/form/${formId}.json`);
  }

  // Create a new form
  async postForm(
    formName: string,
    fields: IAddFsLiteFieldProps[],
  ): Promise<IMarvApiUniversalResponse<TFsFormJson>> {
    const sanitizedFields = fields.map((field) => ({
      label: field.label,
      field_type: field.field_type,
      hidden: field.isHidden ? '1' : '0',
      require: field.isRequired ? '1' : '0',
    }));

    return this.makeRequest<TFsFormJson>('/form.json', 'POST', {
      name: formName,
      fields: sanitizedFields,
    });
  }

  // Create a new field
  async postField(
    formId: string,
    fieldData: any,
  ): Promise<IMarvApiUniversalResponse<TFsFieldJson>> {
    return this.makeRequest<TFsFieldJson>(
      `/form/${formId}/field.json`,
      'POST',
      fieldData,
    );
  }

  // Update a field
  async putField(
    fieldId: string,
    fieldData: any,
  ): Promise<IMarvApiUniversalResponse<TFsFieldJson>> {
    return this.makeRequest<TFsFieldJson>(
      `/field/${fieldId}`,
      'PUT',
      fieldData,
    );
  }

  // Update field logic specifically
  async putFieldLogic(
    fieldId: string,
    logic: any,
  ): Promise<IMarvApiUniversalResponse<TFsFieldJson>> {
    return this.makeRequest<TFsFieldJson>(`/field/${fieldId}`, 'PUT', {
      logic,
    });
  }

  // Delete a field
  async deleteField(fieldId: string): Promise<IMarvApiUniversalResponse<any>> {
    return this.makeRequest(`/field/${fieldId}`, 'DELETE');
  }

  // Get form webhooks
  async getFormWebhooks(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<any>> {
    return this.makeRequest(`/form/${formId}/webhook.json`);
  }

  // Get form notifications
  async getFormNotifications(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<any>> {
    return this.makeRequest(`/form/${formId}/notification.json`);
  }

  // Get form confirmations
  async getFormConfirmations(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<any>> {
    return this.makeRequest(`/form/${formId}/confirmation.json`);
  }

  // Create a developer copy of a form
  async postFormCopy(
    formId: string,
  ): Promise<IMarvApiUniversalResponse<TFsFormJson>> {
    return this.makeRequest<TFsFormJson>(`/form/${formId}/copy`, 'POST');
  }

  // ===== MARV-SPECIFIC API OPERATIONS =====

  // Check if form is Marv enabled (MUST BE DEFINED ON THIS CLASS)
  async isFormMarvEnabled(formId: string): Promise<boolean> {
    try {
      const response = await this.getFormFieldsJson(formId);
      if (response.isSuccess && response.response) {
        const fields = response.response.fields || [];
        const marvEnabledField = fields.find(
          (field) => field.label === 'MARV_ENABLED',
        );
        return !!marvEnabledField;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const fsApiClient = new FsApiClient();
