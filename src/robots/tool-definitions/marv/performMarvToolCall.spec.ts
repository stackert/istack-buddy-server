import { performMarvToolCall } from './performMarvToolCall';
import { FsApiClient, fsApiClient, FsRestrictedApiRoutesEnum } from '.';
import type { IMarvApiUniversalResponse } from '.';

// Mock the fsApiClient
const mockFsApiClientInstance = {
  setApiKey: jest.fn().mockReturnThis(),
  fieldRemove: jest.fn(),
  formLiteAdd: jest.fn(),
  fieldLabelUniqueSlugAdd: jest.fn(),
  fieldLabelUniqueSlugRemove: jest.fn(),
  fieldLiteAdd: jest.fn(),
  fieldLogicRemove: jest.fn(),
  fieldLogicStashApply: jest.fn(),
  fieldLogicStashApplyAndRemove: jest.fn(),
  fieldLogicStashCreate: jest.fn(),
  fieldLogicStashRemove: jest.fn(),
  formDeveloperCopy: jest.fn(),
};

jest.mock('./fsApiClient', () => {
  const mockInstance = {
    setApiKey: jest.fn().mockReturnThis(),
    fieldRemove: jest.fn(),
    formLiteAdd: jest.fn(),
    fieldLabelUniqueSlugAdd: jest.fn(),
    fieldLabelUniqueSlugRemove: jest.fn(),
    fieldLiteAdd: jest.fn(),
    fieldLogicRemove: jest.fn(),
    fieldLogicStashApply: jest.fn(),
    fieldLogicStashApplyAndRemove: jest.fn(),
    fieldLogicStashCreate: jest.fn(),
    fieldLogicStashRemove: jest.fn(),
    formDeveloperCopy: jest.fn(),
  };
  return {
    FsApiClient: jest.fn().mockImplementation(() => mockInstance),
    fsApiClient: mockInstance,
  };
});

// Get the mocked module to access the mock instance
const { FsApiClient: MockFsApiClient } = jest.mocked(
  require('./fsApiClient'),
) as any;
const mockFsApiClient = new MockFsApiClient() as jest.Mocked<any>;

