import { FsApiClient, fsApiClient } from './fsApiClient';
import {
  IMarvApiUniversalResponse,
  TFsFieldJson,
  TFsFormJson,
  IAddFsLiteFieldProps,
} from './types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console.log to test debug mode
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('FsApiClient', () => {
  let client: FsApiClient;

  beforeEach(() => {
    client = new FsApiClient();
    client.setApiKey('test-api-key');
    mockFetch.mockClear();
    mockConsoleLog.mockClear();
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

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'API Error' }),
      });

      const result = await (client as any).makeRequest('/test');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['API Error']);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await (client as any).makeRequest('/test');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Network error']);
    });
  });

  describe('formLiteAdd', () => {
    it('should create a form successfully', async () => {
      const mockFormResponse = {
        id: '123',
        name: 'Test Form',
        edit_url: 'https://example.com/edit/123',
        url: 'https://example.com/form/123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFormResponse),
      });

      const fields: IAddFsLiteFieldProps[] = [
        { label: 'Name', field_type: 'text', isRequired: true },
        { label: 'Email', field_type: 'email', isHidden: false },
      ];

      const result = await client.formLiteAdd('Test Form', fields);

      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual({
        editUrl: 'https://example.com/edit/123',
        viewUrl: 'https://example.com/form/123',
        formId: '123',
        isSuccess: true,
      });
    });
  });

  describe('fieldLiteAdd', () => {
    it('should add a field successfully', async () => {
      const mockFieldResponse = {
        id: '456',
        label: 'Phone',
        field_type: 'phone',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFieldResponse),
      });

      const fieldProps: IAddFsLiteFieldProps = {
        label: 'Phone',
        field_type: 'phone',
        isRequired: false,
        isHidden: true,
      };

      const result = await client.fieldLiteAdd('123', fieldProps);

      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual({
        fieldId: '456',
        fieldJson: mockFieldResponse,
      });
    });
  });

  describe('fieldRemove', () => {
    it('should remove a field successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await client.fieldRemove('456');

      expect(result.isSuccess).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.formstack.com/api/v2/field/456',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('fieldLogicRemove', () => {
    it('should remove logic from all fields with logic', async () => {
      // Mock form check (Marv enabled)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [{ id: '1', label: 'MARV_ENABLED', field_type: 'text' }],
            }),
        })
        // Mock get form fields with logic
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [
                {
                  id: '1234',
                  label: 'Name',
                  field_type: 'text',
                  logic: { conditions: [] },
                },
                { id: '5678', label: 'Email', field_type: 'email' }, // no logic
              ],
            }),
        })
        // Mock logic removal
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const result = await client.fieldLogicRemove('123');

      expect(result.isSuccess).toBe(true);
      expect(result.response?.isSuccessful).toBe(true);
    });

    it('should handle no fields with logic', async () => {
      // Mock form check (Marv enabled)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [{ id: '1', label: 'MARV_ENABLED', field_type: 'text' }],
            }),
        })
        // Mock get form fields without logic
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [
                { id: '1234', label: 'Name', field_type: 'text' },
                { id: '5678', label: 'Email', field_type: 'email' },
              ],
            }),
        });

      const result = await client.fieldLogicRemove('123');

      expect(result.isSuccess).toBe(true);
      expect(result.response?.isSuccessful).toBe(true);
    });

    it('should fail when form is not Marv enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ fields: [] }),
      });

      const result = await client.fieldLogicRemove('123');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Form is not Marv enabled']);
    });
  });

  describe('formAndRelatedEntityOverview', () => {
    it('should get form overview successfully', async () => {
      const mockFormData = {
        id: '5603242',
        name: 'Test Form',
        url: 'https://formstack.com/forms/test',
        edit_url: 'https://formstack.com/forms/test/edit',
        submissions: 150,
        version: 2,
        submissions_today: 5,
        last_submission_id: '789012',
        encrypted: true,
        inactive: false,
        timezone: 'America/New_York',
        should_display_one_question_at_a_time: true,
        has_approvers: true,
        is_workflow_form: true,
        is_workflow_published: true,
        fields: [
          { id: '1', label: 'Field 1', field_type: 'text' },
          { id: '2', label: 'Field 2', field_type: 'email' },
          { id: '3', label: 'Field 3', field_type: 'number' },
        ],
      };

      const mockWebhooks = [
        { id: 'wh1', name: 'Slack Webhook' },
        { id: 'wh2', url: 'https://api.example.com/webhook' },
      ];

      const mockNotifications = [
        { id: 'not1', name: 'Admin Notification', subject: 'New Submission' },
        { id: 'not2', subject: 'User Notification' },
      ];

      const mockConfirmations = [
        { id: 'conf1', name: 'Thank You Email' },
        { id: 'conf2', subject: 'Confirmation Email' },
      ];

      // Mock all four API calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFormData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ webhooks: mockWebhooks }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ notifications: mockNotifications }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ confirmations: mockConfirmations }),
        });

      const result = await client.formAndRelatedEntityOverview('5603242');

      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual({
        formId: '5603242',
        submissions: 150,
        version: 2,
        submissionsToday: 5,
        lastSubmissionId: '789012',
        url: 'https://formstack.com/forms/test',
        encrypted: true,
        isActive: true, // inactive: false becomes isActive: true
        timezone: 'America/New_York',
        isOneQuestionAtATime: true,
        hasApprovers: true,
        isWorkflowForm: true,
        isWorkflowPublished: true,
        fieldCount: 3,
        submitActions: [
          { id: 'wh1', name: 'Slack Webhook' },
          { id: 'wh2', name: 'https://api.example.com/webhook' },
        ],
        notificationEmails: [
          { id: 'not1', name: 'Admin Notification' },
          { id: 'not2', name: 'User Notification' },
        ],
        confirmationEmails: [
          { id: 'conf1', name: 'Thank You Email' },
          { id: 'conf2', name: 'Confirmation Email' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.formstack.com/api/v2/form/5603242.json',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should handle form overview with minimal data', async () => {
      const mockFormData = {
        id: '5603242',
        name: 'Test Form',
        url: 'https://formstack.com/forms/test',
        edit_url: 'https://formstack.com/forms/test/edit',
        // Missing optional fields
      };

      // Mock all four API calls - form succeeds, others fail or return empty
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFormData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ webhooks: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ notifications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ confirmations: [] }),
        });

      const result = await client.formAndRelatedEntityOverview('5603242');

      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual({
        formId: '5603242',
        submissions: 0,
        version: 1,
        submissionsToday: 0,
        lastSubmissionId: null,
        url: 'https://formstack.com/forms/test',
        encrypted: false,
        isActive: true, // inactive undefined becomes isActive: true
        timezone: 'UTC',
        isOneQuestionAtATime: false,
        hasApprovers: false,
        isWorkflowForm: false,
        fieldCount: 0,
        submitActions: [],
        notificationEmails: [],
        confirmationEmails: [],
      });
    });

    it('should exclude is_workflow_published when is_workflow_form is false', async () => {
      const mockFormData = {
        id: '5603242',
        name: 'Test Form',
        url: 'https://formstack.com/forms/test',
        edit_url: 'https://formstack.com/forms/test/edit',
        is_workflow_form: false,
        is_workflow_published: true, // This should be ignored
      };

      // Mock all four API calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFormData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ webhooks: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ notifications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ confirmations: [] }),
        });

      const result = await client.formAndRelatedEntityOverview('5603242');

      expect(result.isSuccess).toBe(true);
      expect(result.response).not.toHaveProperty('isWorkflowPublished');
    });

    it('should handle form overview failure', async () => {
      // Only need to mock the first call since it fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Form not found' }),
      });

      const result = await client.formAndRelatedEntityOverview('5603242');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toContain('Form not found');
    });
  });
});
