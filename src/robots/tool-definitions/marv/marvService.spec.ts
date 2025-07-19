import { MarvService } from './marvService';
import { FsApiClient } from './fsApiClient';
import { ObservationMakerLogicValidation } from '../../../common/observation-makers/ObservationMakerLogicValidation';
import { ObservationMakerCalculationValidation } from '../../../common/observation-makers/ObservationMakerCalculationValidation';
import { Models } from 'istack-buddy-utilities';

// Mock the observation makers
jest.mock('../../../common/observation-makers/ObservationMakerLogicValidation');
jest.mock(
  '../../../common/observation-makers/ObservationMakerCalculationValidation',
);
jest.mock('istack-buddy-utilities');

describe('MarvService', () => {
  let marvService: MarvService;
  let mockApiClient: jest.Mocked<FsApiClient>;

  beforeEach(() => {
    mockApiClient = {
      postForm: jest.fn(),
      postField: jest.fn(),
      deleteField: jest.fn(),
      postFormCopy: jest.fn(),
      isFormMarvEnabled: jest.fn(),
      getFormFieldsJson: jest.fn(),
      putFieldLogic: jest.fn(),
      putField: jest.fn(),
      getFormJson: jest.fn(),
      getFormWebhooks: jest.fn(),
      getFormNotifications: jest.fn(),
      getFormConfirmations: jest.fn(),
      refreshApiKeyFromEnvironment: jest.fn(),
    } as any;

    marvService = new MarvService(mockApiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a new MarvService instance with API client', () => {
      expect(marvService).toBeInstanceOf(MarvService);
    });
  });

  describe('formLiteAdd', () => {
    it('should successfully create a form with fields', async () => {
      const mockResponse = {
        isSuccess: true,
        response: {
          id: '123',
          name: 'Test Form',
          edit_url: 'https://formstack.com/edit/123',
          url: 'https://formstack.com/view/123',
        },
        errorItems: null,
      };

      mockApiClient.postForm.mockResolvedValue(mockResponse);

      const result = await marvService.formLiteAdd('Test Form', [
        {
          label: 'Name',
          field_type: 'text',
          isRequired: true,
          isHidden: false,
        },
      ]);

      expect(mockApiClient.postForm).toHaveBeenCalledWith('Test Form', [
        {
          label: 'Name',
          field_type: 'text',
          isRequired: true,
          isHidden: false,
        },
      ]);
      expect(result).toEqual({
        isSuccess: true,
        response: {
          editUrl: 'https://formstack.com/edit/123',
          viewUrl: 'https://formstack.com/view/123',
          formId: '123',
          isSuccess: true,
        },
        errorItems: null,
      });
    });

    it('should handle API failure', async () => {
      const mockResponse = {
        isSuccess: false,
        response: null,
        errorItems: ['API Error'],
      };

      mockApiClient.postForm.mockResolvedValue(mockResponse);

      const result = await marvService.formLiteAdd('Test Form', []);

      expect(result).toEqual(mockResponse);
    });

    it('should handle API exception', async () => {
      mockApiClient.postForm.mockRejectedValue(new Error('Network error'));

      const result = await marvService.formLiteAdd('Test Form', []);

      expect(result).toEqual({
        isSuccess: false,
        response: null,
        errorItems: ['Network error'],
      });
    });
  });

  describe('fieldLiteAdd', () => {
    it('should successfully add a field to a form', async () => {
      const mockResponse = {
        isSuccess: true,
        response: {
          id: 'field123',
          label: 'Test Field',
          field_type: 'text' as const,
        },
        errorItems: null,
      };

      mockApiClient.postField.mockResolvedValue(mockResponse);

      const result = await marvService.fieldLiteAdd('form123', {
        label: 'Test Field',
        field_type: 'text',
        isRequired: true,
        isHidden: false,
      });

      expect(mockApiClient.postField).toHaveBeenCalledWith('form123', {
        field_type: 'text',
        label: 'Test Field',
        hidden: '0',
        require: '1',
      });
      expect(result).toEqual({
        isSuccess: true,
        response: {
          fieldId: 'field123',
          fieldJson: {
            id: 'field123',
            label: 'Test Field',
            field_type: 'text',
          },
        },
        errorItems: null,
      });
    });

    it('should handle hidden and required field properties correctly', async () => {
      const mockResponse = {
        isSuccess: true,
        response: {
          id: 'field123',
          label: 'Hidden Field',
          field_type: 'text' as const,
        },
        errorItems: null,
      };

      mockApiClient.postField.mockResolvedValue(mockResponse);

      await marvService.fieldLiteAdd('form123', {
        label: 'Hidden Field',
        field_type: 'text',
        isRequired: false,
        isHidden: true,
      });

      expect(mockApiClient.postField).toHaveBeenCalledWith('form123', {
        field_type: 'text',
        label: 'Hidden Field',
        hidden: '1',
        require: '0',
      });
    });
  });

  describe('fieldRemove', () => {
    it('should delete a field', async () => {
      const mockResponse = {
        isSuccess: true,
        response: { deleted: true },
        errorItems: null,
      };

      mockApiClient.deleteField.mockResolvedValue(mockResponse);

      const result = await marvService.fieldRemove('field123');

      expect(mockApiClient.deleteField).toHaveBeenCalledWith('field123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('formDeveloperCopy', () => {
    it('should copy a form', async () => {
      const mockResponse = {
        isSuccess: true,
        response: {
          id: 'copy123',
          name: 'Copied Form',
          url: 'https://formstack.com/copy123',
          edit_url: 'https://formstack.com/edit/copy123',
        },
        errorItems: null,
      };

      mockApiClient.postFormCopy.mockResolvedValue(mockResponse);

      const result = await marvService.formDeveloperCopy('form123');

      expect(mockApiClient.postFormCopy).toHaveBeenCalledWith('form123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fieldLogicStashCreate', () => {
    it('should create logic stash when form has fields with logic', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [
            { id: '1', label: 'Field 1', logic: { action: 'show' } },
            { id: '2', label: 'Field 2', logic: null },
            { id: '3', label: 'Field 3', logic: { action: 'hide' } },
          ],
        },
        errorItems: null,
      });
      mockApiClient.postField.mockResolvedValue({
        isSuccess: true,
        response: { id: 'stash123' },
        errorItems: null,
      });

      const result = await marvService.fieldLogicStashCreate('form123');

      expect(mockApiClient.isFormMarvEnabled).toHaveBeenCalledWith('form123');
      expect(mockApiClient.getFormFieldsJson).toHaveBeenCalledWith('form123');
      expect(mockApiClient.postField).toHaveBeenCalledWith('form123', {
        field_type: 'text',
        hidden: true,
        default_value: expect.any(String),
        default: expect.any(String),
        label: 'MARV_LOGIC_STASH',
      });
      expect(result.isSuccess).toBe(true);
    });

    it('should fail when form is not Marv enabled', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(false);

      const result = await marvService.fieldLogicStashCreate('form123');

      expect(result).toEqual({
        isSuccess: false,
        response: null,
        errorItems: ['Form is not Marv enabled'],
      });
    });

    it('should fail when no fields have logic', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [
            { id: '1', label: 'Field 1', logic: null },
            { id: '2', label: 'Field 2', logic: null },
          ],
        },
        errorItems: null,
      });

      const result = await marvService.fieldLogicStashCreate('form123');

      expect(result).toEqual({
        isSuccess: false,
        response: null,
        errorItems: ['No fields with logic found on this form'],
      });
    });
  });

  describe('fieldLogicStashApply', () => {
    it('should apply stashed logic to fields', async () => {
      const mockStashField = {
        id: 'stash123',
        default: JSON.stringify({
          base64: btoa(
            JSON.stringify({
              field1: { action: 'show' },
              field2: { action: 'hide' },
            }),
          ),
        }),
      };

      // Mock the private method by accessing it through the instance
      const getLogicStashFieldSpy = jest.spyOn(
        marvService as any,
        'getLogicStashField',
      );
      getLogicStashFieldSpy.mockResolvedValue(mockStashField);

      mockApiClient.putFieldLogic
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        })
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        });

      const result = await marvService.fieldLogicStashApply('form123');

      expect(getLogicStashFieldSpy).toHaveBeenCalledWith('form123');
      expect(mockApiClient.putFieldLogic).toHaveBeenCalledWith('field1', {
        action: 'show',
      });
      expect(mockApiClient.putFieldLogic).toHaveBeenCalledWith('field2', {
        action: 'hide',
      });
      expect(result).toEqual({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
    });

    it('should handle partial failures in batch operations', async () => {
      const mockStashField = {
        id: 'stash123',
        default: JSON.stringify({
          base64: btoa(
            JSON.stringify({
              field1: { action: 'show' },
              field2: { action: 'hide' },
            }),
          ),
        }),
      };

      const getLogicStashFieldSpy = jest.spyOn(
        marvService as any,
        'getLogicStashField',
      );
      getLogicStashFieldSpy.mockResolvedValue(mockStashField);

      mockApiClient.putFieldLogic
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        })
        .mockResolvedValueOnce({
          isSuccess: false,
          response: null,
          errorItems: ['API Error'],
        });

      const result = await marvService.fieldLogicStashApply('form123');

      expect(result).toEqual({
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: ['Failed to apply logic to field field2: API Error'],
      });
    });
  });

  describe('fieldLogicStashApplyAndRemove', () => {
    it('should apply logic and then remove stash field', async () => {
      const applySpy = jest.spyOn(marvService, 'fieldLogicStashApply');
      const removeSpy = jest.spyOn(marvService, 'fieldLogicStashRemove');

      applySpy.mockResolvedValue({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
      removeSpy.mockResolvedValue({
        isSuccess: true,
        response: { deleted: true },
        errorItems: null,
      });

      const result = await marvService.fieldLogicStashApplyAndRemove('form123');

      expect(applySpy).toHaveBeenCalledWith('form123');
      expect(removeSpy).toHaveBeenCalledWith('form123');
      expect(result).toEqual({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
    });

    it('should stop if apply fails', async () => {
      const applySpy = jest.spyOn(marvService, 'fieldLogicStashApply');
      const removeSpy = jest.spyOn(marvService, 'fieldLogicStashRemove');

      applySpy.mockResolvedValue({
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: ['Apply failed'],
      });

      const result = await marvService.fieldLogicStashApplyAndRemove('form123');

      expect(applySpy).toHaveBeenCalledWith('form123');
      expect(removeSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: ['Apply failed'],
      });
    });
  });

  describe('fieldLogicStashRemove', () => {
    it('should remove the logic stash field', async () => {
      const mockStashField = { id: 'stash123' };
      const getLogicStashFieldSpy = jest.spyOn(
        marvService as any,
        'getLogicStashField',
      );
      getLogicStashFieldSpy.mockResolvedValue(mockStashField);

      mockApiClient.deleteField.mockResolvedValue({
        isSuccess: true,
        response: { deleted: true },
        errorItems: null,
      });

      const result = await marvService.fieldLogicStashRemove('form123');

      expect(getLogicStashFieldSpy).toHaveBeenCalledWith('form123');
      expect(mockApiClient.deleteField).toHaveBeenCalledWith('stash123');
      expect(result).toEqual({
        isSuccess: true,
        response: { deleted: true },
        errorItems: null,
      });
    });
  });

  describe('fieldLogicRemove', () => {
    it('should remove logic from all fields with logic', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [
            { id: '1', label: 'Field 1', logic: { action: 'show' } },
            { id: '2', label: 'Field 2', logic: null },
            { id: '3', label: 'Field 3', logic: { action: 'hide' } },
          ],
        },
        errorItems: null,
      });

      mockApiClient.putFieldLogic
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        })
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        });

      const result = await marvService.fieldLogicRemove('form123');

      expect(mockApiClient.putFieldLogic).toHaveBeenCalledWith('1', null);
      expect(mockApiClient.putFieldLogic).toHaveBeenCalledWith('3', null);
      expect(result).toEqual({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
    });

    it('should return success when no fields have logic', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [
            { id: '1', label: 'Field 1', logic: null },
            { id: '2', label: 'Field 2', logic: null },
          ],
        },
        errorItems: null,
      });

      const result = await marvService.fieldLogicRemove('form123');

      expect(mockApiClient.putFieldLogic).not.toHaveBeenCalled();
      expect(result).toEqual({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
    });
  });

  describe('fieldLabelUniqueSlugAdd', () => {
    it('should add unique slugs to all field labels', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [
            { id: '1234', label: 'Name' },
            { id: '5678', label: 'Email' },
          ],
        },
        errorItems: null,
      });

      mockApiClient.putField
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        })
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        });

      const result = await marvService.fieldLabelUniqueSlugAdd('form123');

      expect(mockApiClient.putField).toHaveBeenCalledWith('1234', {
        label: '|1234|Name',
      });
      expect(mockApiClient.putField).toHaveBeenCalledWith('5678', {
        label: '|5678|Email',
      });
      expect(result).toEqual({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
    });
  });

  describe('fieldLabelUniqueSlugRemove', () => {
    it('should remove unique slugs from field labels', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [
            { id: '1234', label: '|1234|Name' },
            { id: '5678', label: '|5678|Email' },
            { id: '9999', label: 'No Slug' },
          ],
        },
        errorItems: null,
      });

      mockApiClient.putField
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        })
        .mockResolvedValueOnce({
          isSuccess: true,
          response: null,
          errorItems: null,
        });

      const result = await marvService.fieldLabelUniqueSlugRemove('form123');

      expect(mockApiClient.putField).toHaveBeenCalledWith('1234', {
        label: 'Name',
      });
      expect(mockApiClient.putField).toHaveBeenCalledWith('5678', {
        label: 'Email',
      });
      // Should not update fields without slugs
      expect(mockApiClient.putField).not.toHaveBeenCalledWith(
        '9999',
        expect.anything(),
      );
      expect(result).toEqual({
        isSuccess: true,
        response: { isSuccessful: true },
        errorItems: null,
      });
    });
  });

  describe('formAndRelatedEntityOverview', () => {
    it('should return comprehensive form overview', async () => {
      const mockFormResponse = {
        isSuccess: true,
        response: {
          id: 'form123',
          submissions: 100,
          version: 2,
          submissions_today: 5,
          last_submission_id: 'sub123',
          url: 'https://formstack.com/form123',
          encrypted: true,
          inactive: false,
          timezone: 'America/New_York',
          should_display_one_question_at_a_time: true,
          has_approvers: false,
          is_workflow_form: true,
          is_workflow_published: true,
          fields: [{ id: '1' }, { id: '2' }],
        },
        errorItems: null,
      };

      const mockWebhooksResponse = {
        isSuccess: true,
        response: {
          webhooks: [
            { id: 'web1', name: 'Webhook 1', url: 'https://webhook1.com' },
            { id: 'web2', name: null, url: 'https://webhook2.com' },
          ],
        },
        errorItems: null,
      };

      const mockNotificationsResponse = {
        isSuccess: true,
        response: {
          notifications: [
            { id: 'notif1', name: 'Notification 1', subject: 'Subject 1' },
            { id: 'notif2', name: null, subject: 'Subject 2' },
          ],
        },
        errorItems: null,
      };

      const mockConfirmationsResponse = {
        isSuccess: true,
        response: {
          confirmations: [
            { id: 'conf1', name: 'Confirmation 1', subject: 'Conf Subject 1' },
            { id: 'conf2', name: null, subject: 'Conf Subject 2' },
          ],
        },
        errorItems: null,
      };

      mockApiClient.getFormJson.mockResolvedValue(mockFormResponse);
      mockApiClient.getFormWebhooks.mockResolvedValue(mockWebhooksResponse);
      mockApiClient.getFormNotifications.mockResolvedValue(
        mockNotificationsResponse,
      );
      mockApiClient.getFormConfirmations.mockResolvedValue(
        mockConfirmationsResponse,
      );

      const result = await marvService.formAndRelatedEntityOverview('form123');

      expect(result).toEqual({
        isSuccess: true,
        response: {
          formId: 'form123',
          submissions: 100,
          version: 2,
          submissionsToday: 5,
          lastSubmissionId: 'sub123',
          url: 'https://formstack.com/form123',
          encrypted: true,
          isActive: true,
          timezone: 'America/New_York',
          isOneQuestionAtATime: true,
          hasApprovers: false,
          isWorkflowForm: true,
          isWorkflowPublished: true,
          fieldCount: 2,
          submitActions: [
            { id: 'web1', name: 'Webhook 1' },
            { id: 'web2', name: 'https://webhook2.com' },
          ],
          notificationEmails: [
            { id: 'notif1', name: 'Notification 1' },
            { id: 'notif2', name: 'Subject 2' },
          ],
          confirmationEmails: [
            { id: 'conf1', name: 'Confirmation 1' },
            { id: 'conf2', name: 'Conf Subject 2' },
          ],
        },
        errorItems: null,
      });
    });

    it('should handle form data failure', async () => {
      mockApiClient.getFormJson.mockResolvedValue({
        isSuccess: false,
        response: null,
        errorItems: ['Form not found'],
      });

      const result = await marvService.formAndRelatedEntityOverview('form123');

      expect(result).toEqual({
        isSuccess: false,
        response: null,
        errorItems: ['Form not found'],
      });
    });
  });

  describe('formLogicValidation', () => {
    it('should perform logic validation successfully', async () => {
      const mockFormData = {
        id: 'form123',
        fields: [{ id: '1', label: 'Field 1' }],
      };

      const mockObservationResult = {
        observations: [{ type: 'logic_error', message: 'Invalid logic' }],
      };

      mockApiClient.refreshApiKeyFromEnvironment.mockResolvedValue();
      mockApiClient.getFormJson.mockResolvedValue({
        isSuccess: true,
        response: mockFormData,
        errorItems: null,
      });

      const mockObservationMaker = {
        makeObservation: jest.fn().mockResolvedValue(mockObservationResult),
      };
      (
        ObservationMakerLogicValidation as jest.MockedClass<any>
      ).mockImplementation(() => mockObservationMaker);

      const mockFormModel = {};
      (Models.FsModelForm as jest.MockedClass<any>).mockImplementation(
        () => mockFormModel,
      );

      const result = await marvService.formLogicValidation('form123');

      expect(mockApiClient.refreshApiKeyFromEnvironment).toHaveBeenCalled();
      expect(mockApiClient.getFormJson).toHaveBeenCalledWith('form123');
      expect(Models.FsModelForm).toHaveBeenCalledWith(
        { ...mockFormData, fields: mockFormData.fields },
        { fieldModelVersion: 'v2' },
      );
      expect(mockObservationMaker.makeObservation).toHaveBeenCalledWith({
        resources: { formModel: mockFormModel },
      });
      expect(result).toEqual({
        isSuccess: true,
        response: mockObservationResult,
        errorItems: null,
      });
    });
  });

  describe('formCalculationValidation', () => {
    it('should perform calculation validation successfully', async () => {
      const mockFormData = {
        id: 'form123',
        fields: [{ id: '1', label: 'Field 1' }],
      };

      const mockObservationResult = {
        observations: [
          { type: 'calculation_error', message: 'Invalid calculation' },
        ],
      };

      mockApiClient.refreshApiKeyFromEnvironment.mockResolvedValue();
      mockApiClient.getFormJson.mockResolvedValue({
        isSuccess: true,
        response: mockFormData,
        errorItems: null,
      });

      const mockObservationMaker = {
        makeObservation: jest.fn().mockResolvedValue(mockObservationResult),
      };
      (
        ObservationMakerCalculationValidation as jest.MockedClass<any>
      ).mockImplementation(() => mockObservationMaker);

      const mockFormModel = {};
      (Models.FsModelForm as jest.MockedClass<any>).mockImplementation(
        () => mockFormModel,
      );

      const result = await marvService.formCalculationValidation('form123');

      expect(mockApiClient.refreshApiKeyFromEnvironment).toHaveBeenCalled();
      expect(mockApiClient.getFormJson).toHaveBeenCalledWith('form123');
      expect(Models.FsModelForm).toHaveBeenCalledWith(
        { ...mockFormData, fields: mockFormData.fields },
        { fieldModelVersion: 'v2' },
      );
      expect(mockObservationMaker.makeObservation).toHaveBeenCalledWith({
        resources: { formModel: mockFormModel },
      });
      expect(result).toEqual({
        isSuccess: true,
        response: mockObservationResult,
        errorItems: null,
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getLogicStashField', () => {
      it('should return the most recent logic stash field', async () => {
        mockApiClient.getFormFieldsJson.mockResolvedValue({
          isSuccess: true,
          response: {
            fields: [
              { id: '100', label: 'MARV_LOGIC_STASH' },
              { id: '200', label: 'MARV_LOGIC_STASH' },
              { id: '50', label: 'MARV_LOGIC_STASH' },
            ],
          },
          errorItems: null,
        });

        const result = await (marvService as any).getLogicStashField('form123');

        expect(result).toEqual({ id: '200', label: 'MARV_LOGIC_STASH' });
      });

      it('should throw error when no stash field found', async () => {
        mockApiClient.getFormFieldsJson.mockResolvedValue({
          isSuccess: true,
          response: { fields: [] },
          errorItems: null,
        });

        await expect(
          (marvService as any).getLogicStashField('form123'),
        ).rejects.toThrow('No logic stash field found');
      });
    });

    describe('stringifyLogicStashString', () => {
      it('should create base64 encoded logic stash string', () => {
        const fieldsWithLogic = [
          { id: '1', logic: { action: 'show' } },
          { id: '2', logic: { action: 'hide' } },
        ];

        const result = (marvService as any).stringifyLogicStashString(
          fieldsWithLogic,
        );

        const parsed = JSON.parse(result);
        const decoded = JSON.parse(atob(parsed.base64));

        expect(decoded).toEqual({
          '1': { action: 'show' },
          '2': { action: 'hide' },
        });
      });
    });

    describe('parseLogicStashString', () => {
      it('should parse base64 encoded logic stash string', () => {
        const logicData = {
          '1': { action: 'show' },
          '2': { action: 'hide' },
        };
        const encoded = JSON.stringify({
          base64: btoa(JSON.stringify(logicData)),
        });

        const result = (marvService as any).parseLogicStashString(encoded);

        expect(result).toEqual(logicData);
      });
    });

    describe('fieldJsonToUniqueLabelSlug', () => {
      it('should create slug from field ID', () => {
        const field = { id: '12345' };
        const result = (marvService as any).fieldJsonToUniqueLabelSlug(field);
        expect(result).toBe('|2345|');
      });

      it('should handle field without ID', () => {
        const field = {};
        const result = (marvService as any).fieldJsonToUniqueLabelSlug(field);
        expect(result).toBe('||');
      });
    });

    describe('labelWithoutSlug', () => {
      it('should remove slug from label', () => {
        const field = { id: '12345', label: '|2345|Test Label' };
        const result = (marvService as any).labelWithoutSlug(field);
        expect(result).toBe('Test Label');
      });

      it('should return original label if no slug present', () => {
        const field = { id: '12345', label: 'Test Label' };
        const result = (marvService as any).labelWithoutSlug(field);
        expect(result).toBe('Test Label');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      mockApiClient.isFormMarvEnabled.mockRejectedValue(
        new Error('Validation failed'),
      );

      const result = await marvService.fieldLogicRemove('form123');

      expect(result).toEqual({
        isSuccess: false,
        response: null,
        errorItems: ['Validation failed'],
      });
    });

    it('should handle batch operation failures', async () => {
      mockApiClient.isFormMarvEnabled.mockResolvedValue(true);
      mockApiClient.getFormFieldsJson.mockResolvedValue({
        isSuccess: true,
        response: {
          fields: [{ id: '1', label: 'Field 1', logic: { action: 'show' } }],
        },
        errorItems: null,
      });

      mockApiClient.putFieldLogic.mockResolvedValue({
        isSuccess: false,
        response: null,
        errorItems: ['Field update failed'],
      });

      const result = await marvService.fieldLogicRemove('form123');

      expect(result).toEqual({
        isSuccess: false,
        response: { isSuccessful: false },
        errorItems: [
          'Failed to remove logic from field 1: Field update failed',
        ],
      });
    });
  });
});