// Mock console.log to avoid cluttering test output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('performMarvToolCall', () => {
  const mockSuccessResponse: IMarvApiUniversalResponse<any> = {
    isSuccess: true,
    response: { id: '123', message: 'Success' },
    errorItems: null,
  };

  const mockFailureResponse: IMarvApiUniversalResponse<any> = {
    isSuccess: false,
    response: null,
    errorItems: ['API Error'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should log function call details', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall('fieldRemove', '{"fieldId":"123"}');

      expect(mockConsoleLog).toHaveBeenCalledWith({
        functionName: 'fieldRemove',
        fnParamsJson: { fieldId: '123' },
      });
    });

    it('should parse empty function arguments as empty object', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall('fieldRemove');

      expect(mockConsoleLog).toHaveBeenCalledWith({
        functionName: 'fieldRemove',
        fnParamsJson: {},
      });
    });

    it('should parse empty string function arguments as empty object', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall('fieldRemove', '');

      expect(mockConsoleLog).toHaveBeenCalledWith({
        functionName: 'fieldRemove',
        fnParamsJson: {},
      });
    });
  });

  describe('Special Function: fieldRemove', () => {
    it('should handle fieldRemove function', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        'fieldRemove',
        '{"fieldId":"456"}',
      );

      expect(mockFsApiClient.fieldRemove).toHaveBeenCalledWith('456');
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle fieldRemove without fieldId parameter', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall('fieldRemove', '{}');

      expect(mockFsApiClient.fieldRemove).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  describe('FsRestrictedApiRoutesEnum Functions', () => {
    describe('FormLiteAdd', () => {
      it('should handle FormLiteAdd with parameters', async () => {
        mockFsApiClient.formLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{"formName":"Test Form","fields":[{"label":"Name","field_type":"text"}]}',
        );

        expect(mockFsApiClient.formLiteAdd).toHaveBeenCalledWith('Test Form', [
          { label: 'Name', field_type: 'text' },
        ]);
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should apply default parameters for FormLiteAdd when none provided', async () => {
        mockFsApiClient.formLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{}',
        );

        expect(mockFsApiClient.formLiteAdd).toHaveBeenCalledWith(
          'Default Form',
          [],
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should merge provided parameters with defaults for FormLiteAdd', async () => {
        mockFsApiClient.formLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{"formName":"Custom Form"}',
        );

        expect(mockFsApiClient.formLiteAdd).toHaveBeenCalledWith(
          'Custom Form',
          [],
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FormLiteAdd failure and add error message', async () => {
        mockFsApiClient.formLiteAdd.mockResolvedValue(mockFailureResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{}',
        );

        expect(result.errorItems).toContain('API Error');
        expect(result.errorItems).toContain(
          `Function returned non-successful response. Function name: ${FsRestrictedApiRoutesEnum.FormLiteAdd}`,
        );
      });

      it('should handle FormLiteAdd with null errorItems and add error message', async () => {
        const responseWithNullErrors = {
          isSuccess: false,
          response: null,
          errorItems: null,
        };
        mockFsApiClient.formLiteAdd.mockResolvedValue(responseWithNullErrors);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{}',
        );

        expect(result.errorItems).toEqual([
          `Function returned non-successful response. Function name: ${FsRestrictedApiRoutesEnum.FormLiteAdd}`,
        ]);
      });
    });

    describe('Field Label Slug Functions', () => {
      it('should handle FieldLabelUniqueSlugAdd', async () => {
        mockFsApiClient.fieldLabelUniqueSlugAdd.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugAdd,
          '{"formId":"789"}',
        );

        expect(mockFsApiClient.fieldLabelUniqueSlugAdd).toHaveBeenCalledWith(
          '789',
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLabelUniqueSlugRemove', async () => {
        mockFsApiClient.fieldLabelUniqueSlugRemove.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugRemove,
          '{"formId":"789"}',
        );

        expect(mockFsApiClient.fieldLabelUniqueSlugRemove).toHaveBeenCalledWith(
          '789',
        );
        expect(result).toEqual(mockSuccessResponse);
      });
    });

    describe('FieldLiteAdd', () => {
      it('should handle FieldLiteAdd with fields parameter', async () => {
        mockFsApiClient.fieldLiteAdd.mockResolvedValue(mockSuccessResponse);

        const fieldData = { label: 'Email', field_type: 'email' };
        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLiteAdd,
          `{"formId":"123","fields":${JSON.stringify(fieldData)}}`,
        );

        expect(mockFsApiClient.fieldLiteAdd).toHaveBeenCalledWith(
          '123',
          fieldData,
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLiteAdd without fields parameter', async () => {
        mockFsApiClient.fieldLiteAdd.mockResolvedValue(mockSuccessResponse);

        const fieldData = { label: 'Name', field_type: 'text' };
        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLiteAdd,
          JSON.stringify(fieldData),
        );

        expect(mockFsApiClient.fieldLiteAdd).toHaveBeenCalledWith(
          undefined,
          fieldData,
        );
        expect(result).toEqual(mockSuccessResponse);
      });
    });

    describe('Field Logic Functions', () => {
      it('should handle FieldLogicRemove', async () => {
        mockFsApiClient.fieldLogicRemove.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicRemove,
          '{"formId":"456"}',
        );

        expect(mockFsApiClient.fieldLogicRemove).toHaveBeenCalledWith('456');
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashApply', async () => {
        mockFsApiClient.fieldLogicStashApply.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashApply,
          '{"formId":"456"}',
        );

        expect(mockFsApiClient.fieldLogicStashApply).toHaveBeenCalledWith(
          '456',
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashApplyAndRemove', async () => {
        mockFsApiClient.fieldLogicStashApplyAndRemove.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashApplyAndRemove,
          '{"formId":"456"}',
        );

        expect(
          mockFsApiClient.fieldLogicStashApplyAndRemove,
        ).toHaveBeenCalledWith('456');
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashCreate and log parameters', async () => {
        mockFsApiClient.fieldLogicStashCreate.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashCreate,
          '{"formId":"456"}',
        );

        expect(mockFsApiClient.fieldLogicStashCreate).toHaveBeenCalledWith(
          '456',
        );
        expect(mockConsoleLog).toHaveBeenCalledWith({
          fieldLogicStashCreate: { formId: '456' },
        });
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashRemove', async () => {
        mockFsApiClient.fieldLogicStashRemove.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashRemove,
          '{"formId":"456"}',
        );

        expect(mockFsApiClient.fieldLogicStashRemove).toHaveBeenCalledWith(
          '456',
        );
        expect(result).toEqual(mockSuccessResponse);
      });
    });

    describe('FormDeveloperAdd', () => {
      it('should handle FormDeveloperAdd', async () => {
        mockFsApiClient.formDeveloperCopy.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormDeveloperAdd,
          '{"formId":"789"}',
        );

        expect(mockFsApiClient.formDeveloperCopy).toHaveBeenCalledWith('789');
        expect(result).toEqual(mockSuccessResponse);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return undefined for unknown function name', async () => {
      const result = await performMarvToolCall('unknownFunction', '{}');

      expect(result).toBeUndefined();
    });

    it('should handle invalid JSON in function arguments', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall('fieldRemove', 'invalid-json');

      expect(result).toEqual(mockSuccessResponse);
      expect(mockFsApiClient.fieldRemove).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Parameter Parsing Edge Cases', () => {
    it('should handle nested JSON objects', async () => {
      mockFsApiClient.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const complexParams = {
        fieldId: '123',
        metadata: { source: 'test', nested: { deep: true } },
      };

      await performMarvToolCall('fieldRemove', JSON.stringify(complexParams));

      expect(mockConsoleLog).toHaveBeenCalledWith({
        functionName: 'fieldRemove',
        fnParamsJson: complexParams,
      });
    });

    it('should handle array parameters', async () => {
      mockFsApiClient.formLiteAdd.mockResolvedValue(mockSuccessResponse);

      const fields = [
        { label: 'Name', field_type: 'text' },
        { label: 'Email', field_type: 'email' },
      ];

      await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        JSON.stringify({ formName: 'Test', fields }),
      );

      expect(mockFsApiClient.formLiteAdd).toHaveBeenCalledWith('Test', fields);
    });

    it('should handle missing formId parameter', async () => {
      mockFsApiClient.fieldLogicRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FieldLogicRemove,
        '{"otherParam":"value"}',
      );

      expect(mockFsApiClient.fieldLogicRemove).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Helper Functions Integration', () => {
    it('should correctly identify successful response', async () => {
      const successfulResponse = {
        isSuccess: true,
        response: {
          editUrl: 'https://example.com/edit',
          viewUrl: 'https://example.com/view',
          isSuccess: true,
          formId: '12345',
        },
        errorItems: null,
      };
      mockFsApiClient.formLiteAdd.mockResolvedValue(successfulResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{}',
      );

      expect(result).toEqual(successfulResponse);
      expect(result.errorItems).toBeNull();
    });

    it('should handle pushErrorMessage with null errorItems', async () => {
      const responseWithNullErrors = {
        isSuccess: false,
        response: null,
        errorItems: null,
      };
      mockFsApiClient.formLiteAdd.mockResolvedValue(responseWithNullErrors);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{}',
      );

      expect(result.errorItems).toBeInstanceOf(Array);
      expect(result.errorItems).toHaveLength(1);
      expect(result.errorItems![0]).toContain(
        'Function returned non-successful response',
      );
    });

    it('should correctly identify unsuccessful response', async () => {
      const unsuccessfulResponse = {
        isSuccess: false,
        response: null,
        errorItems: ['Original error'],
      };
      mockFsApiClient.formLiteAdd.mockResolvedValue(unsuccessfulResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{}',
      );

      expect(result.errorItems).toHaveLength(2);
      expect(result.errorItems).toContain('Original error');
      expect(result.errorItems).toContain(
        `Function returned non-successful response. Function name: ${FsRestrictedApiRoutesEnum.FormLiteAdd}`,
      );
    });

    it('should handle response with null response but success true', async () => {
      const ambiguousResponse = {
        isSuccess: true,
        response: null,
        errorItems: null,
      };
      mockFsApiClient.formLiteAdd.mockResolvedValue(ambiguousResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{}',
      );

      // This should be treated as unsuccessful due to null response
      expect(result.errorItems).toContain(
        `Function returned non-successful response. Function name: ${FsRestrictedApiRoutesEnum.FormLiteAdd}`,
      );
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complete form creation workflow', async () => {
      const formData = {
        formName: 'Customer Survey',
        fields: [
          { label: 'Name', field_type: 'text', isRequired: true },
          { label: 'Email', field_type: 'email', isRequired: true },
          { label: 'Rating', field_type: 'number', isRequired: false },
        ],
      };

      mockFsApiClient.formLiteAdd.mockResolvedValue({
        isSuccess: true,
        response: {
          formId: '12345',
          editUrl: 'https://example.com/edit',
          viewUrl: 'https://example.com/view',
          isSuccess: true,
        },
        errorItems: null,
      });

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        JSON.stringify(formData),
      );

      expect(mockFsApiClient.formLiteAdd).toHaveBeenCalledWith(
        'Customer Survey',
        formData.fields,
      );
      expect(result.isSuccess).toBe(true);
      expect(result.response.formId).toBe('12345');
    });

    it('should handle field operations on existing form', async () => {
      const fieldData = {
        formId: '12345',
        fields: {
          label: 'Phone Number',
          field_type: 'phone',
          isRequired: false,
        },
      };

      mockFsApiClient.fieldLiteAdd.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FieldLiteAdd,
        JSON.stringify(fieldData),
      );

      expect(mockFsApiClient.fieldLiteAdd).toHaveBeenCalledWith(
        '12345',
        fieldData.fields,
      );
    });
  });
});
