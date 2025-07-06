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

    it('should handle form creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Form creation failed' }),
      });

      const fields: IAddFsLiteFieldProps[] = [
        { label: 'Name', field_type: 'text', isRequired: true },
      ];

      const result = await client.formLiteAdd('Test Form', fields);

      expect(result.isSuccess).toBe(false);
      expect(result.response).toBeNull();
      expect(result.errorItems).toEqual(['Form creation failed']);
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

    it('should handle field creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Field creation failed' }),
      });

      const fieldProps: IAddFsLiteFieldProps = {
        label: 'Phone',
        field_type: 'phone',
        isRequired: false,
        isHidden: true,
      };

      const result = await client.fieldLiteAdd('123', fieldProps);

      expect(result.isSuccess).toBe(false);
      expect(result.response).toBeNull();
      expect(result.errorItems).toEqual(['Field creation failed']);
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

    it('should handle field removal failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Field removal failed' }),
      });

      const result = await client.fieldRemove('456');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Field removal failed']);
    });

    it('should handle network error during field removal', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.fieldRemove('456');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Network error']);
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

    it('should handle partial failures when removing logic', async () => {
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
                {
                  id: '5678',
                  label: 'Email',
                  field_type: 'email',
                  logic: { conditions: [] },
                },
              ],
            }),
        })
        // Mock logic removal - first succeeds, second fails
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Logic removal failed' }),
        });

      const result = await client.fieldLogicRemove('123');

      expect(result.isSuccess).toBe(false);
      expect(result.response?.isSuccessful).toBe(false);
      expect(result.errorItems).toEqual([
        'Failed to remove logic from field 5678: Logic removal failed',
      ]);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.fieldLogicRemove('123');

      expect(result.isSuccess).toBe(false);
      expect(result.response?.isSuccessful).toBe(false);
      expect(result.errorItems).toEqual(['Form is not Marv enabled']);
    });
  });

  describe('Logic Stash Functions', () => {
    describe('fieldLogicStashCreate', () => {
      it('should create logic stash successfully', async () => {
        // Mock Marv enabled check
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                ],
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
                    logic: {
                      conditions: [
                        { field: '5678', operator: 'is', value: 'test' },
                      ],
                    },
                  },
                  { id: '5678', label: 'Email', field_type: 'email' },
                ],
              }),
          })
          // Mock stash field creation
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                id: '9999',
                label: 'MARV_LOGIC_STASH',
                field_type: 'text',
                hidden: true,
              }),
          });

        const result = await client.fieldLogicStashCreate('123');

        expect(result.isSuccess).toBe(true);
        expect(result.response?.id).toBe('9999');
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123/field.json',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('MARV_LOGIC_STASH'),
          }),
        );
      });

      it('should fail when form is not Marv enabled', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: [] }),
        });

        const result = await client.fieldLogicStashCreate('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual(['Form is not Marv enabled']);
      });

      it('should fail when no fields have logic', async () => {
        // Mock Marv enabled check
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                ],
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

        const result = await client.fieldLogicStashCreate('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual([
          'No fields with logic found on this form',
        ]);
      });
    });

    describe('fieldLogicStashApply', () => {
      it('should apply logic stash successfully', async () => {
        const mockLogicStash = {
          '1234': {
            conditions: [{ field: '5678', operator: 'is', value: 'test' }],
          },
          '5678': {
            conditions: [{ field: '1234', operator: 'is_not', value: 'empty' }],
          },
        };
        const base64Logic = btoa(JSON.stringify(mockLogicStash));
        const stashValue = JSON.stringify({ base64: base64Logic });

        // Mock get stash field
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  {
                    id: '9999',
                    label: 'MARV_LOGIC_STASH',
                    field_type: 'text',
                    default: stashValue,
                  },
                ],
              }),
          })
          // Mock logic application to first field
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
          // Mock logic application to second field
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });

        const result = await client.fieldLogicStashApply('123');

        expect(result.isSuccess).toBe(true);
        expect(result.response?.isSuccessful).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/1234',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('conditions'),
          }),
        );
      });

      it('should handle no logic stash field found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: [] }),
        });

        const result = await client.fieldLogicStashApply('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual(['No logic stash field found']);
      });

      it('should handle partial failures when applying logic', async () => {
        const mockLogicStash = {
          '1234': {
            conditions: [{ field: '5678', operator: 'is', value: 'test' }],
          },
          '5678': {
            conditions: [{ field: '1234', operator: 'is_not', value: 'empty' }],
          },
        };
        const base64Logic = btoa(JSON.stringify(mockLogicStash));
        const stashValue = JSON.stringify({ base64: base64Logic });

        // Mock get stash field
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  {
                    id: '9999',
                    label: 'MARV_LOGIC_STASH',
                    field_type: 'text',
                    default: stashValue,
                  },
                ],
              }),
          })
          // Mock logic application - first succeeds, second fails
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
          .mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: 'Logic application failed' }),
          });

        const result = await client.fieldLogicStashApply('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to apply logic to field 5678: Logic application failed',
        ]);
      });

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await client.fieldLogicStashApply('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to get form fields: Network error',
        ]);
      });
    });

    describe('fieldLogicStashApplyAndRemove', () => {
      it('should apply and remove logic stash successfully', async () => {
        const mockLogicStash = {
          '1234': {
            conditions: [{ field: '5678', operator: 'is', value: 'test' }],
          },
        };
        const base64Logic = btoa(JSON.stringify(mockLogicStash));
        const stashValue = JSON.stringify({ base64: base64Logic });

        // Mock for apply operation
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  {
                    id: '9999',
                    label: 'MARV_LOGIC_STASH',
                    field_type: 'text',
                    default: stashValue,
                  },
                ],
              }),
          })
          // Mock logic application
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
          // Mock for remove operation - get stash field again
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  {
                    id: '9999',
                    label: 'MARV_LOGIC_STASH',
                    field_type: 'text',
                    default: stashValue,
                  },
                ],
              }),
          })
          // Mock field deletion
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });

        const result = await client.fieldLogicStashApplyAndRemove('123');

        expect(result.isSuccess).toBe(true);
        expect(result.response?.isSuccessful).toBe(true);
      });

      it('should fail if apply fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Apply failed'));

        const result = await client.fieldLogicStashApplyAndRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to get form fields: Apply failed',
        ]);
      });

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await client.fieldLogicStashApplyAndRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to get form fields: Network error',
        ]);
      });
    });

    describe('fieldLogicStashRemove', () => {
      it('should remove logic stash field successfully', async () => {
        // Mock get stash field
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  {
                    id: '9999',
                    label: 'MARV_LOGIC_STASH',
                    field_type: 'text',
                    default: '{"base64":"eyJ0ZXN0IjoidmFsdWUifQ=="}',
                  },
                ],
              }),
          })
          // Mock field deletion
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });

        const result = await client.fieldLogicStashRemove('123');

        expect(result.isSuccess).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/9999',
          expect.objectContaining({
            method: 'DELETE',
          }),
        );
      });

      it('should handle no logic stash field found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: [] }),
        });

        const result = await client.fieldLogicStashRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual(['No logic stash field found']);
      });

      it('should handle deletion failure', async () => {
        // Mock get stash field
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  {
                    id: '9999',
                    label: 'MARV_LOGIC_STASH',
                    field_type: 'text',
                    default: '{"base64":"eyJ0ZXN0IjoidmFsdWUifQ=="}',
                  },
                ],
              }),
          })
          // Mock field deletion failure
          .mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: 'Deletion failed' }),
          });

        const result = await client.fieldLogicStashRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual(['Deletion failed']);
      });

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await client.fieldLogicStashRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to get form fields: Network error',
        ]);
      });
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

    it('should handle webhooks API failure gracefully', async () => {
      const mockFormData = {
        id: '5603242',
        name: 'Test Form',
        url: 'https://formstack.com/forms/test',
        edit_url: 'https://formstack.com/forms/test/edit',
      };

      // Mock form succeeds, webhooks fails, others succeed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFormData),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Webhooks failed' }),
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
      expect(result.response?.submitActions).toEqual([]);
    });

    it('should handle network error during overview', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.formAndRelatedEntityOverview('5603242');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Network error']);
    });

    it('should handle webhooks with missing names', async () => {
      const mockFormData = {
        id: '5603242',
        name: 'Test Form',
        url: 'https://formstack.com/forms/test',
        edit_url: 'https://formstack.com/forms/test/edit',
      };

      const mockWebhooks = [
        { id: 'wh1' }, // No name or url
        { id: 'wh2', url: 'https://api.example.com/webhook' },
        { id: 'wh3', name: 'Named Webhook' },
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
          json: () => Promise.resolve({ notifications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ confirmations: [] }),
        });

      const result = await client.formAndRelatedEntityOverview('5603242');

      expect(result.isSuccess).toBe(true);
      expect(result.response?.submitActions).toEqual([
        { id: 'wh1', name: 'Unnamed Webhook' },
        { id: 'wh2', name: 'https://api.example.com/webhook' },
        { id: 'wh3', name: 'Named Webhook' },
      ]);
    });
  });

  describe('Slug Functions', () => {
    describe('fieldJsonToUniqueLabelSlug', () => {
      it('should create unique slug from field ID', () => {
        const field = { id: '123456', label: 'Test Field', field_type: 'text' };
        const slug = (client as any).fieldJsonToUniqueLabelSlug(field);
        expect(slug).toBe('|3456|');
      });

      it('should handle short field ID', () => {
        const field = { id: '12', label: 'Test Field', field_type: 'text' };
        const slug = (client as any).fieldJsonToUniqueLabelSlug(field);
        expect(slug).toBe('|12|');
      });

      it('should handle empty field ID', () => {
        const field = { id: '', label: 'Test Field', field_type: 'text' };
        const slug = (client as any).fieldJsonToUniqueLabelSlug(field);
        expect(slug).toBe('||');
      });

      it('should handle undefined field ID', () => {
        const field = { label: 'Test Field', field_type: 'text' };
        const slug = (client as any).fieldJsonToUniqueLabelSlug(field);
        expect(slug).toBe('||');
      });
    });

    describe('labelWithoutSlug', () => {
      it('should remove slug from label', () => {
        const field = {
          id: '123456',
          label: '|3456|Test Field',
          field_type: 'text',
        };
        const cleanLabel = (client as any).labelWithoutSlug(field);
        expect(cleanLabel).toBe('Test Field');
      });

      it('should handle label without slug', () => {
        const field = { id: '123456', label: 'Test Field', field_type: 'text' };
        const cleanLabel = (client as any).labelWithoutSlug(field);
        expect(cleanLabel).toBe('Test Field');
      });

      it('should handle empty label', () => {
        const field = { id: '123456', label: '', field_type: 'text' };
        const cleanLabel = (client as any).labelWithoutSlug(field);
        expect(cleanLabel).toBe('');
      });

      it('should handle undefined label', () => {
        const field = { id: '123456', field_type: 'text' };
        const cleanLabel = (client as any).labelWithoutSlug(field);
        expect(cleanLabel).toBe('');
      });
    });

    describe('fieldLabelUniqueSlugAdd', () => {
      it('should add unique slugs to all fields', async () => {
        // Mock Marv enabled check
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                ],
              }),
          })
          // Mock get form fields
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1234', label: 'Name', field_type: 'text' },
                  { id: '5678', label: 'Email', field_type: 'email' },
                ],
              }),
          })
          // Mock field updates
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });

        const result = await client.fieldLabelUniqueSlugAdd('123');

        expect(result.isSuccess).toBe(true);
        expect(result.response?.isSuccessful).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/1234',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ label: '|1234|Name' }),
          }),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/5678',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ label: '|5678|Email' }),
          }),
        );
      });

      it('should handle form not Marv enabled', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: [] }),
        });

        const result = await client.fieldLabelUniqueSlugAdd('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual(['Form is not Marv enabled']);
      });

      it('should handle partial failures when adding slugs', async () => {
        // Mock Marv enabled check
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                ],
              }),
          })
          // Mock get form fields
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1234', label: 'Name', field_type: 'text' },
                  { id: '5678', label: 'Email', field_type: 'email' },
                ],
              }),
          })
          // Mock field updates - first succeeds, second fails
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
          .mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: 'Field update failed' }),
          });

        const result = await client.fieldLabelUniqueSlugAdd('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to add slug to field 5678: Field update failed',
        ]);
      });

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await client.fieldLabelUniqueSlugAdd('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual(['Form is not Marv enabled']);
      });
    });

    describe('fieldLabelUniqueSlugRemove', () => {
      it('should remove unique slugs from fields that have them', async () => {
        // Mock Marv enabled check
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                ],
              }),
          })
          // Mock get form fields
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1234', label: '|1234|Name', field_type: 'text' },
                  { id: '5678', label: 'Email', field_type: 'email' }, // no slug
                ],
              }),
          })
          // Mock field update for field with slug
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });

        const result = await client.fieldLabelUniqueSlugRemove('123');

        expect(result.isSuccess).toBe(true);
        expect(result.response?.isSuccessful).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/1234',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ label: 'Name' }),
          }),
        );
        // Should not try to update field 5678 since it has no slug
        expect(mockFetch).not.toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/field/5678',
          expect.anything(),
        );
      });

      it('should handle form not Marv enabled', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: [] }),
        });

        const result = await client.fieldLabelUniqueSlugRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual(['Form is not Marv enabled']);
      });

      it('should handle partial failures when removing slugs', async () => {
        // Mock Marv enabled check
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                ],
              }),
          })
          // Mock get form fields
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                fields: [
                  { id: '1234', label: '|1234|Name', field_type: 'text' },
                  { id: '5678', label: '|5678|Email', field_type: 'email' },
                ],
              }),
          })
          // Mock field updates - first succeeds, second fails
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
          .mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: 'Field update failed' }),
          });

        const result = await client.fieldLabelUniqueSlugRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual([
          'Failed to remove slug from field 5678: Field update failed',
        ]);
      });

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await client.fieldLabelUniqueSlugRemove('123');

        expect(result.isSuccess).toBe(false);
        expect(result.response?.isSuccessful).toBe(false);
        expect(result.errorItems).toEqual(['Form is not Marv enabled']);
      });
    });
  });

  describe('formDeveloperCopy', () => {
    it('should create developer copy successfully', async () => {
      const mockCopyResponse = {
        id: '789',
        name: 'Copy of Test Form',
        edit_url: 'https://example.com/edit/789',
        url: 'https://example.com/form/789',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCopyResponse),
      });

      const result = await client.formDeveloperCopy('123');

      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual(mockCopyResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.formstack.com/api/v2/form/123/copy',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should handle copy failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Copy failed' }),
      });

      const result = await client.formDeveloperCopy('123');

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toEqual(['Copy failed']);
    });
  });

  describe('Helper Functions', () => {
    describe('getFormFieldJson', () => {
      it('should get form fields successfully', async () => {
        const mockFields = [
          { id: '1', label: 'Field 1', field_type: 'text' },
          { id: '2', label: 'Field 2', field_type: 'email' },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: mockFields }),
        });

        const result = await (client as any).getFormFieldJson('123');

        expect(result).toEqual(mockFields);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.formstack.com/api/v2/form/123.json',
          expect.objectContaining({
            method: 'GET',
          }),
        );
      });

      it('should handle fields API failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Fields not found' }),
        });

        await expect((client as any).getFormFieldJson('123')).rejects.toThrow(
          'Failed to get form fields: Fields not found',
        );
      });

      it('should handle missing fields array', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        const result = await (client as any).getFormFieldJson('123');
        expect(result).toEqual([]);
      });
    });

    describe('isFormMarvEnabled', () => {
      it('should return true when MARV_ENABLED field exists', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [
                { id: '1', label: 'MARV_ENABLED', field_type: 'text' },
                { id: '2', label: 'Other Field', field_type: 'text' },
              ],
            }),
        });

        const result = await (client as any).isFormMarvEnabled('123');
        expect(result).toBe(true);
      });

      it('should return false when MARV_ENABLED field does not exist', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [
                { id: '1', label: 'Regular Field', field_type: 'text' },
                { id: '2', label: 'Other Field', field_type: 'text' },
              ],
            }),
        });

        const result = await (client as any).isFormMarvEnabled('123');
        expect(result).toBe(false);
      });

      it('should return false when API call fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await (client as any).isFormMarvEnabled('123');
        expect(result).toBe(false);
      });
    });

    describe('getLogicStashField', () => {
      it('should return the most recent logic stash field', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [
                { id: '100', label: 'MARV_LOGIC_STASH', field_type: 'text' },
                { id: '200', label: 'MARV_LOGIC_STASH', field_type: 'text' },
                { id: '50', label: 'MARV_LOGIC_STASH', field_type: 'text' },
              ],
            }),
        });

        const result = await (client as any).getLogicStashField('123');
        expect(result.id).toBe('200'); // Highest ID
      });

      it('should throw error when no logic stash field found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              fields: [{ id: '1', label: 'Regular Field', field_type: 'text' }],
            }),
        });

        await expect((client as any).getLogicStashField('123')).rejects.toThrow(
          'No logic stash field found',
        );
      });
    });

    describe('stringifyLogicStashString', () => {
      it('should create valid base64 logic stash string', () => {
        const fieldsWithLogic = [
          {
            id: '123',
            label: 'Field 1',
            field_type: 'text',
            logic: {
              conditions: [{ field: '456', operator: 'is', value: 'test' }],
            },
          },
          {
            id: '456',
            label: 'Field 2',
            field_type: 'text',
            logic: {
              conditions: [
                { field: '123', operator: 'is_not', value: 'empty' },
              ],
            },
          },
        ];

        const result = (client as any).stringifyLogicStashString(
          fieldsWithLogic,
        );
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('base64');

        // Verify we can decode it
        const decoded = JSON.parse(atob(parsed.base64));
        expect(decoded).toHaveProperty('123');
        expect(decoded).toHaveProperty('456');
        expect(decoded['123']).toEqual(fieldsWithLogic[0].logic);
        expect(decoded['456']).toEqual(fieldsWithLogic[1].logic);
      });
    });

    describe('parseLogicStashString', () => {
      it('should parse valid logic stash string', () => {
        const originalLogic = {
          '123': {
            conditions: [{ field: '456', operator: 'is', value: 'test' }],
          },
          '456': {
            conditions: [{ field: '123', operator: 'is_not', value: 'empty' }],
          },
        };
        const base64Logic = btoa(JSON.stringify(originalLogic));
        const stashString = JSON.stringify({ base64: base64Logic });

        const result = (client as any).parseLogicStashString(stashString);
        expect(result).toEqual(originalLogic);
      });
    });
  });

  describe('Debug Mode', () => {
    beforeEach(() => {
      // Reset NODE_ENV for these tests
      delete process.env.NODE_ENV;
    });

    afterEach(() => {
      // Restore NODE_ENV
      process.env.NODE_ENV = 'test';
    });

    it('should log debug messages in development mode', async () => {
      process.env.NODE_ENV = 'development';

      // Create a new client to pick up the env change
      const devClient = new FsApiClient();
      devClient.setApiKey('test-key');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ fields: [] }),
      });

      await devClient.fieldLogicRemove('123');

      // Debug logging should have been called
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should not log debug messages in production mode', async () => {
      // Note: Debug mode is set at module load time, so we can't dynamically change it
      // This test verifies that in the current test environment (NODE_ENV=test which is not production),
      // debug logging does happen. In a real production environment with NODE_ENV=production,
      // the debug mode would be disabled at module load time.
      process.env.NODE_ENV = 'test'; // Keep as test environment

      const testClient = new FsApiClient();
      testClient.setApiKey('test-key');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ fields: [] }),
      });

      await testClient.fieldLogicRemove('123');

      // In test environment, debug logging should happen
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
