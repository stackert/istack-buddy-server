import { FsApiClient, fsApiClient } from './fsApiClient';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FsApiClient', () => {
  let client: FsApiClient;

  beforeEach(() => {
    client = new FsApiClient();
    client.setApiKey('test-api-key');
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and API Key', () => {
    it('should create a new instance', () => {
      expect(client).toBeInstanceOf(FsApiClient);
    });

    it('should set API key and return itself for chaining', () => {
      const result = client.setApiKey('new-key');
      expect(result).toBe(client);
    });

    it('should refresh API key from environment', () => {
      const oldKey = process.env.CORE_FORMS_API_V2_KEY;
      process.env.CORE_FORMS_API_V2_KEY = 'env-key';

      const result = client.refreshApiKeyFromEnvironment();

      expect(result).toBe(client);

      // Restore original value
      if (oldKey) {
        process.env.CORE_FORMS_API_V2_KEY = oldKey;
      } else {
        delete process.env.CORE_FORMS_API_V2_KEY;
      }
    });

    it('should use the singleton instance', () => {
      expect(fsApiClient).toBeInstanceOf(FsApiClient);
    });
  });

  describe('makeRequest', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { id: '123', name: 'Test Form' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Access private method via bracket notation for testing
      const result = await (client as any).makeRequest('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.formstack.com/api/v2/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual(mockResponse);
    });

    it('should make successful POST request with body', async () => {
      const mockResponse = { id: '123', name: 'Test Form' };
      const requestBody = { name: 'Test Form', fields: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await (client as any).makeRequest(
        '/test',
        'POST',
        requestBody,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.formstack.com/api/v2/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestBody),
        }),
      );
      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual(mockResponse);
    });

    it('should handle string body for POST request', async () => {
      const mockResponse = { id: '123', name: 'Test Form' };
      const requestBody = '{"name":"Test Form","fields":[]}';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await (client as any).makeRequest(
        '/test',
        'POST',
        requestBody,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.formstack.com/api/v2/test',
        expect.objectContaining({
          method: 'POST',
          body: requestBody,
        }),
      );
      expect(result.isSuccess).toBe(true);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'API Error' }),
      });

      const result = await (client as any).makeRequest('/test');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['API Error']);
    });

    it('should handle API errors without specific error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await (client as any).makeRequest('/test');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['API request failed']);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await (client as any).makeRequest('/test');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Network error']);
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error');

      const result = await (client as any).makeRequest('/test');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Unknown error']);
    });
  });

  describe('Basic API Operations', () => {
    describe('getFormJson', () => {
      it('should get form JSON successfully', async () => {
        const mockFormResponse = { id: '123', name: 'Test Form' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFormResponse),
        });

        const result = await client.getFormJson('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123.json',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-api-key',
              'Content-Type': 'application/json',
            }),
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockFormResponse);
      });

      it('should handle form JSON failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Form not found' }),
        });

        const result = await client.getFormJson('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual(['Form not found']);
      });
    });

    describe('getFormFieldsJson', () => {
      it('should get form fields JSON successfully', async () => {
        const mockFieldsResponse = { fields: [{ id: '1', label: 'Field 1' }] };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldsResponse),
        });

        const result = await client.getFormFieldsJson('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123.json',
          expect.objectContaining({
            method: 'GET',
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockFieldsResponse);
      });
    });

    describe('postForm', () => {
      it('should create form successfully', async () => {
        const mockFormResponse = { id: '123', name: 'Test Form' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFormResponse),
        });

        const fields = [
          {
            label: 'Name',
            field_type: 'text' as const,
            isHidden: false,
            isRequired: true,
          },
        ];

        const result = await client.postForm('Test Form', fields);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form.json',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              name: 'Test Form',
              fields: [
                {
                  label: 'Name',
                  field_type: 'text',
                  hidden: '0',
                  require: '1',
                },
              ],
            }),
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockFormResponse);
      });
    });

    describe('postField', () => {
      it('should create field successfully', async () => {
        const mockFieldResponse = { id: '456', label: 'New Field' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldResponse),
        });

        const fieldData = { field_type: 'text', label: 'New Field' };

        const result = await client.postField('123', fieldData);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123/field.json',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(fieldData),
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockFieldResponse);
      });
    });

    describe('putField', () => {
      it('should update field successfully', async () => {
        const mockFieldResponse = { id: '456', label: 'Updated Field' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldResponse),
        });

        const fieldData = { label: 'Updated Field' };

        const result = await client.putField('456', fieldData);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/456',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(fieldData),
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockFieldResponse);
      });
    });

    describe('putFieldLogic', () => {
      it('should update field logic successfully', async () => {
        const mockFieldResponse = { id: '456', logic: { conditions: [] } };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldResponse),
        });

        const logic = {
          conditions: [{ field: '123', operator: 'is', value: 'test' }],
        };

        const result = await client.putFieldLogic('456', logic);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/456',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ logic }),
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockFieldResponse);
      });
    });

    describe('deleteField', () => {
      it('should delete field successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await client.deleteField('456');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/456',
          expect.objectContaining({
            method: 'DELETE',
          }),
        );
        expect(result.isSuccess).toBe(true);
      });
    });

    describe('postFormCopy', () => {
      it('should create form copy successfully', async () => {
        const mockCopyResponse = { id: '789', name: 'Test Form Copy' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCopyResponse),
        });

        const result = await client.postFormCopy('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123/copy',
          expect.objectContaining({
            method: 'POST',
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockCopyResponse);
      });
    });

    describe('getFormWebhooks', () => {
      it('should get form webhooks successfully', async () => {
        const mockWebhooksResponse = {
          webhooks: [{ id: '1', name: 'Webhook 1' }],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWebhooksResponse),
        });

        const result = await client.getFormWebhooks('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123/webhook.json',
          expect.objectContaining({
            method: 'GET',
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockWebhooksResponse);
      });
    });

    describe('getFormNotifications', () => {
      it('should get form notifications successfully', async () => {
        const mockNotificationsResponse = {
          notifications: [{ id: '1', name: 'Notification 1' }],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNotificationsResponse),
        });

        const result = await client.getFormNotifications('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123/notification.json',
          expect.objectContaining({
            method: 'GET',
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockNotificationsResponse);
      });
    });

    describe('getFormConfirmations', () => {
      it('should get form confirmations successfully', async () => {
        const mockConfirmationsResponse = {
          confirmations: [{ id: '1', name: 'Confirmation 1' }],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfirmationsResponse),
        });

        const result = await client.getFormConfirmations('123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123/confirmation.json',
          expect.objectContaining({
            method: 'GET',
          }),
        );
        expect(result.isSuccess).toBe(true);
        expect(result.response).toEqual(mockConfirmationsResponse);
      });
    });
  });

  describe('Marv-Specific API Operations', () => {
    describe('isFormMarvEnabled', () => {
      it('should return true when MARV_ENABLED field exists', async () => {
        const mockFieldsResponse = {
          fields: [
            { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
            { id: '2', label: 'Other Field', field_type: 'text' },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldsResponse),
        });

        const result = await client.isFormMarvEnabled('123');

        expect(result).toBe(true);
      });

      it('should return false when MARV_ENABLED field does not exist', async () => {
        const mockFieldsResponse = {
          fields: [
            { id: '1', label: 'Regular Field', field_type: 'text' },
            { id: '2', label: 'Other Field', field_type: 'text' },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldsResponse),
        });

        const result = await client.isFormMarvEnabled('123');

        expect(result).toBe(false);
      });

      it('should return false when API call fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await client.isFormMarvEnabled('123');

        expect(result).toBe(false);
      });

      it('should return false when response is not successful', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Form not found' }),
        });

        const result = await client.isFormMarvEnabled('123');

        expect(result).toBe(false);
      });

      it('should return false when fields array is missing', async () => {
        const mockFieldsResponse = {};
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFieldsResponse),
        });

        const result = await client.isFormMarvEnabled('123');

        expect(result).toBe(false);
      });
    });
  });
});
